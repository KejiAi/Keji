"""
Flask extensions initialization.
This file is imported by both app.py and models.py to avoid circular imports.

Note: Flask-Login has been removed - auth is now handled by Supabase on frontend.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_socketio import SocketIO
import logging

# Create logger
logger = logging.getLogger(__name__)

# Initialize extensions (without app)
db = SQLAlchemy()
migrate = Migrate()
socketio = SocketIO()

logger.debug("Flask extensions initialized")

