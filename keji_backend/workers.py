"""
Background Workers for Keji AI

This module contains background jobs that run independently of user requests:
1. Summary Generation Worker - Generates conversation summaries for all users
2. Daily Chat Clearing Worker - Clears old chats at 11:59 PM daily

NOTE: OpenAI calls use eventlet.tpool.execute() to avoid SSL issues with eventlet's monkey patching.
"""

import logging
from datetime import datetime, timedelta
from openai import OpenAI
import os

logger = logging.getLogger(__name__)

# ==================== CONFIGURATION ====================

SUMMARY_WORKER_INTERVAL_MINUTES = 10  # How often to run summary worker
TOKEN_THRESHOLD_FOR_SUMMARY = 2000   # Token count to trigger summary
RECENT_MESSAGES_TO_KEEP = 10         # Keep these recent, summarize older
MODEL_FOR_SUMMARY = "gpt-4o-mini"    # Cheap model for summarization


# ==================== HELPER FUNCTIONS ====================

def _openai_in_thread(func):
    """
    Wrapper to run OpenAI calls in real threads (bypasses eventlet SSL issues).
    APScheduler jobs may still be affected by eventlet's monkey patching,
    so we use tpool to ensure clean SSL context.
    """
    import eventlet.tpool
    return eventlet.tpool.execute(func)


def _get_openai_client():
    """Create OpenAI client in thread context (fresh SSL, no eventlet patch)"""
    return OpenAI()


def count_tokens_simple(text: str) -> int:
    """Simple token estimation: ~3.5 characters per token"""
    if not text:
        return 0
    return max(int(len(str(text)) / 3.5), 1)


def count_messages_tokens(messages: list) -> int:
    """Count total tokens in a list of message dicts"""
    total = 0
    for msg in messages:
        total += count_tokens_simple(msg.get('content', '')) + 4  # overhead
    return total


def generate_summary_sync(messages: list, existing_summary: str = None) -> str:
    """
    Generate a concise summary of conversation messages using OpenAI.
    This is a synchronous function meant to be called from background workers.
    Uses eventlet.tpool to avoid SSL issues.
    
    Args:
        messages: List of messages to summarize
        existing_summary: Previous summary to build upon (optional)
    
    Returns:
        str: Concise summary of the conversation
    """
    logger.info(f"Generating summary for {len(messages)} messages...")
    
    # Build conversation text
    conversation_text = "\n".join([
        f"{msg['role'].upper()}: {msg['content']}"
        for msg in messages
    ])
    
    # Create summary prompt
    if existing_summary:
        summary_prompt = f"""You are a conversation summarizer for a Nigerian food recommendation AI.

EXISTING SUMMARY:
{existing_summary}

NEW MESSAGES:
{conversation_text}

Create a concise, updated summary that:
1. Incorporates key information from both the existing summary and new messages
2. Ensure the order of the messages is preserved in the summary.
3. Focuses on: user food preferences, dietary restrictions, budgets, what they ate today (breakfast/lunch/dinner/snacks)
4. Keeps it under 200 words
5. Is written in third person (e.g., "The user mentioned...")
. IMPORTANT: Track what the user has eaten TODAY to help with variety recommendations

Updated Summary:"""
    else:
        summary_prompt = f"""You are a conversation summarizer for a Nigerian food recommendation AI.

CONVERSATION:
{conversation_text}

Create a brief summary that:
1. Captures key user food preferences, dietary needs, budgets
2. Tracks what the user has eaten TODAY (breakfast, lunch, dinner, snacks)
3. Keeps it under 150 words
4. Is written in third person (e.g., "The user mentioned...")

Summary:"""
    
    def _call():
        """Run in real thread with fresh OpenAI client - bypasses eventlet SSL"""
        try:
            client = _get_openai_client()
            response = client.chat.completions.create(
                model=MODEL_FOR_SUMMARY,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that creates concise conversation summaries focused on food preferences and daily eating patterns."},
                    {"role": "user", "content": summary_prompt}
                ],
                temperature=0.3,
                max_tokens=300
            )
            # Extract content before returning (avoids greenlet issues)
            if response and hasattr(response, 'choices') and response.choices:
                return {"success": True, "content": response.choices[0].message.content.strip()}
            return {"success": False, "error": "No response from OpenAI"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    try:
        result = _openai_in_thread(_call)
        
        if result.get("success"):
            summary = result.get("content", "")
            logger.info(f"Summary generated: {count_tokens_simple(summary)} tokens")
            return summary
        else:
            logger.error(f"Error generating summary: {result.get('error')}")
            return f"Conversation covering {len(messages)} messages about food recommendations and preferences."
        
    except Exception as e:
        logger.error(f"Error generating summary: {e}")
        # Fallback
        return f"Conversation covering {len(messages)} messages about food recommendations and preferences."


# ==================== SUMMARY GENERATION WORKER ====================

def run_summary_worker(app):
    """
    Background worker that processes all conversations needing summarization.
    
    This runs periodically and:
    1. Finds all conversations with enough messages to warrant summarization
    2. Generates summaries for older messages
    3. Updates the conversation's memory_summary field
    
    Benefits:
    - Removes summarization latency from the chat response path
    - Runs on a small model (gpt-4o-mini) to save costs
    - Processes all users' conversations in one batch
    """
    with app.app_context():
        from models import Conversation, Message
        from extensions import db
        
        logger.info("=" * 60)
        logger.info("🔄 SUMMARY WORKER: Starting background summarization...")
        
        try:
            # Get all conversations with messages
            conversations = Conversation.query.all()
            processed = 0
            summarized = 0
            
            for conversation in conversations:
                try:
                    # Get all messages for this conversation
                    messages = Message.query.filter_by(conversation_id=conversation.id)\
                        .order_by(Message.timestamp.asc()).all()
                    
                    if len(messages) <= RECENT_MESSAGES_TO_KEEP:
                        # Not enough messages to summarize
                        continue
                    
                    processed += 1
                    
                    # Convert to dict format
                    message_dicts = []
                    for msg in messages:
                        content = msg.text or ""
                        message_dicts.append({
                            "role": msg.sender if msg.sender != "bot" else "assistant",
                            "content": content
                        })
                    
                    # Calculate tokens
                    history_tokens = count_messages_tokens(message_dicts)
                    summary_tokens = count_tokens_simple(conversation.memory_summary or "")
                    total_tokens = history_tokens + summary_tokens
                    
                    # Check if summarization is needed
                    if total_tokens < TOKEN_THRESHOLD_FOR_SUMMARY:
                        logger.debug(f"Conversation {conversation.id}: {total_tokens} tokens (under threshold)")
                        continue
                    
                    # Get messages to summarize (older messages, keep recent)
                    messages_to_summarize = message_dicts[:-RECENT_MESSAGES_TO_KEEP]
                    
                    if not messages_to_summarize:
                        continue
                    
                    logger.info(f"Conversation {conversation.id}: Summarizing {len(messages_to_summarize)} messages...")
                    
                    # Generate new summary
                    new_summary = generate_summary_sync(
                        messages_to_summarize,
                        existing_summary=conversation.memory_summary
                    )
                    
                    # Update conversation
                    conversation.memory_summary = new_summary
                    conversation.pruned_count = len(messages_to_summarize)
                    conversation.last_summary_at = datetime.now()
                    db.session.commit()
                    
                    summarized += 1
                    logger.info(f"✅ Conversation {conversation.id}: Summary updated ({count_tokens_simple(new_summary)} tokens)")
                    
                except Exception as e:
                    logger.error(f"Error processing conversation {conversation.id}: {e}")
                    db.session.rollback()
                    continue
            
            logger.info(f"🔄 SUMMARY WORKER: Complete. Processed {processed}, Summarized {summarized}")
            logger.info("=" * 60)
            
        except Exception as e:
            logger.error(f"Summary worker error: {e}", exc_info=True)


# ==================== DAILY CHAT CLEARING WORKER ====================

def run_daily_chat_clearing(app):
    """
    Background worker that clears chat history at 11:59 PM daily.
    
    Rules:
    - Only clears conversations where the last message was more than 10 minutes ago
    - This ensures active chats are not interrupted
    - Clears messages and resets summary, but keeps the conversation record
    
    This supports the "DAILY MEMORY" feature where the AI should start fresh
    each day to provide variety in recommendations.
    """
    with app.app_context():
        from models import Conversation, Message, MessageAttachment
        from extensions import db
        
        logger.info("=" * 60)
        logger.info("🧹 DAILY CHAT CLEARING: Starting nightly cleanup...")
        
        try:
            # Get current time and threshold (10 minutes ago)
            now = datetime.now()
            threshold = now - timedelta(minutes=10)
            
            # Get all conversations
            conversations = Conversation.query.all()
            cleared = 0
            skipped_active = 0
            
            for conversation in conversations:
                try:
                    # Get the most recent message for this conversation
                    latest_message = Message.query.filter_by(conversation_id=conversation.id)\
                        .order_by(Message.timestamp.desc()).first()
                    
                    if not latest_message:
                        # No messages, skip
                        continue
                    
                    # Check if last message was more than 10 minutes ago
                    if latest_message.timestamp > threshold:
                        # Active conversation, skip
                        skipped_active += 1
                        logger.debug(f"Conversation {conversation.id}: Active (last msg at {latest_message.timestamp}), skipping")
                        continue
                    
                    logger.info(f"Conversation {conversation.id}: Clearing (last msg at {latest_message.timestamp})...")
                    
                    # Delete all message attachments first (due to foreign key)
                    messages = Message.query.filter_by(conversation_id=conversation.id).all()
                    for msg in messages:
                        MessageAttachment.query.filter_by(message_id=msg.id).delete()
                    
                    # Delete all messages for this conversation
                    Message.query.filter_by(conversation_id=conversation.id).delete()
                    
                    # Reset conversation summary
                    conversation.memory_summary = None
                    conversation.pruned_count = 0
                    conversation.last_summary_at = None
                    
                    db.session.commit()
                    cleared += 1
                    logger.info(f"✅ Conversation {conversation.id}: Cleared")
                    
                except Exception as e:
                    logger.error(f"Error clearing conversation {conversation.id}: {e}")
                    db.session.rollback()
                    continue
            
            logger.info(f"🧹 DAILY CHAT CLEARING: Complete. Cleared {cleared}, Skipped active {skipped_active}")
            logger.info("=" * 60)
            
        except Exception as e:
            logger.error(f"Daily chat clearing error: {e}", exc_info=True)


# ==================== SCHEDULER REGISTRATION ====================

def register_workers(scheduler, app):
    """
    Register all background workers with the scheduler.
    
    Args:
        scheduler: APScheduler BackgroundScheduler instance
        app: Flask app instance (for context)
    """
    from datetime import time
    
    # 1. Summary Generation Worker - runs every 5 minutes
    scheduler.add_job(
        func=lambda: run_summary_worker(app),
        trigger='interval',
        minutes=SUMMARY_WORKER_INTERVAL_MINUTES,
        id='summary_worker',
        name='Background Summary Generation',
        replace_existing=True
    )
    logger.info(f"✅ Registered: Summary worker (every {SUMMARY_WORKER_INTERVAL_MINUTES} minutes)")
    
    # 2. Daily Chat Clearing - runs at 11:59 PM every day
    scheduler.add_job(
        func=lambda: run_daily_chat_clearing(app),
        trigger='cron',
        hour=23,
        minute=59,
        id='daily_chat_clearing',
        name='Daily Chat Clearing (11:59 PM)',
        replace_existing=True
    )
    logger.info("✅ Registered: Daily chat clearing (11:59 PM)")
    
    # Run summary worker once on startup (after 30 seconds delay)
    scheduler.add_job(
        func=lambda: run_summary_worker(app),
        trigger='date',
        run_date=datetime.now() + timedelta(seconds=30),
        id='summary_worker_startup',
        name='Summary Worker Initial Run',
        replace_existing=True
    )
    logger.info("✅ Scheduled: Initial summary worker run (in 30 seconds)")

