from flask import Blueprint, request, jsonify, session, make_response, redirect, current_app
from extensions import db
import string
from models import User
from flask_login import login_user, logout_user, login_required, current_user
import logging
import random
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import subprocess
import json


load_dotenv()

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__)
serializer = URLSafeTimedSerializer(os.getenv('SECRET_KEY'))

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
            os.path.join(os.path.dirname(__file__), 'send_email_helper.py'),
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
            background-color: #4CAF50; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
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
            verification_token=token
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
            color: #4CAF50;
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

# Handle forgot password
def generate_temp_password(length=10):
    """Generate a secure, user-friendly random password."""
    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

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

    # ✅ Generate a clean random password
    temp_password = generate_temp_password()
    logger.debug(f"Generated temporary password for user: {email}")

    # ✅ Hash and save in DB
    user.set_password(temp_password)
    db.session.commit()
    logger.info(f"Password reset successfully for user: {email} (ID: {user.id})")

    # Send password reset email via Resend
    text_content = f"""
Hey {user.name},

No stress – password resets happen to the best of us!
Here's your brand new password:

{temp_password}

You can continue using this password if you'd like,
or update it anytime from your profile under Change Password for extra security.

Stay awesome,
Keji AI Team
"""
    
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .password-box {{ 
            font-size: 20px; 
            font-weight: bold; 
            padding: 15px; 
            background-color: #f5f5f5; 
            border-left: 4px solid #4CAF50;
            border-radius: 5px; 
            margin: 20px 0;
            font-family: 'Courier New', monospace;
        }}
        .tip {{ 
            background-color: #E8F5E9; 
            padding: 15px; 
            border-radius: 5px; 
            margin: 20px 0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Password Reset Successful 🔑</h2>
        <p>Hey {user.name} 👋,</p>
        <p>No stress – password resets happen to the best of us! 💪</p>
        
        <p>Here's your brand new password:</p>
        <div class="password-box">{temp_password}</div>
        
        <div class="tip">
            <strong>💡 Tip:</strong> You can continue using this password if you'd like ✅, 
            or update it anytime from your profile under <strong>Change Password</strong> for extra security 🔒.
        </div>
        
        <p>Stay awesome,<br>
        <strong>Keji AI Team</strong> ✨</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
            If you didn't request this password reset, please contact us immediately.
        </p>
    </div>
</body>
</html>
"""

    if not send_email(email, "Reset Your Password – We've Got You Covered! 🔑", html_content, text_content):
        logger.error(f"Failed to send password reset email to {email}")
        return jsonify({"error": "Failed to send password reset email"}), 500

    return jsonify({"message": "Password reset email sent successfully"}), 200


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

        user_data = {
            "loggedIn": True,
            "id": current_user.id,
            "name": current_user.name,
            "fname": fname,
            "email": current_user.email,
            "initial": initial
        }

        if type(time_of_day) == dict:
            user_data.update({"greet": time_of_day.get("greet")})
        else:
            user_data.update({"time": time_of_day})

        logger.debug(f"Session check successful for user: {current_user.name}")
        return jsonify(user_data), 200
    
    logger.debug("Session check failed - user not authenticated")
    return jsonify({"loggedIn": False}), 401


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

@scheduler.scheduled_job("interval", hours=1)
def cleanup_job():
    from flask import current_app
    with current_app.app_context():
        logger.info("Scheduled cleanup job started")
        deleted = delete_expired_unverified_users()
        logger.info(f"Scheduled cleanup completed: {deleted} expired unverified users deleted")

scheduler.start()
