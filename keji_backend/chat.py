from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from models import Conversation, Message
import random
import os
import logging
from werkzeug.utils import secure_filename

# Create logger for this module
logger = logging.getLogger(__name__)

chat_bp = Blueprint("chat", __name__)
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True) 

def call_llm(messages):
    logger.debug(f"Calling LLM with {len(messages)} messages")
    logger.debug(f"Message history: {[msg.get('role', 'unknown') for msg in messages]}")
    
    responses = [
        # very short words
        "Hi", "Yes",
        
        # very short strings
        "Hello world!",
        
        # medium strings
        "This makes sense.", 
        "I agree completely.", 
        "Do you want to continue?",
        
        # long words 
        "pneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosis",
        
        # long strings (now much longer)
        "Sometimes the best way to test a language model or function is to push it with both very short and incredibly long pieces of text. This ensures robustness in a variety of contexts, because real conversations are messy, unpredictable, and full of sudden shifts in tone. You might start with a one-word answer, then transition into a mini-essay. You might interject with a nonsense word, then follow with a carefully reasoned explanation. By feeding the function everything from the tiniest particles of language to sprawling multi-clause structures, you can guarantee that the system won't choke when reality hits.",
        
        "Here is a deliberately long passage, written in a verbose and meandering style, with the sole purpose of making sure your code is resilient against excessively wordy inputs. Imagine, if you will, a user who simply refuses to stop typing: they pile on adjective after adjective, clause after clause, weaving together a tapestry of words that drags on far longer than is reasonable. Your system, of course, needs to accept this flood of text without complaint, store it, perhaps even process it, and ultimately return something coherent. This sentence keeps expanding, testing the buffer, pushing the limits, and proving once and for all that length alone should never break functionality.",
        
        # mixture of long + short words
        "Yes antidisestablishmentarianism now wait supercalifragilisticexpialidocious done.",
        "Short bigwordlikepneumonoultramicroscopicsilicovolcanoconiosis quick tinywords go!",
        "Tiny word hugewordfloccinaucinihilipilification mix short mixlong done again now."
    ]
    
    response = random.choice(responses)
    logger.debug(f"LLM response generated: {response[:100]}{'...' if len(response) > 100 else ''}")
    return response

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
    logger.info(f"Chat request received from user: {current_user.name} (ID: {current_user.id})")
    
    user_message = request.form.get("message")  # text
    files = request.files.getlist("files")
    
    logger.debug(f"User message: {user_message}")
    logger.debug(f"Number of files uploaded: {len(files)}")
    
    # Log file information
    for f in files:
        if f.filename:
            logger.debug(f"File uploaded: {f.filename} (size: {f.content_length} bytes)")
        else:
            logger.debug("Empty file upload detected")
    
    """I will come back to file handling later"""

    # 1. Find or create latest conversation
    conversation = Conversation.query.filter_by(user_id=current_user.id)\
        .order_by(Conversation.id.desc()).first()
    if not conversation:
        conversation = Conversation(user_id=current_user.id)
        db.session.add(conversation)
        db.session.commit()
        logger.info(f"Created new conversation for user {current_user.id} (conversation ID: {conversation.id})")
    else:
        logger.debug(f"Using existing conversation ID: {conversation.id}")

    # 2. Save user message
    user_msg = Message(conversation_id=conversation.id, sender="user", text=user_message)
    db.session.add(user_msg)
    logger.debug(f"Saved user message to conversation {conversation.id}")

    # 3. Gather context (last N messages, e.g., 10)
    history = Message.query.filter_by(conversation_id=conversation.id)\
        .order_by(Message.timestamp.asc()).all()
    messages = [{"role": m.sender, "content": m.text} for m in history]
    messages.append({"role": "user", "content": user_message})
    
    logger.debug(f"Gathered {len(history)} previous messages for context")

    # 4. Call LLM
    bot_reply = call_llm(messages)

    # 5. Save bot reply
    bot_msg = Message(conversation_id=conversation.id, sender="bot", text=bot_reply)
    db.session.add(bot_msg)
    db.session.commit()
    
    logger.info(f"Chat completed successfully for user {current_user.id}. Bot reply length: {len(bot_reply)} characters")

    return jsonify({"reply": bot_reply}), 200


@chat_bp.route("/chat/history", methods=["GET"])
@login_required
def history():
    logger.info(f"Chat history request from user: {current_user.name} (ID: {current_user.id})")
    
    # Get latest conversation for this user
    conversation = Conversation.query.filter_by(user_id=current_user.id)\
        .order_by(Conversation.id.desc()).first()

    if not conversation:
        logger.debug(f"No conversation found for user {current_user.id}")
        return jsonify({"messages": []}), 200

    messages = Message.query.filter_by(conversation_id=conversation.id)\
        .order_by(Message.timestamp.asc()).all()
    
    logger.info(f"Retrieved {len(messages)} messages from conversation {conversation.id} for user {current_user.id}")

    return jsonify({
        "messages": [{"sender": m.sender, "text": m.text, "timestamp": m.timestamp} for m in messages]
    }), 200


# if __name__ == "__main__":
#     print(call_llm("hi"))
