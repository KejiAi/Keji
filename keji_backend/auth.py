from flask import Blueprint, request, jsonify, session, make_response, redirect, current_app, url_for
from extensions import db
import string
from models import User, Feedback
from flask_login import login_user, logout_user, login_required, current_user
import logging
import random
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import subprocess
import json
from authlib.integrations.flask_client import OAuth


load_dotenv()

logger = logging.getLogger(__name__)

# Get the directory where this script is located (for subprocess helpers)
SCRIPT_DIR = os.path.abspath(os.path.dirname(__file__) or os.getcwd())
logger.info(f"Auth module initialized, script directory: {SCRIPT_DIR}")

auth_bp = Blueprint("auth", __name__)
serializer = URLSafeTimedSerializer(os.getenv('SECRET_KEY'))

# Initialize OAuth
oauth = OAuth()

# Configure Google OAuth
oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# Configure Resend
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL")

def send_email(to_email, subject, html_content, text_content=None):
    """
    Send an email using Resend via subprocess.
    Subprocess completely isolates from Eventlet (no SSL conflicts).

    Args:
        to_email (str): Recipient email address
        subject (str): Email subject
        html_content (str): HTML email body
        text_content (str, optional): Plain-text fallback

    Returns:
        bool: True if sent successfully, False otherwise
    """
    if not RESEND_API_KEY or not RESEND_FROM_EMAIL:
        logger.error("Resend configuration missing: RESEND_API_KEY or RESEND_FROM_EMAIL not set.")
        return False

    try:
        # Build command to run email helper in isolated subprocess
        cmd = [
            'python',
            os.path.join(SCRIPT_DIR, 'send_email_helper.py'),
            RESEND_API_KEY,
            RESEND_FROM_EMAIL,
            to_email,
            subject,
            html_content
        ]
        
        if text_content:
            cmd.append(text_content)
        
        # Run subprocess with timeout
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            # Parse success response
            try:
                response_data = json.loads(result.stdout)
                message_id = response_data.get('id', 'unknown')
                logger.info(f"Email sent successfully to {to_email} via Resend (ID: {message_id})")
                return True
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON response from email helper: {result.stdout}")
                return False
        else:
            # Parse error response
            try:
                error_data = json.loads(result.stdout)
                error_msg = error_data.get('error', 'Unknown error')
            except:
                error_msg = result.stderr or result.stdout or 'Unknown error'
            
            logger.error(f"Failed to send email to {to_email}: {error_msg}")
            return False

    except subprocess.TimeoutExpired:
        logger.error(f"Email send to {to_email} timed out after 30 seconds")
        return False
    except Exception as e:
        logger.error(f"Error sending email to {to_email}: {str(e)}", exc_info=True)
        return False

def get_greeting():
    hour = datetime.now().hour
    night_lines = [
        "Night crawler 😎, still up, ehn?",
        "Night crawler mode ON.🦉",
        "Who is awake by this time? Night crawler 😁",
        "Night crawler vibes 😆, Oya now",
        "🛌 Go sleep jare, night crawler 😂",
        "Kerosene 😂, you no see sleep",
        "Young John 😜"
    ]

    if 5 <= hour < 12:
        return "morning"
    elif 12 <= hour < 16:
        return "afternoon"
    elif 16 <= hour < 22:
        return "evening"
    else:
        return {"greet": random.choice(night_lines)}



# ✅ SIGN-UP (with verification code + link)
@auth_bp.route("/sign-up", methods=["POST"])
def signup():
    logger.info("Sign-up request received")
    data = request.get_json()
    name = data.get("name")
    email = data.get("email").lower()
    password = data.get("password")

    logger.debug(f"Sign-up attempt for email: {email}, name: {name}")

    if User.query.filter_by(email=email).first():
        logger.warning(f"Sign-up failed: Email already registered - {email}")
        return jsonify({"error": "Email already registered"}), 400

    # Generate code & token
    code = str(random.randint(100000, 999999))
    token = serializer.dumps(email, salt="email-verify")
    logger.debug(f"Generated verification code and token for {email}")

    # Build verification link
    logger.debug("Building verification link")
    logger.debug(f"Backend URL: {os.getenv('BACKEND_URL_LOCAL')}")
    verify_link = f"{os.getenv('BACKEND_URL_LOCAL')}/verify-email/{token}"
    logger.debug(f"verify link generated: {verify_link}")

    # Prepare email content
    text_content = f"""
Hi {name},

Thanks for signing up! Please verify your account.

Click this link: {verify_link}

Or enter this code: {code}

This link/code will expire in 1 hour.

Cheers,
Keji AI Team
"""
    
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .button {{ 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #FF542E; 
            color: #FFFFFF !important; 
            text-decoration: none; 
            border-radius: 12px; 
            margin: 20px 0;
        }}
        .code {{ 
            font-size: 24px; 
            font-weight: bold; 
            letter-spacing: 3px; 
            padding: 15px; 
            background-color: #f5f5f5; 
            border-radius: 5px; 
            display: inline-block;
            margin: 10px 0;
            color: #FF542E;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Welcome to Keji AI, {name}! 🎉</h2>
        <p>Thanks for signing up! Please verify your account to get started.</p>
        
        <p><strong>Option 1:</strong> Click the button below</p>
        <a href="{verify_link}" class="button">Verify My Account</a>
        
        <p><strong>Option 2:</strong> Enter this code in the app</p>
        <div class="code">{code}</div>
        
        <p style="color: #666; font-size: 14px;">This link/code will expire in 1 hour.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
            If you didn't create this account, please ignore this email.
        </p>
    </div>
</body>
</html>
"""
    
    # ✅ SEND EMAIL FIRST (before saving user)
    logger.debug(f"Attempting to send verification email to {email}")
    if not send_email(email, "Verify your Keji AI account", html_content, text_content):
        logger.error(f"Failed to send verification email to {email}")
        # Email failed - don't create user
        return jsonify({"error": "Failed to send verification email. Please try again later."}), 500
    
    logger.info(f"Verification email sent successfully to {email}")
    
    # ✅ Email sent successfully - NOW save user to database
    try:
        user = User(
            name=name,
            email=email,
            is_verified=False,
            verification_code=code,
            verification_token=token,
            chat_style="more_english",
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        logger.info(f"User created successfully: {email} (ID: {user.id})")
        
        return jsonify({"message": "User created. Verification email sent."}), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to create user {email} after email sent: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to create user account. Please try again."}), 500


# ✅ VERIFY BY LINK
@auth_bp.route("/verify-email/<token>", methods=["GET"])
def verify_link(token):
    logger.info(f"Email verification link accessed with token: {token[:10]}...")
    try:
        email = serializer.loads(token, salt="email-verify", max_age=3600)
        logger.debug(f"Token decoded successfully for email: {email}")
    except (SignatureExpired, BadSignature) as e:
        logger.warning(f"Invalid or expired token: {str(e)}")
        return jsonify({"error": "Invalid or expired token"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        logger.error(f"User not found for email: {email}")
        return jsonify({"error": "User not found"}), 404

    user.is_verified = True
    user.verification_code = None
    db.session.commit()
    logger.info(f"Email verified successfully for user: {email} (ID: {user.id})")

    return redirect(f"{os.getenv('FRONTEND_BASE_URL')}/start?mode=login")  # adjust for your frontend


# ✅ VERIFY BY CODE
@auth_bp.route("/verify-email/code", methods=["POST"])
def verify_code():
    logger.info("Email verification code request received")
    data = request.get_json()
    email = data.get("email").lower()
    code = data.get("code")

    logger.debug(f"Verification attempt for email: {email} with code: {code}")

    user = User.query.filter_by(email=email).first()
    if not user:
        logger.warning(f"Verification failed: User not found for email: {email}")
        return jsonify({"error": "User not found"}), 404

    if user.verification_code == code:
        user.is_verified = True
        user.verification_code = None
        db.session.commit()
        logger.info(f"Email verified successfully via code for user: {email} (ID: {user.id})")
        return jsonify({"message": "Email verified"}), 200

    logger.warning(f"Invalid verification code for email: {email}")
    return jsonify({"error": "Invalid code"}), 400


# ✅ RESEND CODE
@auth_bp.route("/verify-email/resend", methods=["POST"])
def resend_code():
    data = request.get_json()
    email = data.get("email").lower()

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    code = str(random.randint(100000, 999999))
    user.verification_code = code
    db.session.commit()

    # Send new verification code via Resend
    text_content = f"Your new verification code is: {code}"
    
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .code {{ 
            font-size: 28px; 
            font-weight: bold; 
            letter-spacing: 4px; 
            padding: 20px; 
            background-color: #f5f5f5; 
            border-radius: 5px; 
            display: inline-block;
            margin: 20px 0;
            color: #FF542E;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Your New Verification Code</h2>
        <p>Here's your new verification code:</p>
        <div class="code">{code}</div>
        <p style="color: #666; font-size: 14px;">This code will expire in 1 hour.</p>
    </div>
</body>
</html>
"""
    
    if not send_email(email, "Your new verification code", html_content, text_content):
        logger.error(f"Failed to send verification code to {email}")
        return jsonify({"error": "Failed to send verification code"}), 500

    return jsonify({"message": "New code sent"}), 200


# ✅ LOGIN (block unverified users)
@auth_bp.route("/login", methods=["POST"])
def login():
    logger.info("Login request received")
    data = request.get_json()
    email = data.get("email").lower()
    password = data.get("password")

    logger.debug(f"Login attempt for email: {email}")
    
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        logger.warning(f"Login failed: Invalid credentials for email: {email}")
        return jsonify({"error": "Invalid email or password"}), 401

    if not user.is_verified:
        logger.warning(f"Login failed: Email not verified for user: {email}")
        return jsonify({"error": "Email not verified"}), 403

    login_user(user, remember=True)
    session.permanent = True
    logger.info(f"Login successful for user: {user.name} ({email}) - ID: {user.id}")
    return jsonify({"message": "Login successful"}), 200

@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    logger.info("Forgot password request received")
    data = request.get_json()
    email = data.get("email").lower()

    if not email:
        logger.warning("Forgot password failed: No email provided")
        return jsonify({"error": "Email is required"}), 400

    logger.debug(f"Password reset request for email: {email}")

    user = User.query.filter_by(email=email).first()
    if not user:
        logger.warning(f"Password reset failed: User not found for email: {email}")
        return jsonify({"error": "User not found"}), 404

    # Generate secure reset token (expires in 1 hour)
    reset_token = serializer.dumps(email, salt='password-reset-salt')
    logger.debug(f"Generated reset token for user: {email}")

    # Create reset link
    frontend_url = os.getenv('FRONTEND_BASE_URL', 'http://localhost:8080')
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"

    # Send password reset email via Resend
    text_content = f"""
Hey {user.name},

No stress – password resets happen to the best of us!

Click the link below to reset your password:

{reset_link}

This link will expire in 1 hour for security.

If you didn't request this, you can safely ignore this email.

Cheers,
The Keji Team
"""
    
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .reset-button {{ 
            display: inline-block;
            padding: 15px 30px;
            background-color: #FF542E;
            color: #FFFFFF !important;
            text-decoration: none;
            border-radius: 12px;
            font-weight: bold;
            margin: 20px 0;
        }}
        .reset-button:hover {{
            background-color: #E64924;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Reset Your Password 🔑</h2>
        <p>Hey {user.name} 👋,</p>
        <p>No stress – password resets happen to the best of us! 💪</p>
        
        <p>Click the button below to reset your password:</p>
        <a href="{reset_link}" class="reset-button">Reset Password</a>
        
        <p>Or copy and paste this link in your browser:</p>
        <p style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all;">
            {reset_link}
        </p>
        
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
            ⏰ This link will expire in 1 hour for security.
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
            If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
        </p>
    </div>
</body>
</html>
"""

    if not send_email(email, "Reset Your Password – We've Got You Covered! 🔑", html_content, text_content):
        logger.error(f"Failed to send password reset email to {email}")
        return jsonify({"error": "Failed to send password reset email"}), 500

    logger.info(f"Password reset link sent to {email}")
    return jsonify({"message": "Password reset link sent to your email"}), 200


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    logger.info("Reset password request received")
    data = request.get_json()
    token = data.get("token")
    new_password = data.get("password")

    if not token or not new_password:
        logger.warning("Reset password failed: Missing token or password")
        return jsonify({"error": "Token and password are required"}), 400

    try:
        # Verify token (expires in 1 hour = 3600 seconds)
        email = serializer.loads(token, salt='password-reset-salt', max_age=3600)
        logger.debug(f"Token verified for email: {email}")
    except SignatureExpired:
        logger.warning("Reset password failed: Token expired")
        return jsonify({"error": "Reset link has expired. Please request a new one."}), 400
    except BadSignature:
        logger.warning("Reset password failed: Invalid token")
        return jsonify({"error": "Invalid reset link"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        logger.warning(f"Reset password failed: User not found for email: {email}")
        return jsonify({"error": "User not found"}), 404

    # Update password
    user.set_password(new_password)
    db.session.commit()
    logger.info(f"Password reset successful for user: {email} (ID: {user.id})")

    return jsonify({"message": "Password reset successful"}), 200


def _serialize_user(user):
    fname = user.name.split()[0] if user.name else ""
    initial = fname[0].upper() if fname else ""
    chat_style = user.chat_style or "more_english"

    return {
        "loggedIn": True,
        "id": user.id,
        "name": user.name,
        "fname": fname,
        "email": user.email,
        "initial": initial,
        "chat_style": chat_style,
    }


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    user_name = current_user.name
    logout_user()
    session.clear()  # Clear all session data

    response = make_response(jsonify({"message": "Logged out"}), 200)

    # Clear remember token cookie with same settings as when it was set
    response.set_cookie(
        "remember_token", "", expires=0,
        path=current_app.config.get("REMEMBER_COOKIE_PATH", "/"),
        samesite=current_app.config.get("REMEMBER_COOKIE_SAMESITE", "Lax"),
        secure=current_app.config.get("REMEMBER_COOKIE_SECURE", False),
        httponly=current_app.config.get("REMEMBER_COOKIE_HTTPONLY", True),
        domain=current_app.config.get("REMEMBER_COOKIE_DOMAIN", None),
    )

    # Clear session cookie (in case it exists)
    response.set_cookie(
        current_app.config.get("SESSION_COOKIE_NAME", "session"), "", expires=0,
        path=current_app.config.get("SESSION_COOKIE_PATH", "/"),
        samesite=current_app.config.get("SESSION_COOKIE_SAMESITE", "Lax"),
        secure=current_app.config.get("SESSION_COOKIE_SECURE", False),
        httponly=current_app.config.get("SESSION_COOKIE_HTTPONLY", True),
        domain=current_app.config.get("SESSION_COOKIE_DOMAIN", None),
    )

    logger.info(f"User logged out: {user_name}")
    return response



@auth_bp.route("/check-session", methods=["GET"])
def check_session():
    if current_user.is_authenticated:
        initial = current_user.name.split()[0][0] if current_user.name else ""
        fname = current_user.name.split()[0] if current_user.name else ""
        time_of_day = get_greeting()

        chat_style = current_user.chat_style or "more_english"

        user_data = {
            "loggedIn": True,
            "id": current_user.id,
            "name": current_user.name,
            "fname": fname,
            "email": current_user.email,
            "initial": initial,
            "chat_style": chat_style,
        }

        if type(time_of_day) == dict:
            user_data.update({"greet": time_of_day.get("greet")})
        else:
            user_data.update({"time": time_of_day})

        logger.debug(f"Session check successful for user: {current_user.name}")
        return jsonify(user_data), 200
    
    logger.debug("Session check failed - user not authenticated")
    return jsonify({"loggedIn": False}), 401


@auth_bp.route("/update-name", methods=["POST"])
@login_required
def update_name():
    data = request.get_json() or {}
    new_name = (data.get("name") or "").strip()

    if not new_name:
        logger.warning("Update name failed: empty name provided")
        return jsonify({"error": "Name is required"}), 400

    if len(new_name) < 2:
        return jsonify({"error": "Name must be at least 2 characters"}), 400

    if len(new_name) > 60:
        return jsonify({"error": "Name must be 60 characters or less"}), 400

    current_user.name = new_name
    db.session.commit()
    logger.info(f"User name updated: {current_user.email} -> {new_name}")

    fname = new_name.split()[0] if new_name else ""
    initial = fname[0].upper() if fname else ""

    updated_user = _serialize_user(current_user)

    return jsonify({"message": "Name updated successfully", "user": updated_user}), 200


@auth_bp.route("/update-chat-style", methods=["POST"])
@login_required
def update_chat_style():
    data = request.get_json() or {}
    chat_style = data.get("chat_style")

    valid_styles = {
        "pure_english",
        "more_english",
        "mix",
        "more_pidgin",
        "pure_pidgin",
    }

    if chat_style not in valid_styles:
        logger.warning(f"Invalid chat style provided: {chat_style}")
        return jsonify({"error": "Invalid chat style"}), 400

    current_user.chat_style = chat_style
    db.session.commit()
    logger.info(f"Chat style updated for user {current_user.email} -> {chat_style}")

    updated_user = _serialize_user(current_user)
    return jsonify({"message": "Chat style updated successfully", "user": updated_user}), 200


# The scheduler will call this function at the specified interval
EXPIRATION_HOURS = 24

def delete_expired_unverified_users():
    logger.info("Starting cleanup of expired unverified users")
    expiry_time = datetime.now() - timedelta(hours=EXPIRATION_HOURS)
    expired_users = User.query.filter(
        User.is_verified == False,
        User.created_at < expiry_time
    ).all()

    logger.debug(f"Found {len(expired_users)} expired unverified users")
    for user in expired_users:
        logger.info(f"Deleting unverified user: {user.email} (created: {user.created_at})")
        db.session.delete(user)

    db.session.commit()
    logger.info(f"Cleanup completed: {len(expired_users)} users deleted")
    return len(expired_users)

from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()

def init_scheduler(app):
    """
    Initialize scheduled jobs with Flask app context.
    Must be called after app is created.
    """
    
    def cleanup_job():
        with app.app_context():
            logger.info("Scheduled cleanup job started")
            deleted = delete_expired_unverified_users()
            logger.info(f"Scheduled cleanup completed: {deleted} expired unverified users deleted")
    
    def keep_db_alive():
        """
        Ping the database every 4 minutes to prevent Neon DB hibernation.
        Neon free tier hibernates after ~5 minutes of inactivity.
        """
        with app.app_context():
            try:
                # Simple lightweight query to keep connection alive
                result = db.session.execute(db.text("SELECT 1")).scalar()
                logger.debug(f"✅ Database keep-alive ping successful (result: {result})")
            except Exception as e:
                logger.error(f"❌ Database keep-alive ping failed: {str(e)}", exc_info=True)
    
    # Register auth jobs
    scheduler.add_job(cleanup_job, 'interval', hours=1, id='cleanup_job')
    scheduler.add_job(keep_db_alive, 'interval', minutes=4, id='keep_db_alive')
    
    # Register worker jobs (summary generation, daily chat clearing)
    from workers import register_workers
    register_workers(scheduler, app)
    
    # Start scheduler
    if not scheduler.running:
        scheduler.start()
        logger.info("Background scheduler started with all jobs (cleanup, keep-alive, summary, chat-clearing)")


# ==================== GOOGLE OAUTH ROUTES ====================

def _generate_oauth_redirect_subprocess(redirect_uri, client_id, client_secret, server_metadata_url):
    """
    Generate OAuth redirect URL using subprocess isolation.
    This completely isolates the OAuth library from Eventlet's SSL patching.
    """
    try:
        helper_path = os.path.join(SCRIPT_DIR, 'oauth_helper.py')
        logger.debug(f"Using OAuth helper at: {helper_path}")
        
        cmd = [
            'python',
            helper_path,
            'redirect',
            redirect_uri,
            client_id,
            client_secret,
            server_metadata_url
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            response_data = json.loads(result.stdout)
            if response_data.get('success'):
                return response_data.get('authorization_url'), response_data.get('state')
            else:
                error_msg = response_data.get('error', 'Unknown error')
                logger.error(f"OAuth redirect generation failed: {error_msg}")
                if 'traceback' in response_data:
                    logger.error(f"Traceback: {response_data['traceback']}")
                raise Exception(f"OAuth redirect failed: {error_msg}")
        else:
            logger.error(f"OAuth redirect subprocess failed with code {result.returncode}")
            logger.error(f"STDOUT: {result.stdout}")
            logger.error(f"STDERR: {result.stderr}")
            error_data = json.loads(result.stdout) if result.stdout else {}
            error_msg = error_data.get('error', 'Unknown error')
            raise Exception(f"OAuth redirect subprocess failed: {error_msg}")
            
    except subprocess.TimeoutExpired:
        logger.error("OAuth redirect generation timed out after 30 seconds")
        raise Exception("OAuth redirect generation timed out")
    except Exception as e:
        logger.error(f"Error generating OAuth redirect: {str(e)}", exc_info=True)
        raise


@auth_bp.route("/login/google", methods=["GET"])
def google_login():
    """
    Redirect user to Google's OAuth page for authentication.
    """
    logger.info("Initiating Google OAuth login")
    
    # Generate callback URL
    redirect_uri = url_for('auth.google_callback', _external=True)
    logger.debug(f"Generated callback URL: {redirect_uri}")
    
    # Generate OAuth redirect URL using subprocess (isolated from Eventlet)
    try:
        logger.debug("Generating OAuth redirect via subprocess...")
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        server_metadata_url = 'https://accounts.google.com/.well-known/openid-configuration'
        
        authorization_url, state = _generate_oauth_redirect_subprocess(
            redirect_uri, client_id, client_secret, server_metadata_url
        )
        
        # Store state in session for CSRF protection
        session['oauth_state'] = state
        session.permanent = True
        
        logger.debug(f"OAuth redirect URL generated successfully, state: {state[:10]}...")
        return redirect(authorization_url)
        
    except Exception as e:
        logger.error(f"Failed to generate OAuth redirect: {str(e)}", exc_info=True)
        return redirect(f"{os.getenv('FRONTEND_BASE_URL')}/start?error=oauth_failed")


def _exchange_oauth_token_subprocess(authorization_code, redirect_uri, client_id, client_secret, server_metadata_url):
    """
    Exchange OAuth authorization code for access token using subprocess isolation.
    This completely isolates the OAuth library from Eventlet's SSL patching.
    """
    try:
        helper_path = os.path.join(SCRIPT_DIR, 'oauth_helper.py')
        logger.debug(f"Using OAuth helper at: {helper_path}")
        
        cmd = [
            'python',
            helper_path,
            'token',
            authorization_code,
            redirect_uri,
            client_id,
            client_secret,
            server_metadata_url
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            response_data = json.loads(result.stdout)
            if response_data.get('success'):
                return response_data.get('token'), response_data.get('userinfo')
            else:
                error_msg = response_data.get('error', 'Unknown error')
                logger.error(f"OAuth token exchange failed: {error_msg}")
                if 'traceback' in response_data:
                    logger.error(f"Traceback: {response_data['traceback']}")
                raise Exception(f"OAuth token exchange failed: {error_msg}")
        else:
            logger.error(f"OAuth token exchange subprocess failed with code {result.returncode}")
            logger.error(f"STDOUT: {result.stdout}")
            logger.error(f"STDERR: {result.stderr}")
            error_data = json.loads(result.stdout) if result.stdout else {}
            error_msg = error_data.get('error', 'Unknown error')
            raise Exception(f"OAuth token exchange subprocess failed: {error_msg}")
            
    except subprocess.TimeoutExpired:
        logger.error("OAuth token exchange timed out after 30 seconds")
        raise Exception("OAuth token exchange timed out")
    except Exception as e:
        logger.error(f"Error exchanging OAuth token: {str(e)}", exc_info=True)
        raise


@auth_bp.route("/login/callback", methods=["GET"])
def google_callback():
    """
    Handle Google OAuth callback.
    Retrieves user info, creates/updates user in database, and logs them in.
    """
    logger.info("Google OAuth callback received")
    
    try:
        # Verify state parameter for CSRF protection
        state = request.args.get('state')
        stored_state = session.get('oauth_state')
        
        if not state or state != stored_state:
            logger.warning(f"OAuth state mismatch: received={state}, stored={stored_state}")
            return redirect(f"{os.getenv('FRONTEND_BASE_URL')}/start?error=state_mismatch")
        
        # Clear state from session
        session.pop('oauth_state', None)
        
        # Get authorization code
        authorization_code = request.args.get('code')
        if not authorization_code:
            logger.error("No authorization code in callback")
            return redirect(f"{os.getenv('FRONTEND_BASE_URL')}/start?error=no_code")
        
        # Exchange code for token using subprocess (isolated from Eventlet)
        logger.debug("Exchanging OAuth code for access token via subprocess...")
        redirect_uri = url_for('auth.google_callback', _external=True)
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        server_metadata_url = 'https://accounts.google.com/.well-known/openid-configuration'
        
        token, user_info = _exchange_oauth_token_subprocess(
            authorization_code, redirect_uri, client_id, client_secret, server_metadata_url
        )
        
        logger.debug("Access token and user info received from Google")
        
        if not user_info:
            logger.error("No userinfo in token response")
            return redirect(f"{os.getenv('FRONTEND_BASE_URL')}/start?error=auth_failed")
        
        email = user_info.get('email')
        name = user_info.get('name')
        google_id = user_info.get('sub')  # Google's unique user ID
        
        logger.info(f"Google user info retrieved: email={email}, name={name}, google_id={google_id}")
        
        if not email:
            logger.error("No email provided by Google")
            return redirect(f"{os.getenv('FRONTEND_BASE_URL')}/start?error=no_email")
        
        # Check if user exists
        user = User.query.filter_by(email=email.lower()).first()
        
        if user:
            # User exists - update their info if needed
            logger.info(f"Existing user found: {user.email} (ID: {user.id})")
            
            # Update name if it changed
            if user.name != name:
                user.name = name
                logger.debug(f"Updated user name to: {name}")
            
            # Mark as verified (Google verifies emails)
            if not user.is_verified:
                user.is_verified = True
                user.verification_code = None
                user.verification_token = None
                logger.info(f"User {user.email} marked as verified via Google OAuth")
            
            db.session.commit()
        else:
            # Create new user
            logger.info(f"Creating new user from Google OAuth: {email}")
            
            # Generate a random password (user won't use it, they'll use Google Sign-In)
            random_password = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
            
            user = User(
                name=name or email.split('@')[0],  # Use email username if no name provided
                email=email.lower(),
                is_verified=True,  # Google-authenticated users are automatically verified
                verification_code=None,
                verification_token=None,
                chat_style="more_english",
            )
            user.set_password(random_password)
            
            db.session.add(user)
            db.session.commit()
            logger.info(f"New user created successfully: {user.email} (ID: {user.id})")
        
        # Log the user in
        login_user(user, remember=True)
        session.permanent = True
        logger.info(f"User logged in successfully via Google OAuth: {user.name} ({user.email})")
        
        # Redirect to homepage
        return redirect(f"{os.getenv('FRONTEND_BASE_URL')}/homepage")
        
    except Exception as e:
        logger.error(f"Error in Google OAuth callback: {str(e)}", exc_info=True)
        return redirect(f"{os.getenv('FRONTEND_BASE_URL')}/start?error=auth_failed")


@auth_bp.route("/feedback", methods=["POST"])
@login_required
def submit_feedback():
    """
    Submit user feedback with rating and optional comment.
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        rating = data.get("rating")
        comment = data.get("comment", "").strip()
        
        # Validate rating
        if not rating or not isinstance(rating, int) or rating < 1 or rating > 5:
            return jsonify({"error": "Rating must be between 1 and 5"}), 400
        
        # Create feedback entry
        feedback = Feedback(
            user_id=current_user.id,
            rating=rating,
            comment=comment if comment else None
        )
        
        db.session.add(feedback)
        db.session.commit()
        
        logger.info(f"Feedback submitted by {current_user.name} (ID: {current_user.id}): {rating} stars")
        
        return jsonify({
            "status": "success",
            "message": "Feedback submitted successfully"
        }), 200
        
    except Exception as e:
        logger.error(f"Error submitting feedback: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Failed to submit feedback"}), 500
