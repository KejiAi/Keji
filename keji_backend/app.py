import eventlet
eventlet.monkey_patch()

from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager, login_required, current_user
from flask_cors import CORS
from flask_mail import Mail, Message
from flask_socketio import SocketIO
from dotenv import load_dotenv
import os
import logging


# Load env
load_dotenv()

mail = Mail()

app = Flask(__name__)


# Set default values if env vars are not found
SECRET_KEY = os.getenv("SECRET_KEY")
SQLALCHEMY_DATABASE_URI = os.getenv("SQLALCHEMY_DATABASE_URI")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")
FRONTEND_URL_LAN = os.getenv("FRONTEND_URL_LAN")

CORS(app, 
     supports_credentials=True, 
     origins=[FRONTEND_BASE_URL, FRONTEND_URL_LAN],
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Initialize SocketIO with CORS support
socketio = SocketIO(
    app, 
    cors_allowed_origins=[FRONTEND_BASE_URL, FRONTEND_URL_LAN],
    async_mode='eventlet',
    logger=True,
    engineio_logger=True,
    cookie='session',  # Use Flask session cookie
    manage_session=True,  # Enable session management for Flask-Login
    ping_timeout=120,  # 2 minutes - wait this long for pong before disconnecting
    ping_interval=25,  # Send ping every 25 seconds to keep connection alive
    max_http_buffer_size=10000000  # 10MB buffer for large messages
)


app.config["SECRET_KEY"] = SECRET_KEY
app.config["SQLALCHEMY_DATABASE_URI"] = SQLALCHEMY_DATABASE_URI

ENV = os.getenv("FLASK_ENV", "development")

if ENV == "production":
    app.config["SESSION_COOKIE_SAMESITE"] = "None"
    app.config["SESSION_COOKIE_SECURE"] = True
    app.config["REMEMBER_COOKIE_SAMESITE"] = "None"
    app.config["REMEMBER_COOKIE_SECURE"] = True
else:  # development (localhost)
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = False
    app.config["REMEMBER_COOKIE_SAMESITE"] = "Lax"
    app.config["REMEMBER_COOKIE_SECURE"] = False

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_DOMAIN"] = None  # Allow cross-origin cookies
app.config["SESSION_COOKIE_PATH"] = "/"  # Ensure cookie is set for all paths
app.config["PERMANENT_SESSION_LIFETIME"] = 365 * 24 * 60 * 60  # 1 year (indefinite)

# Remember cookie settings to match session cookies
app.config["REMEMBER_COOKIE_HTTPONLY"] = True
app.config["REMEMBER_COOKIE_DOMAIN"] = None
app.config["REMEMBER_COOKIE_PATH"] = "/"

# Mail handler
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT'))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS') == 'True'
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL') == 'True'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER')

mail.init_app(app)

# Configure logging
from logging_config import setup_logging
logger = setup_logging(app)
logger.info("Flask application starting up...")

db = SQLAlchemy(app)
migrate = Migrate(app, db)

login_manager = LoginManager(app)
login_manager.login_view = "login"

from models import User
from auth import auth_bp
app.register_blueprint(auth_bp)

from chat import chat_bp
app.register_blueprint(chat_bp)

# Import WebSocket handlers (must be after socketio initialization)
import websocket


@login_manager.user_loader
def load_user(user_id):
    logger.debug(f"Loading user with ID: {user_id}")
    user = User.query.get(int(user_id))
    if user:
        logger.debug(f"User loaded successfully: {user.name} ({user.email})")
    else:
        logger.warning(f"User not found with ID: {user_id}")
    return user

# Request/Response logging middleware
@app.before_request
def log_request_info():
    logger.info(f"Request: {request.method} {request.url}")
    logger.debug(f"Request headers: {dict(request.headers)}")
    if request.is_json:
        logger.debug(f"Request JSON data: {request.get_json()}")
    elif request.form:
        logger.debug(f"Request form data: {dict(request.form)}")

@app.after_request
def log_response_info(response):
    logger.info(f"Response: {response.status_code} for {request.method} {request.url}")
    logger.debug(f"Response headers: {dict(response.headers)}")
    return response

# Error logging
@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
    return jsonify({"error": "Internal server error"}), 500


# if __name__ == "__main__":
#     app.run(debug=True)