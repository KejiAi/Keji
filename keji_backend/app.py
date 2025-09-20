from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager, login_required, current_user
from flask_cors import CORS
from flask_mail import Mail, Message
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

app.config["SECRET_KEY"] = SECRET_KEY
app.config["SQLALCHEMY_DATABASE_URI"] = SQLALCHEMY_DATABASE_URI
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"  # Changed from "None" to "Lax"
app.config["SESSION_COOKIE_SECURE"] = False  # True if HTTPS
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_DOMAIN"] = None  # Allow cross-origin cookies
app.config["SESSION_COOKIE_PATH"] = "/"  # Ensure cookie is set for all paths
app.config["PERMANENT_SESSION_LIFETIME"] = 365 * 24 * 60 * 60  # 1 year (indefinite)

# Remember cookie settings to match session cookies
app.config["REMEMBER_COOKIE_SAMESITE"] = "Lax"
app.config["REMEMBER_COOKIE_SECURE"] = False
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
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

db = SQLAlchemy(app)
migrate = Migrate(app, db)

login_manager = LoginManager(app)
login_manager.login_view = "login"

from models import User
from auth import auth_bp
app.register_blueprint(auth_bp)

from chat import chat_bp
app.register_blueprint(chat_bp)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# if __name__ == "__main__":
#     app.run(debug=True)