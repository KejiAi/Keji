"""
Context Manager for Conversation History Management

This module handles:
- Token counting for messages
- Smart message filtering for OpenAI API calls
- Maintaining full history in database while sending only recent context

NOTE: Summarization is now handled by background workers (workers.py)
to avoid adding latency to chat responses.
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


def to_utc_isoformat(dt):
    """Convert a datetime to ISO format with 'Z' suffix for proper JS parsing."""
    if dt is None:
        return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    if dt.tzinfo is None:
        return dt.isoformat() + 'Z'
    return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')

# Configuration
RECENT_MESSAGES_COUNT = 10  # Number of recent messages to include (5 user + 5 bot turns)
MODEL_FOR_CHAT = "gpt-5.2"   # Main model for chat - best for coding and agentic tasks (used by get_response.py)

def count_tokens(text: str, model: str = "gpt-4o") -> int:
    """
    Count the number of tokens in a text string using character-based estimation.
    
    Args:
        text: The text to count tokens for
        model: The model to use for tokenization (default: gpt-4)
    
    Returns:
        int: Number of tokens
    """
    # Handle None and empty
    if text is None:
        return 0
    
    # Ensure it's a string
    if not isinstance(text, str):
        try:
            text = str(text)
        except Exception as e:
            logger.warning(f"Cannot convert to string: {type(text)} - {e}")
            return 100
    
    if not text:
        return 0
    
    # Use character-based estimation (more reliable than tiktoken in eventlet)
    # English text: ~4 characters per token
    # More conservative: 3.5 characters per token for safety
    return max(len(text) // 3.5, 1)


def count_messages_tokens(messages: List[Dict[str, str]]) -> int:
    """
    Count total tokens in a list of messages.
    
    Args:
        messages: List of message dicts with 'role' and 'content'
    
    Returns:
        int: Total token count
    """
    total = 0
    for msg in messages:
        # Account for message structure overhead (role, etc.)
        total += count_tokens(msg.get('content', '')) + 4
    return total



def filter_messages_for_llm(
    all_messages: List[Dict[str, str]],
    memory_summary: Optional[str] = None,
    recent_count: int = RECENT_MESSAGES_COUNT
) -> List[Dict[str, str]]:
    """
    Filter messages to send to OpenAI API.
    Returns: system message + memory summary (if exists) + recent N messages
    
    Args:
        all_messages: Complete message history from database
        memory_summary: Existing conversation summary
        recent_count: Number of recent messages to include
    
    Returns:
        List of messages to send to OpenAI (excluding system prompt, which is added separately)
    """
    logger.debug(f"📋 Filtering {len(all_messages)} messages for LLM...")
    
    filtered = []
    
    # Add memory summary as a system context message if it exists
    if memory_summary:
        filtered.append({
            "role": "system",
            "content": f"CONVERSATION CONTEXT (Summary of earlier messages):\n{memory_summary}"
        })
        logger.debug(f"Added memory summary ({count_tokens(memory_summary)} tokens)")
    
    # Add recent N messages
    recent_messages = all_messages[-recent_count:] if len(all_messages) > recent_count else all_messages
    filtered.extend(recent_messages)
    
    logger.info(f"Filtered to {len(filtered)} messages (summary: {1 if memory_summary else 0}, recent: {len(recent_messages)})")
    logger.debug(f"   Total tokens: {count_messages_tokens(filtered)}")
    
    return filtered


def process_conversation_context(
    conversation: 'Conversation',
    new_user_message: str,
    db_session
) -> Tuple[List[Dict[str, str]], bool]:
    """
    Process conversation context for LLM calls.
    
    NOTE: Summarization is now handled by background workers (workers.py)
    to avoid adding latency to chat responses. This function only:
    1. Gets recent messages from database
    2. Includes existing memory_summary if available
    3. Returns filtered messages for LLM
    
    Args:
        conversation: Conversation model instance
        new_user_message: The new message from user
        db_session: Database session (not used for writes anymore)
    
    Returns:
        Tuple of (filtered_messages_for_llm, False)
        Second value is always False since we don't summarize inline anymore
    """
    logger.info("Processing conversation context")
    
    # Get all messages from database
    from models import Message
    all_messages = Message.query.filter_by(conversation_id=conversation.id)\
        .order_by(Message.timestamp.asc()).all()
    
    # Convert to dict format
    message_dicts = []
    for msg in all_messages:
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

        message_dicts.append({
            "role": msg.sender if msg.sender != "bot" else "assistant",
            "content": content
        })
    
    logger.info(f"Total messages in history: {len(message_dicts)}")
    if conversation.memory_summary:
        logger.info(f"Using existing summary (covers {conversation.pruned_count} messages)")
    
    # Filter messages for LLM (includes memory_summary if available)
    filtered_messages = filter_messages_for_llm(
        message_dicts,
        memory_summary=conversation.memory_summary,
        recent_count=RECENT_MESSAGES_COUNT
    )
    
    logger.debug(f"Context ready: {len(filtered_messages)} messages for LLM")
    
    # Always return False - summarization is handled by background workers
    return filtered_messages, False


def get_full_history_for_frontend(conversation_id: int) -> List[Dict[str, str]]:
    """
    Retrieve full conversation history for frontend display.
    This always returns ALL messages, never filtered.
    Includes chunking metadata for messages that were sent in chunks.
    
    Args:
        conversation_id: ID of the conversation
    
    Returns:
        List of all messages with sender, text, timestamp, and optional chunk metadata
    """
    from models import Message
    
    messages = Message.query.filter_by(conversation_id=conversation_id)\
        .order_by(Message.timestamp.asc()).all()
    
    logger.debug(f"Retrieved {len(messages)} messages for frontend")
    
    result = []
    for msg in messages:
        message_data = {
            "message_id": msg.id,
            "sender": msg.sender,
            "text": msg.text,
            "timestamp": to_utc_isoformat(msg.timestamp)
        }

        attachments = getattr(msg, "attachments", []) or []
        if attachments:
            message_data["attachments"] = [
                {
                    "name": attachment.filename,
                    "url": attachment.url,
                    "type": attachment.content_type,
                    "size": attachment.size_bytes
                }
                for attachment in attachments
            ]
        
        # Include chunking metadata if this message is part of a chunk
        if msg.message_group_id:
            message_data.update({
                "message_group_id": msg.message_group_id,
                "chunk_index": msg.chunk_index,
                "total_chunks": msg.total_chunks,
                "is_chunked": True
            })
        else:
            message_data["is_chunked"] = False
        
        result.append(message_data)
    
    return result


# Configuration getters (can be overridden via environment variables)
def get_recent_messages_count() -> int:
    """Get the number of recent messages to keep."""
    import os
    return int(os.getenv("CHAT_RECENT_MESSAGES", RECENT_MESSAGES_COUNT))

