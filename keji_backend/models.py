from extensions import db
from datetime import datetime, timezone
import logging

# Create logger for this module
logger = logging.getLogger(__name__)


def utc_now():
    """Return current UTC time for consistent timestamp handling."""
    return datetime.now(timezone.utc)


class User(db.Model):
    """
    User model for storing user data.
    
    Note: Authentication is handled by Supabase. This model stores:
    - Local user data (chat_style, etc.)
    - Foreign key relationships (conversations, messages)
    - Sync with Supabase via supabase_id
    """
    id = db.Column(db.Integer, primary_key=True)
    supabase_id = db.Column(db.String(36), unique=True, nullable=True, index=True)  # UUID from Supabase
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    chat_style = db.Column(db.String(50), default="pure_english")
    is_verified = db.Column(db.Boolean, default=True)  # Supabase handles verification
    created_at = db.Column(db.DateTime, default=utc_now)
    
    # Legacy fields (kept for backward compatibility, can be removed later)
    password_hash = db.Column(db.String(256), nullable=True)  # No longer used with Supabase
    verification_code = db.Column(db.String(6), nullable=True)  # No longer used
    verification_token = db.Column(db.String(255), nullable=True)  # No longer used
    
class Conversation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now)
    memory_summary = db.Column(db.Text, nullable=True)  # Compressed summary of older messages
    pruned_count = db.Column(db.Integer, default=0)  # Number of messages that have been summarized
    last_summary_at = db.Column(db.DateTime, nullable=True)  # When summary was last updated

    messages = db.relationship("Message", backref="conversation", lazy=True)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversation.id"), nullable=False)
    sender = db.Column(db.String(10), nullable=False)  # "user" or "bot"
    text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=utc_now)
    
    # Chunking support for streaming messages
    message_group_id = db.Column(db.String(36), nullable=True)  # UUID to group chunks
    chunk_index = db.Column(db.Integer, nullable=True)  # Which chunk (0, 1, 2...)
    total_chunks = db.Column(db.Integer, nullable=True)  # Total chunks in group

    attachments = db.relationship(
        "MessageAttachment",
        backref="message",
        lazy="selectin",
        cascade="all, delete-orphan"
    )


class MessageAttachment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey("message.id"), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(1024), nullable=False)
    content_type = db.Column(db.String(120), nullable=True)
    size_bytes = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=utc_now)


class Feedback(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    rating = db.Column(db.Integer, nullable=False)  # 1-5 stars
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=utc_now)
    
    # Relationship to user
    user = db.relationship("User", backref=db.backref("feedbacks", lazy=True))