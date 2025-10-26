from flask import Flask, jsonify, request
from flask_login import login_required, current_user
from flask_cors import CORS
from flask_mail import Message
from dotenv import load_dotenv
import os
import logging

# Load env
load_dotenv()

# Import extensions
from extensions import db, migrate, login_manager, socketio

app = Flask(__name__)

# Set default values if env vars are not found
SECRET_KEY = os.getenv("SECRET_KEY")
SQLALCHEMY_DATABASE_URI = os.getenv("SQLALCHEMY_DATABASE_URI")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")
FRONTEND_URL_LAN = os.getenv("FRONTEND_URL_LAN")
ENV = os.getenv("FLASK_ENV", "development")

# Build CORS origins list based on environment
cors_origins = []
if FRONTEND_BASE_URL:
    cors_origins.append(FRONTEND_BASE_URL)
if ENV != "production" and FRONTEND_URL_LAN:
    cors_origins.append(FRONTEND_URL_LAN)  # Only include LAN in development

# Fallback to allow all origins if none configured
if not cors_origins:
    cors_origins = ["*"]

CORS(app, 
     supports_credentials=True, 
     origins=cors_origins,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

app.config["SECRET_KEY"] = SECRET_KEY
app.config["SQLALCHEMY_DATABASE_URI"] = SQLALCHEMY_DATABASE_URI

# SQLAlchemy pool config for eventlet compatibility
if ENV == "production":
    from sqlalchemy.pool import NullPool
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "poolclass": NullPool,  # Avoid threading issues with eventlet
    }
else:
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

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
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS') == 'True'
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL') == 'True'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER')

# Initialize extensions with app
db.init_app(app)
migrate.init_app(app, db)
login_manager.init_app(app)
login_manager.login_view = "login"
# Initialize SocketIO with app and configuration
socketio.init_app(
    app, 
    cors_allowed_origins=cors_origins,  # Use the same filtered origins list
    async_mode='eventlet',
    logger=True,
    engineio_logger=True,
    cookie='session',
    manage_session=True,
    ping_timeout=120,
    ping_interval=25,
    max_http_buffer_size=10000000
)

# Configure logging
from logging_config import setup_logging
logger = setup_logging(app)
logger.info("Flask application starting up...")

from models import User
from auth import auth_bp
app.register_blueprint(auth_bp)

from chat import chat_bp
app.register_blueprint(chat_bp)

# Import WebSocket handlers (must be after socketio initialization)
import websocket


@login_manager.user_loader
def load_user(user_id):
    user = User.query.get(int(user_id))
    if not user:
        logger.warning(f"User not found with ID: {user_id}")
    return user

# Request/Response logging middleware
@app.before_request
def log_request_info():
    # Only log non-health check requests
    if request.path != '/health':
        logger.info(f"{request.method} {request.path}")

@app.after_request
def log_response_info(response):
    # Only log non-200 responses and non-health checks
    if response.status_code >= 400 and request.path != '/health':
        logger.warning(f"{request.method} {request.path} -> {response.status_code}")
    return response

# Error logging
@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
    return jsonify({"error": "Internal server error"}), 500

# Root endpoint to prevent 404s from health checks
@app.route('/')
def root():
    """Root endpoint to prevent 404s from health checks"""
    return jsonify({
        'message': 'Keji AI Backend API',
        'status': 'running',
        'endpoints': {
            'health': '/health',
            'chat': '/api/chat',
            'auth': '/api/auth',
            'websocket': 'WebSocket connection available',
            'test_openai': '/test-openai'
        }
    }), 200

# Test route for OpenAI
@app.route('/test-openai')
def test_openai():
    """Test OpenAI connection using thread pool"""
    import eventlet.tpool
    from openai import OpenAI
    
    def call_openai():
        """Run in real thread, bypassing eventlet's monkey patch"""
        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Say 'Hello from Keji!'"}]
        )
        return response.choices[0].message.content
    
    try:
        # Execute in thread pool (real thread, no eventlet SSL issues)
        result = eventlet.tpool.execute(call_openai)
        return jsonify({
            'status': 'success',
            'message': result,
            'method': 'eventlet.tpool (real thread)'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Health check endpoint for Render and monitoring
@app.route('/health')
def health_check():
    """Health check endpoint for deployment platforms and monitoring"""
    from datetime import datetime
    return jsonify({
        'status': 'healthy',
        'service': 'keji-backend',
        'timestamp': datetime.now().isoformat()
    }), 200


if __name__ == "__main__":
    # NOTE: Don't run this directly! Use run_dev.py instead.
    # 
    # Reason: eventlet.monkey_patch() must happen BEFORE imports,
    # but when you run "python app.py", imports happen first.
    # 
    # For development: python run_dev.py
    # For production: gunicorn --config gunicorn_config.py app:app
    
    print("WARNING: Running app.py directly is not recommended!")
    print("Use 'python run_dev.py' for development mode.")
    print("Use 'gunicorn --config gunicorn_config.py app:app' for production.")
    print()
    print("   Attempting to start anyway (may have eventlet warnings)...")
    print()
    
    import eventlet
    eventlet.monkey_patch()
    
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, debug=True, host='0.0.0.0', port=port)