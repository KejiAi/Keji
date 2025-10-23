from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from models import Conversation, Message
import random
import os
import logging
from datetime import datetime
from werkzeug.utils import secure_filename
from get_response import handle_user_input
from context_manager import (
    process_conversation_context,
    get_full_history_for_frontend
)

# Create logger for this module
logger = logging.getLogger(__name__)

chat_bp = Blueprint("chat", __name__)
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def get_time_of_day():
    """
    Get the current time of day period.
    Returns: string - 'morning', 'afternoon', 'evening', or 'night'
    """
    hour = datetime.now().hour
    if 5 <= hour < 12:
        return "morning"
    elif 12 <= hour < 16:
        return "afternoon"
    elif 16 <= hour < 22:
        return "evening"
    else:
        return "night"

def should_send_context_info(conversation_history):
    """
    Determine if we should send time and name context to AI.
    
    Logic:
    - Send time if: last message was from a different time period (morning -> afternoon, etc.)
    - Send name every 10 user messages
    - If conversation is new (< 2 messages), always send both
    
    Args:
        conversation_history: List of message objects
    
    Returns:
        tuple: (should_send_time: bool, should_send_name: bool, current_time_of_day: str)
    """
    current_time = get_time_of_day()
    
    # If conversation is new or very short, send both
    if len(conversation_history) < 2:
        return True, True, current_time
    
    # Count user messages for name sending logic (every 10 messages)
    user_message_count = sum(1 for msg in conversation_history if msg.sender == "user")
    should_send_name = (user_message_count % 10 == 1)  # Send at 1, 11, 21, 31, etc.
    
    # Check if time period changed from last bot message
    should_send_time = False
    # Look for the most recent bot message to check its timestamp
    for msg in reversed(conversation_history):
        if msg.sender == "bot":
            msg_time = msg.timestamp
            msg_hour = msg_time.hour
            
            # Determine time period of last bot message
            if 5 <= msg_hour < 12:
                last_time_period = "morning"
            elif 12 <= msg_hour < 16:
                last_time_period = "afternoon"
            elif 16 <= msg_hour < 22:
                last_time_period = "evening"
            else:
                last_time_period = "night"
            
            # Send time if period changed
            if last_time_period != current_time:
                should_send_time = True
            break
    else:
        # No bot message found, this might be first interaction
        should_send_time = True
    
    logger.debug(f"🕐 Context decision: time={should_send_time} (current={current_time}), name={should_send_name} (msg#{user_message_count})")
    
    return should_send_time, should_send_name, current_time 

def call_llm(messages, user_name=None, conversation_history=None, time_of_day=None):
    """
    Call the real Keji AI implementation with conversation context.
    
    Args:
        messages: List of conversation history (contains latest user message)
        user_name: Optional user's name for personalization
        conversation_history: Filtered conversation history for context (includes memory summary)
        time_of_day: Optional time period ('morning', 'afternoon', 'evening', 'night')
    
    Returns:
        dict: Structured response (chat or recommendation) from Keji AI
    """
    logger.debug(f"Calling Keji AI with {len(messages)} messages")
    logger.debug(f"Message history: {[msg.get('role', 'unknown') for msg in messages]}")
    if user_name:
        logger.debug(f"👤 User name: {user_name}")
    if time_of_day:
        logger.debug(f"🕐 Time of day: {time_of_day}")

    # Extract the latest user message
    if messages and len(messages) > 0:
        latest_message = messages[-1]
        user_input = latest_message.get("content", "")
    else:
        user_input = "Hi"
    
    logger.debug(f"Processing user input: {len(user_input)} characters")
    
    # Call the real Keji AI implementation with conversation history
    try:
        response = handle_user_input(
            user_input, 
            user_name=user_name,
            conversation_history=conversation_history,
            time_of_day=time_of_day
        )
        logger.debug(f"Keji AI response type: {response.get('type')}")
        logger.debug(f"Response structure: {list(response.keys())}")
        return response
    except Exception as e:
        logger.error(f"Error in Keji AI: {str(e)}", exc_info=True)
        # Fallback response
        return {
            "type": "chat",
            "role": "assistant",
            "content": "Omo, something don happen for my side. Abeg try again? I dey here to help you!"
        }


# def handle_uploaded_files(files):
#     """
#     Save uploaded files to UPLOAD_FOLDER and return a list of saved filenames.
#     """
#     saved_files = []
#     for f in files:
#         if f.filename:  # skip empty uploads
#             filename = secure_filename(f.filename)
#             filepath = os.path.join(UPLOAD_FOLDER, filename)
#             f.save(filepath)
#             print(f"✅ Received file: {filename} -> saved at {filepath}")
#             saved_files.append(filepath)
#     return saved_files


@chat_bp.route("/chat", methods=["POST"])
@login_required
def chat():
    logger.info("\n" + "🔵 "*30)
    logger.info("📨 NEW CHAT REQUEST")
    logger.info("🔵 "*30)
    logger.info(f"👤 User: {current_user.name} (ID: {current_user.id})")
    
    user_message = request.form.get("message")
    files = request.files.getlist("files")

    logger.info(f"📝 Message length: {len(user_message)} characters")
    logger.debug(f"📎 Files uploaded: {len(files)}")
    logger.info("\n")

    # 1. Find or create latest conversation
    logger.debug("🔍 Finding or creating conversation...")
    conversation = Conversation.query.filter_by(user_id=current_user.id)\
        .order_by(Conversation.id.desc()).first()
    if not conversation:
        conversation = Conversation(user_id=current_user.id)
        db.session.add(conversation)
        db.session.commit()
        logger.info(f"✅ Created new conversation (ID: {conversation.id})")
    else:
        logger.debug(f"✅ Using existing conversation (ID: {conversation.id})")
    logger.info("\n")

    # 2. Save user message always
    logger.debug("💾 Saving user message to database...")
    user_msg = Message(conversation_id=conversation.id, sender="user", text=user_message)
    db.session.add(user_msg)
    db.session.commit()  # Commit so it's available for context processing
    logger.debug(f"✅ User message saved to conversation {conversation.id}\n")

    # 3. Process conversation context (handles summarization if needed)
    logger.info("🧠 Processing conversation context...")
    filtered_history, summarization_occurred = process_conversation_context(
        conversation,
        user_message,
        db.session
    )
    
    if summarization_occurred:
        logger.info("✨ Conversation was summarized to save tokens")
    
    # 4. Gather full history for message list (used for latest message extraction)
    history = Message.query.filter_by(conversation_id=conversation.id)\
        .order_by(Message.timestamp.asc()).all()
    messages = [{"role": m.sender if m.sender != "bot" else "assistant", "content": m.text} for m in history]
    logger.debug(f"✅ Loaded {len(messages)} messages from history\n")
    
    # 5. Determine if we should send time and name context
    send_time, send_name, time_of_day = should_send_context_info(history)
    
    # 6. Call LLM with filtered context (includes memory summary + recent messages)
    logger.info("🤖 Calling Keji AI with context-aware history...")
    bot_reply = call_llm(
        messages,
        user_name=current_user.name if send_name else None,
        conversation_history=filtered_history,
        time_of_day=time_of_day if send_time else None
    )
    logger.info("✅ Received response from Keji AI\n")

    # 6. Decide how to handle
    logger.debug("🔀 Determining response type...")
    if isinstance(bot_reply, dict) and bot_reply.get("type") == "recommendation":
        # 🚨 Don't save to DB yet
        logger.info("📌 Response type: RECOMMENDATION (not saving to DB yet)")
        logger.info(f"   Title: {bot_reply.get('title', 'N/A')}")
        logger.info(f"   Health benefits: {len(bot_reply.get('health', []))}")
        logger.info("🔵 "*30 + "\n")
        return jsonify(bot_reply), 200
    else:
        # Normal chat: save immediately
        logger.info("💬 Response type: CHAT (saving to DB)")
        reply_text = bot_reply["content"] if isinstance(bot_reply, dict) else str(bot_reply)
        logger.debug(f"   Reply length: {len(reply_text)} characters")
        
        bot_msg = Message(conversation_id=conversation.id, sender="bot", text=reply_text)
        db.session.add(bot_msg)
        db.session.commit()
        
        logger.info(f"✅ Chat completed successfully. Bot reply saved.")
        logger.info("🔵 "*30 + "\n")
        return jsonify({"type": "chat", "role": "assistant", "content": reply_text}), 200

@chat_bp.route("/accept_recommendation", methods=["POST"])
@login_required
def accept_recommendation():
    logger.info("\n" + "🟢 "*30)
    logger.info("✅ ACCEPT RECOMMENDATION REQUEST")
    logger.info("🟢 "*30)
    logger.info(f"👤 User: {current_user.name} (ID: {current_user.id})")
    
    data = request.get_json()
    title = data.get("title")
    content = data.get("content")
    
    logger.info(f"📌 Recommendation: {title}")
    logger.debug(f"   Content length: {len(content)} characters")
    logger.info("\n")

    # Find latest conversation
    logger.debug("🔍 Finding latest conversation...")
    conversation = Conversation.query.filter_by(user_id=current_user.id)\
        .order_by(Conversation.id.desc()).first()
    
    if conversation:
        logger.debug(f"✅ Found conversation (ID: {conversation.id})")
    else:
        logger.warning("⚠️  No conversation found!")
        return jsonify({"status": "error", "message": "No conversation found"}), 404

    # Save recommendation as a bot message
    logger.debug("💾 Saving recommendation to database...")
    bot_msg = Message(
        conversation_id=conversation.id,
        sender="bot",
        text=f"{title}: {content}"
    )
    db.session.add(bot_msg)
    db.session.commit()
    
    logger.info("✅ Recommendation saved successfully")
    logger.info("🟢 "*30 + "\n")

    return jsonify({"status": "saved"}), 200



@chat_bp.route("/chat/history", methods=["GET"])
@login_required
def history():
    """
    Retrieve full conversation history for frontend display.
    This ALWAYS returns the complete history, never filtered.
    The frontend needs all messages to display the full conversation.
    """
    logger.info("\n" + "🟡 "*30)
    logger.info("📖 CHAT HISTORY REQUEST")
    logger.info("🟡 "*30)
    logger.info(f"👤 User: {current_user.name} (ID: {current_user.id})")
    logger.info("\n")
    
    # Get latest conversation for this user
    logger.debug("🔍 Finding latest conversation...")
    conversation = Conversation.query.filter_by(user_id=current_user.id)\
        .order_by(Conversation.id.desc()).first()

    if not conversation:
        logger.warning(f"⚠️  No conversation found for user {current_user.id}")
        logger.info("🟡 "*30 + "\n")
        return jsonify({"messages": []}), 200

    logger.debug(f"✅ Found conversation (ID: {conversation.id})")
    
    # Get full history using context manager (ensures consistency)
    full_history = get_full_history_for_frontend(conversation.id)
    
    logger.info(f"✅ Retrieved {len(full_history)} messages for frontend")
    logger.debug(f"   User messages: {sum(1 for m in full_history if m['sender'] == 'user')}")
    logger.debug(f"   Bot messages: {sum(1 for m in full_history if m['sender'] == 'bot')}")
    
    # Log memory summary status
    if conversation.memory_summary:
        logger.info(f"💭 Memory summary exists ({conversation.pruned_count} messages summarized)")
    
    logger.info("🟡 "*30 + "\n")

    return jsonify({
        "messages": full_history,
        "has_summary": conversation.memory_summary is not None,
        "summarized_count": conversation.pruned_count or 0
    }), 200


# if __name__ == "__main__":
#     print(call_llm("hi"))
