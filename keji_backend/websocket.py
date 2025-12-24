from flask import request
from flask_login import current_user
from flask_socketio import emit, join_room, leave_room, disconnect
from extensions import socketio, db
from models import Conversation, Message, MessageAttachment


MAX_ATTACHMENTS = 2
pause_before_recommendation = 5

from get_response import handle_user_input
from context_manager import (
    process_conversation_context,
    get_full_history_for_frontend
)
from datetime import datetime, timezone
import logging


def get_utc_timestamp():
    """Return UTC timestamp in ISO format with 'Z' suffix for proper JS parsing."""
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def to_utc_isoformat(dt):
    """Convert a datetime to UTC ISO format with 'Z' suffix for proper JS parsing."""
    if dt is None:
        return get_utc_timestamp()
    # If datetime is naive (no timezone), assume it's local time and just return with Z
    # since we're storing local time in DB and want consistent frontend display
    if dt.tzinfo is None:
        # Treat as local, return as-is with Z for consistent JS parsing
        return dt.isoformat() + 'Z'
    return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
import time
import uuid
import re
import os
import mimetypes
from pathlib import Path

import certifi

try:
    import cloudinary
    from cloudinary.uploader import upload as cloudinary_upload
except ImportError:
    cloudinary = None
    cloudinary_upload = None

# Ensure reliable SSL certificates for external requests (avoids OpenSSL issues)
os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())

# Create logger for this module
logger = logging.getLogger(__name__)

# Check if we're in production mode
ENVIRONMENT = os.getenv("FLASK_ENV", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"

# Configure Cloudinary (if credentials are present)
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")
CLOUDINARY_UPLOAD_FOLDER = os.getenv("CLOUDINARY_UPLOAD_FOLDER", "keji/uploads")

CLOUDINARY_ENABLED = all([
    cloudinary is not None,
    cloudinary_upload is not None,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
])

if CLOUDINARY_ENABLED:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True,
    )
    logger.info("Cloudinary configured successfully for image uploads")
else:
    if cloudinary is None or cloudinary_upload is None:
        logger.warning("cloudinary package not available; file uploads will be skipped")
    else:
        logger.warning("Cloudinary credentials missing; file uploads will be skipped")

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


def _cloudinary_upload_data_uri(data_uri, public_id, resource_type="image"):
    """
    Upload a data URI string to Cloudinary using a real thread (avoids eventlet SSL issues).
    """
    if not CLOUDINARY_ENABLED:
        raise RuntimeError("Cloudinary is not configured")

    import eventlet.tpool

    def _call():
        upload_options = {
            "resource_type": resource_type,
            "public_id": public_id,
            "overwrite": False,
        }
        if CLOUDINARY_UPLOAD_FOLDER:
            upload_options["folder"] = CLOUDINARY_UPLOAD_FOLDER
        return cloudinary_upload(data_uri, **upload_options)

    return eventlet.tpool.execute(_call)


def upload_images_to_cloudinary(file_payloads):
    """
    Upload a list of file payloads (with base64 data) to Cloudinary.
    
    Args:
        file_payloads: List of dicts with keys 'name', 'type', 'data'
    
    Returns:
        tuple: (uploaded_files, errors)
            uploaded_files: List of dicts with 'name' and 'url'
            errors: List of error strings for files that failed
    """
    if not CLOUDINARY_ENABLED:
        logger.warning("Cloudinary not configured; skipping image uploads")
        return [], ["Cloudinary not configured"]

    uploaded_files = []
    errors = []

    for index, payload in enumerate(file_payloads):
        name = payload.get("name") or f"upload-{index}"
        mime_type = (payload.get("type") or mimetypes.guess_type(name)[0] or "application/octet-stream").lower()
        base64_data = payload.get("data")
        size = payload.get("size")

        if not base64_data:
            errors.append(f"{name}: missing file data")
            continue

        if not mime_type.startswith("image/"):
            errors.append(f"{name}: unsupported file type ({mime_type})")
            continue

        data_uri = f"data:{mime_type};base64,{base64_data}"
        public_id = f"{Path(name).stem}-{uuid.uuid4().hex[:8]}"

        try:
            result = _cloudinary_upload_data_uri(data_uri, public_id, resource_type="image")
            url = result.get("secure_url") or result.get("url")
            if url:
                uploaded_files.append({
                    "name": name,
                    "url": url,
                    "type": mime_type,
                    "size": size,
                    "base64": base64_data  # Store base64 for vision API
                })
            else:
                errors.append(f"{name}: upload succeeded but URL missing")
        except Exception as upload_error:
            logger.error(f"Cloudinary upload failed for {name}: {upload_error}", exc_info=True)
            errors.append(f"{name}: upload failed")

    return uploaded_files, errors

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


@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    try:
        if not current_user.is_authenticated:
            logger.warning("Unauthorized WebSocket connection attempt")
            return False  # Reject connection
        
        logger.info(f"WebSocket connected: User {current_user.name} (ID: {current_user.id})")
        
        # Join a room specific to this user
        user_room = f"user_{current_user.id}"
        join_room(user_room)
        
        # Send connection confirmation
        emit('connected', {
            'message': 'Connected to Keji AI',
            'user_id': current_user.id,
            'user_name': current_user.name
        })
        
        return True
        
    except Exception as e:
        logger.error(f"Error in WebSocket connect: {str(e)}", exc_info=True)
        return False


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    try:
        if current_user.is_authenticated:
            logger.info(f"WebSocket disconnected: User {current_user.name} (ID: {current_user.id})")
            user_room = f"user_{current_user.id}"
            leave_room(user_room)
    except Exception as e:
        logger.error(f"Error in WebSocket disconnect: {str(e)}", exc_info=True)


@socketio.on('send_message')
def handle_send_message(data):
    """
    Handle incoming chat message from client
    
    Expected data format:
    {
        'message': str,  # The text message
        'files': list    # Optional list of files (not yet implemented)
    }
    """
    try:
        # Validate authentication
        if not current_user.is_authenticated:
            emit('error', {'message': 'Not authenticated'})
            return
        
        # Validate data
        if not data or not isinstance(data, dict):
            emit('error', {'message': 'Invalid data format'})
            return
        
        raw_user_message = data.get('message', '')
        if not isinstance(raw_user_message, str):
            raw_user_message = str(raw_user_message)
        
        client_message_id = data.get('client_message_id')
        if client_message_id is not None and not isinstance(client_message_id, str):
            client_message_id = str(client_message_id)

        raw_files = data.get('files', [])
        file_names = []
        file_payloads = []
        if isinstance(raw_files, list):
            if len(raw_files) > MAX_ATTACHMENTS:
                emit('error', {'message': f'You can upload at most {MAX_ATTACHMENTS} files per message.'})
                return
            for index, file_item in enumerate(raw_files):
                filename = None
                file_data = None
                content_type = None
                size = None

                if isinstance(file_item, dict):
                    filename = (
                        file_item.get('name')
                        or file_item.get('filename')
                        or file_item.get('originalname')
                    )
                    file_data = file_item.get('data')
                    content_type = file_item.get('type')
                    size = file_item.get('size')
                elif isinstance(file_item, str):
                    filename = file_item

                clean_name = str(filename).strip() if filename else f"upload-{index}"
                if clean_name:
                    file_names.append(clean_name)

                if isinstance(file_item, dict) and file_data:
                    file_payloads.append({
                        "name": clean_name,
                        "data": file_data,
                        "type": content_type,
                        "size": size,
                    })
        
        has_files = len(file_names) > 0 or len(file_payloads) > 0
        
        # Validate message
        if not raw_user_message or not raw_user_message.strip():
            if not has_files:
                emit('error', {'message': 'Empty message'})
                return
            # Files only – keep the persisted message empty so filenames do not appear in chat bubbles
            user_message = ""
        else:
            user_message = raw_user_message.strip()
        
        # Limit message length to prevent abuse
        if len(user_message) > 5000:
            emit('error', {'message': 'Message too long (max 5000 characters)'})
            return
        
        logger.info(f"New message from {current_user.name}: {len(user_message)} chars")
        user_message_for_context = user_message
        
    except Exception as e:
        logger.error(f"Error validating message: {str(e)}", exc_info=True)
        emit('error', {'message': 'Invalid request'})
        return
    
    # Handle database operations
    try:
        # 1. Find or create latest conversation
        conversation = Conversation.query.filter_by(user_id=current_user.id)\
            .order_by(Conversation.id.desc()).first()
        if not conversation:
            conversation = Conversation(user_id=current_user.id)
            db.session.add(conversation)
            db.session.commit()
            logger.info(f"Created new conversation (ID: {conversation.id})")

    except Exception as e:
        logger.error(f"Database error creating conversation: {str(e)}", exc_info=True)
        db.session.rollback()
        emit('error', {'message': 'Failed to create conversation'})
        return

    try:
        # 2. Save user message
        user_msg = Message(conversation_id=conversation.id, sender="user", text=user_message)
        db.session.add(user_msg)
        db.session.commit()
        
        # Emit confirmation that message was received
        emit('message_saved', {
            'message_id': user_msg.id,
            'timestamp': to_utc_isoformat(user_msg.timestamp),
            'client_message_id': client_message_id
        })

        # 2b. If files were attached, confirm receipt with filenames (development only)
        # In production, skip this message as the LLM response is sufficient
        if file_names and not IS_PRODUCTION:
            if len(file_names) == 1:
                ack_text = f"Got your file '{file_names[0]}'."
            else:
                joined_names = ", ".join(file_names[:-1])
                last_name = file_names[-1]
                ack_text = f"Got your files '{joined_names}', and '{last_name}'."

            ack_msg = Message(
                conversation_id=conversation.id,
                sender="bot",
                text=ack_text
            )
            db.session.add(ack_msg)
            db.session.commit()

            emit('receive_message', {
                'type': 'chat',
                'role': 'assistant',
                'content': ack_text,
                'message_id': ack_msg.id,
                'timestamp': to_utc_isoformat(ack_msg.timestamp),
                'is_ack': True,
                'user_message_id': user_msg.id,
                'client_message_id': client_message_id
            })

        uploaded_files = []
        upload_errors = []

        if file_payloads:
            uploaded_files, upload_errors = upload_images_to_cloudinary(file_payloads)

            if uploaded_files:
                # Persist attachment metadata for conversation history
                for file_info in uploaded_files:
                    attachment = MessageAttachment(
                        message_id=user_msg.id,
                        filename=file_info["name"],
                        url=file_info["url"],
                        content_type=file_info.get("type"),
                        size_bytes=file_info.get("size")
                    )
                    db.session.add(attachment)
                db.session.commit()

                # In development mode, emit URL listing text message
                # In production, skip the text message but still emit uploaded_files for frontend attachment status update
                if not IS_PRODUCTION:
                    url_lines = [f"{item['name']}: {item['url']}" for item in uploaded_files]
                    uploads_text = "Uploaded image URLs:\n" + "\n".join(url_lines)

                    upload_msg = Message(
                        conversation_id=conversation.id,
                        sender="bot",
                        text=uploads_text
                    )
                    db.session.add(upload_msg)
                    db.session.commit()

                    emit('receive_message', {
                        'type': 'chat',
                        'role': 'assistant',
                        'content': uploads_text,
                        'message_id': upload_msg.id,
                        'timestamp': to_utc_isoformat(upload_msg.timestamp),
                        'is_ack': True,
                        'uploaded_files': uploaded_files,
                        'user_message_id': user_msg.id,
                        'client_message_id': client_message_id
                    })
                else:
                    # In production: emit uploaded_files without text message (frontend needs this to update attachment status)
                    emit('receive_message', {
                        'type': 'chat',
                        'role': 'assistant',
                        'content': '',  # Empty content - LLM will respond separately
                        'message_id': None,
                        'timestamp': get_utc_timestamp(),
                        'is_ack': True,
                        'uploaded_files': uploaded_files,
                        'user_message_id': user_msg.id,
                        'client_message_id': client_message_id
                    })

            if upload_errors:
                error_text = "Some files could not be uploaded:\n" + "\n".join(upload_errors)
                error_msg = Message(
                    conversation_id=conversation.id,
                    sender="bot",
                    text=error_text
                )
                db.session.add(error_msg)
                db.session.commit()

                emit('receive_message', {
                    'type': 'chat',
                    'role': 'assistant',
                    'content': error_text,
                    'message_id': error_msg.id,
                    'timestamp': to_utc_isoformat(error_msg.timestamp),
                    'is_ack': True,
                    'upload_errors': upload_errors,
                    'user_message_id': user_msg.id,
                    'client_message_id': client_message_id
                })
        
        user_message_for_context = user_message
        # Store base64 data for vision API (pass along with uploaded_files)
        image_base64_data = []
        if uploaded_files:
            attachment_notes = [
                f"[Attachment: {item['name']} -> {item['url']}]"
                for item in uploaded_files
            ]
            attachment_text = "\n".join(attachment_notes)
            user_message_for_context = (
                f"{user_message_for_context}\n{attachment_text}"
                if user_message_for_context
                else attachment_text
            )
            # Extract base64 data for vision API
            for item in uploaded_files:
                if item.get('base64') and item.get('type'):
                    image_base64_data.append({
                        "base64": item['base64'],
                        "mime_type": item['type']
                    })

    except Exception as e:
        logger.error(f"Database error saving message: {str(e)}", exc_info=True)
        db.session.rollback()
        emit('error', {'message': 'Failed to save message'})
        return

    # Process conversation and call AI
    try:
        # 3. Process conversation context
        filtered_history, summarization_occurred = process_conversation_context(
            conversation,
            user_message_for_context,
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
        chat_style = getattr(current_user, "chat_style", "more_english") or "more_english"
        
        # 6. Call AI
        logger.info("Processing with AI...")
        bot_reply = call_llm(
            messages,
            user_name=current_user.name if send_name else None,
            conversation_history=filtered_history,
            time_of_day=time_of_day if send_time else None,
            chat_style=chat_style,
            image_base64_data=image_base64_data if image_base64_data else None,
        )
        logger.info("AI response received")

    except Exception as e:
        logger.error(f"Error processing with AI: {str(e)}", exc_info=True)
        # Send fallback error message to client
        emit('receive_message', {
            'type': 'chat',
            'role': 'assistant',
            'content': 'Omo, something don happen for my side. Abeg try again? I dey here to help you!',
            'message_id': None,
            'timestamp': get_utc_timestamp()
        })
        return

    # Save and send response
    try:
        # 7. Handle response
        # IMPORTANT: Recommendations must NEVER be chunked - they must be sent as complete JSON structure
        # Check if bot_reply is a dict first
        if not isinstance(bot_reply, dict):
            logger.warning(f"bot_reply is not a dict, got type: {type(bot_reply)}")
            # Try to parse if it's a string
            if isinstance(bot_reply, str):
                try:
                    bot_reply = json.loads(bot_reply)
                except:
                    logger.error("Failed to parse bot_reply as JSON")
                    bot_reply = {"type": "chat", "role": "assistant", "content": str(bot_reply)}
        
        # Check for chat_and_recommendation type - send chat first, then recommendation
        if isinstance(bot_reply, dict) and bot_reply.get("type") == "chat_and_recommendation":
            chat_text = bot_reply.get("chat", "")
            recommendation = bot_reply.get("recommendation", {})
            
            if chat_text and recommendation.get("title") and recommendation.get("content"):
                logger.info(f"✅ Chat + Recommendation detected")
                logger.info(f"   Chat: {chat_text[:100]}...")
                logger.info(f"   Recommendation: {recommendation.get('title', 'N/A')}")
                
                # 1. Save and send chat message first (with chunking if long)
                should_chunk_chat = len(chat_text) > 100
                
                if should_chunk_chat:
                    chunks = split_into_chunks(chat_text, max_chunk_size=150)
                    message_group_id = str(uuid.uuid4())
                    logger.info(f"Chunking chat message: {len(chunks)} chunks")
                    
                    chunk_messages = []
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
                        chunk_messages.append(chunk_msg)
                    
                    db.session.commit()
                    
                    for i, (chunk, chunk_msg) in enumerate(zip(chunks, chunk_messages)):
                        if i > 0:
                            base_delay = 0.8
                            typing_speed = 40
                            typing_time = len(chunk) / typing_speed
                            delay = base_delay + typing_time
                            time.sleep(delay)
                        
                        is_final = i == len(chunks) - 1
                        chunk_data = {
                            'type': 'chat_chunk',
                            'role': 'assistant',
                            'chunk': chunk,
                            'chunk_index': i,
                            'total_chunks': len(chunks),
                            'is_final': is_final,
                            'message_group_id': message_group_id,
                            'message_id': chunk_msg.id,
                            'timestamp': to_utc_isoformat(chunk_msg.timestamp),
                            'recommendation_follows': is_final  # Tell frontend a recommendation is coming after final chunk
                        }
                        emit('receive_chunk', chunk_data)
                else:
                    # Short chat message
                    chat_msg = Message(
                        conversation_id=conversation.id,
                        sender="bot",
                        text=chat_text
                    )
                    db.session.add(chat_msg)
                    db.session.commit()
                    
                    emit('receive_message', {
                        'type': 'chat',
                        'role': 'assistant',
                        'content': chat_text,
                        'message_id': chat_msg.id,
                        'timestamp': to_utc_isoformat(chat_msg.timestamp),
                        'recommendation_follows': True  # Tell frontend a recommendation is coming
                    })
                
                # 2. Brief pause to show "Keji is thinking" animation before recommendation
                time.sleep(pause_before_recommendation)
                
                # 3. Send recommendation (not saved to DB until accepted)
                recommendation_data = {
                    "type": "recommendation",
                    "role": "assistant",
                    "title": recommendation.get("title"),
                    "content": recommendation.get("content"),
                    "health": recommendation.get("health", [])
                }
                emit('receive_recommendation', recommendation_data)
                logger.info("   Chat + Recommendation both sent successfully")
                return  # Exit early
            else:
                logger.warning("Incomplete chat_and_recommendation, falling back")
                # Fallback: if we have recommendation, use it; otherwise use chat
                if recommendation.get("title") and recommendation.get("content"):
                    bot_reply = {"type": "recommendation", "role": "assistant", **recommendation}
                elif chat_text:
                    bot_reply = {"type": "chat", "role": "assistant", "content": chat_text}
                else:
                    bot_reply = {"type": "chat", "role": "assistant", "content": "How can I help you?"}
        
        # Check for recommendation type - MUST be checked before any chunking logic
        if isinstance(bot_reply, dict) and bot_reply.get("type") == "recommendation":
            # Validate recommendation structure before emitting
            if "title" in bot_reply and "content" in bot_reply:
                # Don't save to DB yet, wait for user acceptance
                # NEVER chunk recommendations - send complete structure immediately
                logger.info(f"✅ Recommendation detected: {bot_reply.get('title', 'N/A')} (length: {len(str(bot_reply))} chars - NOT chunking)")
                logger.info(f"   Recommendation structure: type={bot_reply.get('type')}, has_title={bool(bot_reply.get('title'))}, has_content={bool(bot_reply.get('content'))}")
                emit('receive_recommendation', bot_reply)
                logger.info("   Recommendation emitted successfully - exiting early")
                return  # Exit early - don't process as chat message
            else:
                logger.error(f"❌ Invalid recommendation structure: missing title or content. Got keys: {list(bot_reply.keys())}")
                # Fallback to chat response
                reply_text = bot_reply.get("content", "Here's a food suggestion for you.")
                # Continue with normal chat flow
                bot_reply = {"type": "chat", "role": "assistant", "content": reply_text}
        
        # Double-check: If somehow we still have a recommendation here, log error and send it properly
        if isinstance(bot_reply, dict) and bot_reply.get("type") == "recommendation":
            logger.error("🚨 CRITICAL: Recommendation reached chunking section - this should NEVER happen!")
            logger.error(f"   Recommendation: {bot_reply.get('title', 'N/A')}")
            if "title" in bot_reply and "content" in bot_reply:
                emit('receive_recommendation', bot_reply)
                return
            
        # Normal chat: save and send (with chunking for long messages)
        # NOTE: Recommendations are handled above and return early, so this code only runs for chat messages
        reply_text = bot_reply.get("content") if isinstance(bot_reply, dict) else str(bot_reply)
        
        if not reply_text:
            logger.warning("Empty reply from AI, using fallback")
            reply_text = "Yeah, how can I help you?"
        
        # Decide if we should chunk this message (ONLY for chat messages - recommendations never reach here)
        should_chunk = len(reply_text) > 100
        
        if should_chunk:
            # Split into chunks and save each chunk
            chunks = split_into_chunks(reply_text, max_chunk_size=150)
            message_group_id = str(uuid.uuid4())
            logger.info(f"Chunking message: {len(chunks)} chunks, group ID: {message_group_id}")
            
            # Save all chunks to database
            chunk_messages = []
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
                chunk_messages.append(chunk_msg)
            
            db.session.commit()
            logger.info(f"All {len(chunks)} chunks saved to database")
            
            # Send chunks to client with delays based on text length
            for i, (chunk, chunk_msg) in enumerate(zip(chunks, chunk_messages)):
                # Calculate delay based on chunk length (simulate realistic typing)
                if i > 0:
                    # Base delay (thinking/pause between sentences) + typing time
                    base_delay = 0.8
                    typing_speed = 40  # characters per second (realistic fast typing)
                    typing_time = len(chunk) / typing_speed
                    delay = base_delay + typing_time
                    
                    logger.debug(f"Chunk {i+1}/{len(chunks)}: {len(chunk)} chars, waiting {delay:.2f}s")
                    time.sleep(delay)
                
                chunk_data = {
                    'type': 'chat_chunk',
                    'role': 'assistant',
                    'chunk': chunk,
                    'chunk_index': i,
                    'total_chunks': len(chunks),
                    'is_final': i == len(chunks) - 1,
                    'message_group_id': message_group_id,
                    'message_id': chunk_msg.id,
                    'timestamp': to_utc_isoformat(chunk_msg.timestamp)
                }
                emit('receive_chunk', chunk_data)
                logger.debug(f"Chunk {i+1}/{len(chunks)} sent")
            
            logger.info(f"All {len(chunks)} chunks sent to client")
            
        else:
                # Short message - save as single message and send immediately
                bot_msg = Message(
                    conversation_id=conversation.id,
                    sender="bot",
                    text=reply_text
                )
                db.session.add(bot_msg)
                db.session.commit()
                
                # Send message to client
                message_data = {
                    'type': 'chat',
                    'role': 'assistant',
                    'content': reply_text,
                    'message_id': bot_msg.id,
                    'timestamp': to_utc_isoformat(bot_msg.timestamp)
                }
                emit('receive_message', message_data)
                logger.info("Message sent to client")
        
    except Exception as e:
        logger.error(f"Error saving/sending response: {str(e)}", exc_info=True)
        db.session.rollback()
        # Still try to send the message even if save failed
        try:
            reply_text = bot_reply.get("content", "Yeah, how can I help you?") if isinstance(bot_reply, dict) else str(bot_reply)
            emit('receive_message', {
                'type': 'chat',
                'role': 'assistant',
                'content': reply_text,
                'message_id': None,
                'timestamp': get_utc_timestamp()
            })
        except:
            emit('error', {'message': 'Failed to process message'})


@socketio.on('accept_recommendation')
def handle_accept_recommendation(data):
    """
    Handle user accepting a food recommendation
    
    Expected data format:
    {
        'title': str,
        'content': str,
        'userMessage': str
    }
    """
    try:
        # Validate authentication
        if not current_user.is_authenticated:
            emit('error', {'message': 'Not authenticated'})
            return
        
        # Validate data
        if not data or not isinstance(data, dict):
            emit('error', {'message': 'Invalid data format'})
            return
        
        title = data.get("title")
        content = data.get("content")
        user_message = data.get("userMessage", f"Thanks, I'm eating {title}")
        
        if not title:
            emit('error', {'message': 'Missing title'})
            return
        
        logger.info(f"Accepting recommendation: {title} (User: {current_user.name})")

    except Exception as e:
        logger.error(f"Error validating recommendation: {str(e)}", exc_info=True)
        emit('error', {'message': 'Invalid request'})
        return

    try:
        # Find latest conversation
        conversation = Conversation.query.filter_by(user_id=current_user.id)\
            .order_by(Conversation.id.desc()).first()
        
        if not conversation:
            logger.warning("No conversation found for recommendation")
            emit('error', {'message': 'No conversation found'})
            return

        # Save AI recommendation as a bot message (just the title, no health benefits)
        bot_msg = Message(
            conversation_id=conversation.id,
            sender="bot",
            text=title
        )
        db.session.add(bot_msg)
        
        # Save user's acceptance message as a user message
        user_msg = Message(
            conversation_id=conversation.id,
            sender="user",
            text=user_message
        )
        db.session.add(user_msg)
        
        db.session.commit()
        
        logger.info(f"Recommendation accepted and saved: AI='{title}', User='{user_message}'")

        # Confirm to client that messages were saved
        emit('recommendation_saved', {
            'status': 'saved',
            'bot_message_id': bot_msg.id,
            'user_message_id': user_msg.id,
            'timestamp': to_utc_isoformat(bot_msg.timestamp)
        })
        
    except Exception as e:
        logger.error(f"Database error saving recommendation: {str(e)}", exc_info=True)
        db.session.rollback()
        emit('error', {'message': 'Failed to save recommendation'})
        return

    # Now process the user's acceptance through normal AI flow for a response
    try:
        logger.info("Processing acceptance through AI for confirmation response...")
        
        # Get conversation history for context
        filtered_history = process_conversation_context(conversation, user_message, db.session)[0]
        
        # Get user's chat style preference
        chat_style = current_user.chat_style if hasattr(current_user, 'chat_style') else None
        
        # Build messages for AI context
        messages = [{"role": "user", "content": user_message}]
        
        # Call AI to generate a confirmation response
        bot_reply = call_llm(
            messages,
            user_name=current_user.name,
            conversation_history=filtered_history,
            chat_style=chat_style,
        )
        
        # Get the response text
        reply_text = bot_reply.get("content") if isinstance(bot_reply, dict) else str(bot_reply)
        
        if not reply_text:
            reply_text = "Great choice! Enjoy your meal!"
        
        # Save AI confirmation response
        confirmation_msg = Message(
            conversation_id=conversation.id,
            sender="bot",
            text=reply_text
        )
        db.session.add(confirmation_msg)
        db.session.commit()
        
        logger.info(f"AI confirmation saved: '{reply_text[:50]}...'")
        
        # Send AI confirmation to client
        emit('receive_message', {
            'type': 'chat',
            'role': 'assistant',
            'content': reply_text,
            'message_id': confirmation_msg.id,
            'timestamp': to_utc_isoformat(confirmation_msg.timestamp)
        })
        
    except Exception as e:
        logger.error(f"Error generating AI confirmation: {str(e)}", exc_info=True)
        # Don't fail the whole flow, just log the error


@socketio.on('request_history')
def handle_request_history():
    """Send chat history to client"""
    try:
        # Validate authentication
        if not current_user.is_authenticated:
            emit('error', {'message': 'Not authenticated'})
            return
        
        logger.info(f"Chat history requested by {current_user.name} (ID: {current_user.id})")
        
    except Exception as e:
        logger.error(f"Error validating history request: {str(e)}", exc_info=True)
        emit('error', {'message': 'Invalid request'})
        return
    
    try:
        # Get latest conversation for this user
        conversation = Conversation.query.filter_by(user_id=current_user.id)\
            .order_by(Conversation.id.desc()).first()

        if not conversation:
            emit('chat_history', {'messages': []})
            return
        
        # Get full history using context manager
        full_history = get_full_history_for_frontend(conversation.id)
        logger.info(f"Retrieved {len(full_history)} messages")

        # Send history to client
        emit('chat_history', {
            'messages': full_history,
            'has_summary': conversation.memory_summary is not None,
            'summarized_count': conversation.pruned_count or 0
        })
        
    except Exception as e:
        logger.error(f"Database error retrieving history: {str(e)}", exc_info=True)
        # Send empty history on error to prevent frontend from hanging
        emit('chat_history', {'messages': [], 'error': 'Failed to retrieve history'})

