"""
Flask extensions initialization.
This file is imported by both app.py and models.py to avoid circular imports.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_socketio import SocketIO
import logging

# Create logger
logger = logging.getLogger(__name__)

# Initialize extensions (without app)
db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
socketio = SocketIO()

logger.debug("Flask extensions initialized")

