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

    # Possible normal chat responses
    chat_responses = [
        "Hi",
        "Hello world!",
        "Yes antidisestablishmentarianism now wait supercalifragilisticexpialidocious done.",
        "pneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosis",
        "Here is a deliberately long passage, written in a verbose and meandering style, with the sole purpose of making sure your code is resilient against excessively wordy inputs. Imagine, if you will, a user who simply refuses to stop typing: they pile on adjective after adjective, clause after clause, weaving together a tapestry of words that drags on far longer than is reasonable. Your system, of course, needs to accept this flood of text without complaint, store it, perhaps even process it, and ultimately return something coherent. This sentence keeps expanding, testing the buffer, pushing the limits, and proving once and for all that length alone should never break functionality.",
    ]

    # Possible food recommendations
    recommendation_responses = [
        {
            "title": "Rice and Beans Concoction",
            "content": "You fit go to the street to get a plate of rice from any buka near you. "
                    "Make sure their food is neat and hygienic though, your budget no fit buy good food sha.",
            "health": [
                {
                    "label": "Complete Protein",
                    "description": "Rice lacks lysine, and beans lack methionine. Together, they form a complete protein with all essential amino acids."
                },
                {
                    "label": "High Fiber",
                    "description": "Promotes satiety, regulates blood sugar, and supports gut health."
                },
                {
                    "label": "Plant-Based",
                    "description": "Ideal for vegetarian or vegan diets."
                }
            ]
        },
        {
            "title": "Suya with Cold Drink",
            "content": "Find a suya spot near you, preferably one that grills fresh meat. "
                    "Pair it with a cold mineral for maximum enjoyment.",
            "health": [
                {
                    "label": "High Protein",
                    "description": "Suya provides protein for muscle repair and energy."
                },
                {
                    "label": "Caution",
                    "description": "Processed drinks may be high in sugar, so consume in moderation."
                }
            ]
        },
        {
            "title": "Efo Riro with Semovita",
            "content": "A good swallow meal dey always hit. If you sabi cook, prepare your efo with assorted. "
                    "Otherwise, look for a local buka wey dem sabi better Yoruba soup.",
            # "health": [
            #     {
            #         "label": "Rich in Iron & Vitamins",
            #         "description": "Efo riro is packed with leafy greens, supporting blood health and boosting immunity."
            #     },
            #     {
            #         "label": "Balanced Meal",
            #         "description": "Semovita provides carbohydrates for energy, while the soup delivers protein and micronutrients."
            #     }
            # ]
        }
    ]



    # Randomly decide whether to return chat or recommendation
    if random.random() < 0.45:  # 45% chance it's a recommendation
        rec = random.choice(recommendation_responses)
        response = {
            "type": "recommendation",
            "role": "assistant",
            "title": rec["title"] if "title" in rec else None,
            "content": rec["content"] if "content" in rec else None,
            "health": rec["health"] if "health" in rec else None
        }
    else:
        chat_text = random.choice(chat_responses)
        response = {
            "type": "chat",
            "role": "assistant",
            "content": chat_text
        }

    logger.debug(f"LLM response generated: {response}")
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
    
    user_message = request.form.get("message")
    files = request.files.getlist("files")

    logger.debug(f"User message: {user_message}")
    logger.debug(f"Number of files uploaded: {len(files)}")

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

    # 2. Save user message always
    user_msg = Message(conversation_id=conversation.id, sender="user", text=user_message)
    db.session.add(user_msg)
    logger.debug(f"Saved user message to conversation {conversation.id}")

    # 3. Gather history
    history = Message.query.filter_by(conversation_id=conversation.id)\
        .order_by(Message.timestamp.asc()).all()
    messages = [{"role": m.sender, "content": m.text} for m in history]
    messages.append({"role": "user", "content": user_message})
    
    # 4. Call LLM
    bot_reply = call_llm(messages)

    # 5. Decide how to handle
    if isinstance(bot_reply, dict) and bot_reply.get("type") == "recommendation":
        # 🚨 Don't save to DB yet
        logger.info("Generated a recommendation, not saving yet")
        return jsonify(bot_reply), 200
    else:
        # Normal chat: save immediately
        reply_text = bot_reply["content"] if isinstance(bot_reply, dict) else str(bot_reply)
        bot_msg = Message(conversation_id=conversation.id, sender="bot", text=reply_text)
        db.session.add(bot_msg)
        db.session.commit()
        logger.info(f"Chat completed successfully. Saved bot reply for user {current_user.id}")
        return jsonify({"type": "chat", "role": "assistant", "content": reply_text}), 200

@chat_bp.route("/accept_recommendation", methods=["POST"])
@login_required
def accept_recommendation():
    data = request.get_json()
    title = data.get("title")
    content = data.get("content")

    # Find latest conversation
    conversation = Conversation.query.filter_by(user_id=current_user.id)\
        .order_by(Conversation.id.desc()).first()

    # Save recommendation as a bot message
    bot_msg = Message(
        conversation_id=conversation.id,
        sender="bot",
        text=f"{title}: {content}"
    )
    db.session.add(bot_msg)
    db.session.commit()

    return jsonify({"status": "saved"}), 200



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
