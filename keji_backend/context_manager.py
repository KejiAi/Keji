"""
Context Manager for Conversation History Management

This module handles:
- Token counting for messages
- Memory summarization when history grows too large
- Smart message filtering for OpenAI API calls
- Maintaining full history in database while sending only recent context
"""

import tiktoken
import logging
from datetime import datetime
from openai import OpenAI
import json
from typing import List, Dict, Optional, Tuple
import httpx

logger = logging.getLogger(__name__)

# Initialize OpenAI client with custom httpx to bypass eventlet SSL issues
http_client = httpx.Client(timeout=60.0)
client = OpenAI(http_client=http_client)

def _openai_in_thread(func):
    """Wrapper to run OpenAI calls in real threads (bypasses eventlet SSL)"""
    import eventlet.tpool
    return eventlet.tpool.execute(func)

# Configuration
TOKEN_THRESHOLD = 3000  # When to trigger summarization (leave room for response)
RECENT_MESSAGES_COUNT = 10  # Number of recent messages to include (5 user + 5 bot turns)
MODEL_FOR_SUMMARY = "gpt-4o-mini"  # Cheaper model for summarization
MODEL_FOR_CHAT = "gpt-5"  # Main model for chat

def count_tokens(text: str, model: str = "gpt-4") -> int:
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


def generate_summary(messages: List[Dict[str, str]], existing_summary: Optional[str] = None) -> str:
    """
    Generate a concise summary of conversation messages using OpenAI.
    
    Args:
        messages: List of messages to summarize (user/bot exchanges)
        existing_summary: Previous summary to build upon (optional)
    
    Returns:
        str: Concise summary of the conversation
    """
    logger.info("Generating conversation summary...")
    logger.debug(f"Summarizing {len(messages)} messages")
    
    # Build conversation text
    conversation_text = "\n".join([
        f"{msg['role'].upper()}: {msg['content']}"
        for msg in messages
    ])
    
    # Create summary prompt
    if existing_summary:
        summary_prompt = f"""You are a conversation summarizer. You have an existing summary and new messages to add to it.

EXISTING SUMMARY:
{existing_summary}

NEW MESSAGES:
{conversation_text}

Create a concise, updated summary that:
1. Incorporates key information from both the existing summary and new messages
2. Focuses on user preferences, dietary needs, budgets mentioned, and important context
3. Keeps it under 200 words
4. Maintains chronological flow
5. Is written in third person (e.g., "The user mentioned...")

Updated Summary:"""
    else:
        summary_prompt = f"""You are a conversation summarizer. Summarize this conversation concisely.

CONVERSATION:
{conversation_text}

Create a brief summary that:
1. Captures key user preferences, dietary needs, budgets, and important context
2. Keeps it under 150 words
3. Focuses on information useful for future food recommendations
4. Is written in third person (e.g., "The user mentioned...")

Summary:"""
    
    try:
        def _call():
            """Run in real thread"""
            return client.chat.completions.create(
                model=MODEL_FOR_SUMMARY,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that creates concise conversation summaries."},
                    {"role": "user", "content": summary_prompt}
                ],
                temperature=0.3,  # Lower temperature for more focused summaries
                max_tokens=300
            )
        
        response = _openai_in_thread(_call)
        summary = response.choices[0].message.content.strip()
        logger.info(f"Summary generated ({count_tokens(summary)} tokens)")
        logger.debug(f"Summary preview: {summary[:100]}...")
        
        return summary
        
    except Exception as e:
        logger.error(f"Error generating summary: {e}")
        # Fallback: create basic summary
        return f"Conversation covering {len(messages)} messages about food recommendations and dietary preferences."


def should_summarize(
    history_tokens: int,
    summary_tokens: int,
    new_message_tokens: int,
    threshold: int = TOKEN_THRESHOLD
) -> bool:
    """
    Determine if conversation history should be summarized.
    
    Args:
        history_tokens: Tokens in current message history
        summary_tokens: Tokens in existing summary (0 if none)
        new_message_tokens: Tokens in new user message
        threshold: Token threshold to trigger summarization
    
    Returns:
        bool: True if summarization should be triggered
    """
    total = history_tokens + summary_tokens + new_message_tokens
    should_trigger = total > threshold
    
    if should_trigger:
        logger.warning(f"Token threshold exceeded: {total} > {threshold}, summarization needed")
    else:
        logger.debug(f"Token count within limits: {total}/{threshold}")
    
    return should_trigger


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
    Process conversation context and determine if summarization is needed.
    
    Args:
        conversation: Conversation model instance
        new_user_message: The new message from user
        db_session: Database session for updates
    
    Returns:
        Tuple of (filtered_messages_for_llm, summarization_occurred)
    """
    logger.info("Processing conversation context")
    
    # Get all messages from database
    from models import Message
    all_messages = Message.query.filter_by(conversation_id=conversation.id)\
        .order_by(Message.timestamp.asc()).all()
    
    # Convert to dict format
    message_dicts = [
        {"role": msg.sender if msg.sender != "bot" else "assistant", "content": msg.text}
        for msg in all_messages
    ]
    
    logger.info(f"Total messages in history: {len(message_dicts)}")
    if conversation.memory_summary:
        logger.info(f"Existing summary: {conversation.pruned_count} messages")
    
    # Calculate tokens
    history_tokens = count_messages_tokens(message_dicts)
    summary_tokens = count_tokens(conversation.memory_summary or "")
    new_message_tokens = count_tokens(new_user_message)
    
    logger.debug(f"🔢 Token breakdown:")
    logger.debug(f"   History: {history_tokens}")
    logger.debug(f"   Summary: {summary_tokens}")
    logger.debug(f"   New message: {new_message_tokens}")
    logger.debug(f"   Total: {history_tokens + summary_tokens + new_message_tokens}")
    
    # Check if summarization is needed
    summarization_occurred = False
    if should_summarize(history_tokens, summary_tokens, new_message_tokens):
        logger.info("Triggering summarization...")
        
        # Determine which messages to summarize
        # Keep recent messages, summarize older ones
        if len(message_dicts) > RECENT_MESSAGES_COUNT:
            messages_to_summarize = message_dicts[:-RECENT_MESSAGES_COUNT]
            logger.info(f"Summarizing {len(messages_to_summarize)} older messages")
            
            # Generate new summary
            new_summary = generate_summary(
                messages_to_summarize,
                existing_summary=conversation.memory_summary
            )
            
            # Update conversation with new summary
            conversation.memory_summary = new_summary
            conversation.pruned_count = len(messages_to_summarize)
            conversation.last_summary_at = datetime.now()
            db_session.commit()
            
            logger.info(f"Summary updated: {conversation.pruned_count} messages compressed")
            logger.info(f"   Summary size: {count_tokens(new_summary)} tokens")
            summarization_occurred = True
        else:
            logger.warning("Not enough messages to summarize, keeping all recent")
    
    # Filter messages for LLM
    filtered_messages = filter_messages_for_llm(
        message_dicts,
        memory_summary=conversation.memory_summary,
        recent_count=RECENT_MESSAGES_COUNT
    )
    
    logger.info("="*60 + "\n")
    
    return filtered_messages, summarization_occurred


def get_full_history_for_frontend(conversation_id: int) -> List[Dict[str, str]]:
    """
    Retrieve full conversation history for frontend display.
    This always returns ALL messages, never filtered.
    
    Args:
        conversation_id: ID of the conversation
    
    Returns:
        List of all messages with sender, text, and timestamp
    """
    from models import Message
    
    messages = Message.query.filter_by(conversation_id=conversation_id)\
        .order_by(Message.timestamp.asc()).all()
    
    logger.debug(f"Retrieved {len(messages)} messages for frontend")
    
    return [
        {
            "sender": msg.sender,
            "text": msg.text,
            "timestamp": msg.timestamp.isoformat()
        }
        for msg in messages
    ]


# Configuration getters (can be overridden via environment variables)
def get_token_threshold() -> int:
    """Get the token threshold for summarization."""
    import os
    return int(os.getenv("CHAT_TOKEN_THRESHOLD", TOKEN_THRESHOLD))


def get_recent_messages_count() -> int:
    """Get the number of recent messages to keep."""
    import os
    return int(os.getenv("CHAT_RECENT_MESSAGES", RECENT_MESSAGES_COUNT))

