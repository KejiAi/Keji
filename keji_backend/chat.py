from flask import Blueprint, request, jsonify, Response, stream_with_context, g
from functools import wraps
from extensions import db
from models import Conversation, Message, User
import os
import logging
import time
import json
import re
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename
from get_response import handle_user_input, handle_rejected_recommendation
from context_manager import (
    process_conversation_context,
    get_full_history_for_frontend
)

# Create logger for this module
logger = logging.getLogger(__name__)

chat_bp = Blueprint("chat", __name__)
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def get_user_from_request():
    """
    Get or create user from request headers.
    Frontend sends user info from Supabase session.
    
    Headers expected:
    - X-User-Id: Supabase user ID
    - X-User-Email: User's email
    - X-User-Name: User's display name (optional)
    """
    user_id = request.headers.get('X-User-Id')
    email = request.headers.get('X-User-Email')
    name = request.headers.get('X-User-Name')
    
    if not user_id or not email:
        return None
    
    try:
        # Find or create user
        user = User.query.filter_by(supabase_id=user_id).first()
        
        if not user:
            user = User.query.filter_by(email=email).first()
            if user and not user.supabase_id:
                user.supabase_id = user_id
                if name:
                    user.name = name
                db.session.commit()
        
        if not user:
            user = User(
                supabase_id=user_id,
                email=email,
                name=name or email.split('@')[0],
                chat_style='pure_english',
                is_verified=True
            )
            db.session.add(user)
            db.session.commit()
            logger.info(f"Created new user: {email}")
        
        return user
        
    except Exception as e:
        logger.error(f"Error getting user: {str(e)}")
        db.session.rollback()
        return None


def auth_required(f):
    """Simple decorator to require user info in request headers."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_user_from_request()
        if not user:
            return jsonify({"error": "User info required"}), 401
        g.current_user = user
        return f(*args, **kwargs)
    return decorated

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
    try:
        current_time = get_time_of_day()
        
        # Safety check
        if not conversation_history or not isinstance(conversation_history, list):
            return True, True, current_time
        
        # If conversation is new or very short, send both
        if len(conversation_history) < 2:
            return True, True, current_time
    except Exception as e:
        logger.error(f"Error in should_send_context_info: {str(e)}")
        # Fallback: send both
        return True, True, get_time_of_day()
    
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
    
    logger.debug(f"Context: time={should_send_time} (current={current_time}), name={should_send_name} (msg#{user_message_count})")
    
    return should_send_time, should_send_name, current_time 

def split_into_chunks(text, max_chunk_size=150):
    """
    Split text into chunks of complete sentences.
    
    Args:
        text: The text to split
        max_chunk_size: Maximum characters per chunk (default 150)
    
    Returns:
        list: List of text chunks
    """
    # Split by sentence endings (. ! ?)
    sentences = re.split(r'([.!?]+\s+)', text)
    
    chunks = []
    current_chunk = ""
    
    for i in range(0, len(sentences), 2):
        sentence = sentences[i]
        punctuation = sentences[i + 1] if i + 1 < len(sentences) else ""
        full_sentence = sentence + punctuation
        
        # If adding this sentence exceeds max_chunk_size and current_chunk is not empty
        if current_chunk and len(current_chunk) + len(full_sentence) > max_chunk_size:
            chunks.append(current_chunk.strip())
            current_chunk = full_sentence
        else:
            current_chunk += full_sentence
    
    # Add remaining chunk
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    return chunks if chunks else [text]  # Return original text if no splits

def call_llm(messages, user_name=None, conversation_history=None, time_of_day=None, chat_style=None, image_base64_data=None):
    """
    Call the real Keji AI implementation with conversation context.
    
    Args:
        messages: List of conversation history (contains latest user message)
        user_name: Optional user's name for personalization
        conversation_history: Filtered conversation history for context (includes memory summary)
        time_of_day: Optional time period ('morning', 'afternoon', 'evening', 'night')
        image_base64_data: Optional list of dicts with 'base64' and 'mime_type' for vision API
    
    Returns:
        dict: Structured response (chat or recommendation) from Keji AI
    """
    try:
        # Validate inputs
        if not messages or not isinstance(messages, list):
            logger.warning("Invalid messages parameter, using default")
            messages = []
        
        logger.debug(f"Calling AI with {len(messages)} messages")
        if user_name:
            logger.debug(f"User name: {user_name}")
        if time_of_day:
            logger.debug(f"Time of day: {time_of_day}")
        if chat_style:
            logger.debug(f"Chat style: {chat_style}")
        if image_base64_data:
            logger.debug(f"Image base64 data: {len(image_base64_data)} image(s)")

        # Extract the latest user message
        if messages and len(messages) > 0:
            latest_message = messages[-1]
            user_input = latest_message.get("content", "") if isinstance(latest_message, dict) else "Hi"
        else:
            user_input = "Hi"
        
        if not user_input or not user_input.strip():
            user_input = "Hi"
        
        logger.debug(f"Processing user input: {len(user_input)} characters")
        
        # Call the real Keji AI implementation with conversation history
        response = handle_user_input(
            user_input,
            user_name=user_name,
            conversation_history=conversation_history,
            time_of_day=time_of_day,
            chat_style=chat_style,
            image_base64_data=image_base64_data,
        )
        
        # Validate response
        if not response or not isinstance(response, dict):
            logger.error("Invalid response from AI, using fallback")
            return {
                "type": "chat",
                "role": "assistant",
                "content": "Yeah, how can I help you?"
            }
        
        logger.debug(f"Keji AI response type: {response.get('type')}")
        return response
        
    except Exception as e:
        logger.error(f"Error in call_llm: {str(e)}", exc_info=True)
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
@auth_required
def chat():
    # Get user from request (set by auth_required decorator)
    user = g.current_user
    
    # Check if streaming is requested
    stream_response = request.args.get('stream', 'false').lower() == 'true'
    
    try:
        user_message = request.form.get("message")
        
        # Validate message
        if not user_message or not user_message.strip():
            return jsonify({"error": "Empty message"}), 400
        
        if len(user_message) > 5000:
            return jsonify({"error": "Message too long (max 5000 characters)"}), 400
        
        files = request.files.getlist("files")
        MAX_ATTACHMENTS = 2
        if files and len(files) > MAX_ATTACHMENTS:
            return jsonify({"error": f"You can upload at most {MAX_ATTACHMENTS} files per message."}), 400
        
        logger.info(f"HTTP chat request from {user.name}: {len(user_message)} chars (stream={stream_response})")
    except Exception as e:
        logger.error(f"Error validating chat request: {str(e)}", exc_info=True)
        return jsonify({"error": "Invalid request"}), 400

    try:
        # 1. Find or create latest conversation
        conversation = Conversation.query.filter_by(user_id=user.id)\
            .order_by(Conversation.id.desc()).first()
        if not conversation:
            conversation = Conversation(user_id=user.id)
            db.session.add(conversation)
            db.session.commit()
            logger.info(f"Created new conversation (ID: {conversation.id})")

    except Exception as e:
        logger.error(f"Database error creating conversation: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Failed to create conversation"}), 500

    try:
        # 2. Save user message
        user_msg = Message(conversation_id=conversation.id, sender="user", text=user_message)
        db.session.add(user_msg)
        db.session.commit()
        
    except Exception as e:
        logger.error(f"Database error saving message: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Failed to save message"}), 500

    try:
        # 3. Process conversation context
        filtered_history, summarization_occurred = process_conversation_context(
            conversation,
            user_message,
            db.session
        )
        
        # 4. Gather full history
        history = Message.query.filter_by(conversation_id=conversation.id)\
            .order_by(Message.timestamp.asc()).all()
        messages = []
        for msg in history:
            content = msg.text or ""
            attachments = getattr(msg, "attachments", []) or []
            if attachments:
                attachment_lines = []
                for attachment in attachments:
                    attachment_desc = attachment.filename or "file"
                    if attachment.content_type:
                        attachment_desc = f"{attachment_desc} ({attachment.content_type})"
                    attachment_lines.append(f"[Attachment: {attachment_desc} -> {attachment.url}]")
                attachment_text = "\n".join(attachment_lines)
                content = f"{content}\n{attachment_text}" if content else attachment_text

            messages.append({
                "role": msg.sender if msg.sender != "bot" else "assistant",
                "content": content
            })
        
        # 5. Determine context info
        send_time, send_name, time_of_day = should_send_context_info(history)
        chat_style = user.chat_style or "more_english"
        
        # 6. Call AI
        logger.info("Processing with AI...")
        bot_reply = call_llm(
            messages,
            user_name=user.name if send_name else None,
            conversation_history=filtered_history,
            time_of_day=time_of_day if send_time else None,
            chat_style=chat_style,
        )
        logger.info("AI response received")

    except Exception as e:
        logger.error(f"Error processing with AI: {str(e)}", exc_info=True)
        # Return fallback message
        return jsonify({
            "type": "chat",
            "role": "assistant",
            "content": "Omo, something don happen for my side. Abeg try again? I dey here to help you!"
        }), 200

    try:
        # 7. Handle response
        # IMPORTANT: Recommendations must NEVER be chunked - they must be sent as complete JSON structure
        if isinstance(bot_reply, dict) and bot_reply.get("type") == "recommendation":
            # Validate recommendation structure before returning
            if "title" in bot_reply and "content" in bot_reply:
                # Don't save to DB yet
                # NEVER chunk recommendations - return complete structure immediately
                logger.info(f"Recommendation: {bot_reply.get('title', 'N/A')} (length: {len(str(bot_reply))} chars - NOT chunking)")
                
                # For recommendations, always return immediately (no streaming, no chunking)
                return jsonify(bot_reply), 200
            else:
                logger.error(f"Invalid recommendation structure: missing title or content. Got: {list(bot_reply.keys())}")
                # Fallback to chat response
                reply_text = bot_reply.get("content", "Here's a food suggestion for you.")
                return jsonify({"type": "chat", "role": "assistant", "content": reply_text}), 200
        else:
            # Normal chat response
            reply_text = bot_reply.get("content") if isinstance(bot_reply, dict) else str(bot_reply)
            
            if not reply_text:
                logger.warning("Empty reply from AI, using fallback")
                reply_text = "Yeah, how can I help you?"
            
            # Decide if we should chunk this message
            should_chunk = stream_response and len(reply_text) > 100
            
            if should_chunk:
                # Split into chunks and save each chunk as separate message
                chunks = split_into_chunks(reply_text, max_chunk_size=150)
                message_group_id = str(uuid.uuid4())  # Generate unique ID for this message group
                logger.info(f"Saving {len(chunks)} chunks with group ID: {message_group_id}")
                
                # Save all chunks to database
                for i, chunk in enumerate(chunks):
                    chunk_msg = Message(
                        conversation_id=conversation.id,
                        sender="bot",
                        text=chunk,
                        message_group_id=message_group_id,
                        chunk_index=i,
                        total_chunks=len(chunks)
                    )
                    db.session.add(chunk_msg)
                
                db.session.commit()
                logger.info(f"All {len(chunks)} chunks saved to database")
                
                # Stream chunks to frontend
                def generate():
                    for i, chunk in enumerate(chunks):
                        # Calculate delay based on chunk length (simulate realistic typing)
                        if i > 0:  # No delay before first chunk
                            base_delay = 0.8
                            typing_speed = 40  # characters per second (realistic fast typing)
                            typing_time = len(chunk) / typing_speed
                            delay = base_delay + typing_time
                            
                            logger.debug(f"Chunk {i+1}/{len(chunks)}: {len(chunk)} chars, waiting {delay:.2f}s")
                            time.sleep(delay)
                        
                        chunk_data = {
                            "chunk": chunk,
                            "chunk_index": i,
                            "total_chunks": len(chunks),
                            "is_final": i == len(chunks) - 1,
                            "message_group_id": message_group_id
                        }
                        yield f"data: {json.dumps(chunk_data)}\n\n"
                    
                    logger.info("All chunks sent via streaming")
                
                return Response(
                    stream_with_context(generate()),
                    mimetype='text/event-stream',
                    headers={
                        'Cache-Control': 'no-cache',
                        'X-Accel-Buffering': 'no'
                    }
                )
            else:
                # Save as single message (no chunking)
                bot_msg = Message(
                    conversation_id=conversation.id,
                    sender="bot",
                    text=reply_text
                )
                db.session.add(bot_msg)
                db.session.commit()
                
                logger.info("Chat message saved and sent (no streaming)")
                return jsonify({"type": "chat", "role": "assistant", "content": reply_text}), 200
            
    except Exception as e:
        logger.error(f"Error saving bot response: {str(e)}", exc_info=True)
        db.session.rollback()
        # Still return the response even if save failed
        reply_text = bot_reply.get("content", "Yeah, how can I help you?") if isinstance(bot_reply, dict) else str(bot_reply)
        return jsonify({"type": "chat", "role": "assistant", "content": reply_text}), 200

@chat_bp.route("/accept_recommendation", methods=["POST"])
@auth_required
def accept_recommendation():
    user = g.current_user
    
    try:
        data = request.get_json()
        
        # Validate data
        if not data or not isinstance(data, dict):
            return jsonify({"status": "error", "message": "Invalid data"}), 400
        
        title = data.get("title")
        content = data.get("content")
        
        if not title or not content:
            return jsonify({"status": "error", "message": "Missing title or content"}), 400
        
        logger.info(f"Accepting recommendation: {title} (User: {user.name})")

    except Exception as e:
        logger.error(f"Error validating recommendation data: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "Invalid request"}), 400

    try:
        # Find latest conversation
        conversation = Conversation.query.filter_by(user_id=user.id)\
            .order_by(Conversation.id.desc()).first()
        
        if not conversation:
            logger.warning("No conversation found")
            return jsonify({"status": "error", "message": "No conversation found"}), 404

        # Save recommendation as a bot message
        bot_msg = Message(
            conversation_id=conversation.id,
            sender="bot",
            text=f"{title}: {content}"
        )
        db.session.add(bot_msg)
        db.session.commit()
        
        logger.info("Recommendation saved")
        return jsonify({"status": "saved"}), 200
        
    except Exception as e:
        logger.error(f"Database error saving recommendation: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"status": "error", "message": "Failed to save recommendation"}), 500


@chat_bp.route("/reject_recommendation", methods=["POST"])
@auth_required
def reject_recommendation():
    """
    Handle when user rejects a recommendation (clicks 'No').
    Bypasses classification and directly calls for a new recommendation.
    Does NOT save rejected recommendations to database.
    Tracks all rejected titles to avoid recommending them again.
    
    Expected request body:
    {
        "title": "Rejected Food Title",
        "recommendation_context": {
            "context_type": "budget" | "ingredient",
            "budget": 500,              // if budget-based
            "ingredients": ["rice"],    // if ingredient-based
            "rejected_titles": ["Rice and Beans", "Jollof Rice"]  // previously rejected
        }
    }
    """
    user = g.current_user
    
    try:
        data = request.get_json()
        
        # Validate data
        if not data or not isinstance(data, dict):
            return jsonify({"error": "Invalid data"}), 400
        
        rejected_title = data.get("title")
        recommendation_context = data.get("recommendation_context", {})
        
        if not rejected_title:
            return jsonify({"error": "Missing rejected title"}), 400
        
        # Extract context
        context_type = recommendation_context.get("context_type")
        budget = recommendation_context.get("budget")
        ingredients = recommendation_context.get("ingredients")
        rejected_titles = recommendation_context.get("rejected_titles", [])
        
        logger.info(f"Rejecting recommendation: {rejected_title} (User: {user.name})")
        logger.info(f"   Context type: {context_type}, budget: {budget}, ingredients: {ingredients}")
        logger.info(f"   Previously rejected: {rejected_titles}")

    except Exception as e:
        logger.error(f"Error validating rejection data: {str(e)}", exc_info=True)
        return jsonify({"error": "Invalid request"}), 400

    try:
        # Find latest conversation for context
        conversation = Conversation.query.filter_by(user_id=user.id)\
            .order_by(Conversation.id.desc()).first()
        
        if not conversation:
            logger.warning("No conversation found")
            return jsonify({"error": "No conversation found"}), 404

        # Get conversation history for context
        from context_manager import process_conversation_context
        filtered_history, _ = process_conversation_context(
            conversation,
            f"User rejected: {rejected_title}",
            db.session
        )
        
        # Get chat style
        chat_style = user.chat_style or "more_english"
        
        # Call rejection handler (bypasses classification, directly gets new recommendation)
        # NOTE: We do NOT save the rejected recommendation to DB
        # Pass rejected_titles so AI knows what to avoid
        new_recommendation = handle_rejected_recommendation(
            rejected_title=rejected_title,
            budget=budget,
            ingredients=ingredients,
            conversation_history=filtered_history,
            chat_style=chat_style,
            rejected_titles=rejected_titles,
        )
        
        logger.info(f"New recommendation generated: {new_recommendation.get('title', 'N/A')}")
        
        # Return new recommendation (not saved to DB - only saved when accepted)
        # Response includes updated rejected_titles list for future rejections
        return jsonify(new_recommendation), 200
        
    except Exception as e:
        logger.error(f"Error generating new recommendation: {str(e)}", exc_info=True)
        return jsonify({
            "type": "chat",
            "role": "assistant",
            "content": "Omo, I no fit find another option right now. Abeg try again?"
        }), 200



@chat_bp.route("/chat/history", methods=["GET"])
@auth_required
def history():
    """
    Retrieve full conversation history for frontend display.
    This ALWAYS returns the complete history, never filtered.
    The frontend needs all messages to display the full conversation.
    """
    user = g.current_user
    
    try:
        logger.info(f"HTTP history request from {user.name}")
        
        # Get latest conversation for this user
        conversation = Conversation.query.filter_by(user_id=user.id)\
            .order_by(Conversation.id.desc()).first()

        if not conversation:
            return jsonify({"messages": []}), 200
        
        # Get full history using context manager
        full_history = get_full_history_for_frontend(conversation.id)
        logger.info(f"Retrieved {len(full_history)} messages")

        return jsonify({
            "messages": full_history,
            "has_summary": conversation.memory_summary is not None,
            "summarized_count": conversation.pruned_count or 0
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving chat history: {str(e)}", exc_info=True)
        return jsonify({"messages": [], "error": "Failed to retrieve history"}), 200


# if __name__ == "__main__":
#     print(call_llm("hi"))
