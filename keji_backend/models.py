from extensions import db
from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
import logging

# Create logger for this module
logger = logging.getLogger(__name__)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_verified = db.Column(db.Boolean, default=False)
    chat_style = db.Column(db.String(50), default="pure_english")
    verification_code = db.Column(db.String(6), nullable=True)
    verification_token = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now())

    def set_password(self, password):
        logger.debug(f"Setting password for user: {self.email}")
        self.password_hash = generate_password_hash(password)
        logger.debug("Password hash generated successfully")
    
    def check_password(self, password):
        logger.debug(f"Checking password for user: {self.email}")
        result = check_password_hash(self.password_hash, password)
        logger.debug(f"Password check result: {result}")
        return result
    
class Conversation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now())
    memory_summary = db.Column(db.Text, nullable=True)  # Compressed summary of older messages
    pruned_count = db.Column(db.Integer, default=0)  # Number of messages that have been summarized
    last_summary_at = db.Column(db.DateTime, nullable=True)  # When summary was last updated

    messages = db.relationship("Message", backref="conversation", lazy=True)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversation.id"), nullable=False)
    sender = db.Column(db.String(10), nullable=False)  # "user" or "bot"
    text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.now())
    
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
    created_at = db.Column(db.DateTime, default=datetime.now())


class Feedback(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    rating = db.Column(db.Integer, nullable=False)  # 1-5 stars
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now())
    
    # Relationship to user
    user = db.relationship("User", backref=db.backref("feedbacks", lazy=True))