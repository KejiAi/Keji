from flask import Blueprint, request, jsonify, session, make_response, redirect
from app import db, mail, app
import string
from models import User
from flask_login import login_user, logout_user, login_required, current_user
import logging
import random
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
from flask_mail import Message


load_dotenv()

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__)
serializer = URLSafeTimedSerializer(os.getenv('SECRET_KEY'))

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

    # Build link
    logger.debug("Building verification link")
    logger.debug(f"Backend URL: {os.getenv('BACKEND_URL_LOCAL')}")
    verify_link = f"{os.getenv('BACKEND_URL_LOCAL')}/verify-email/{token}"
    logger.debug(f"verify link generated: {verify_link}")

    # email service
    msg = Message(
        subject="Verify your account",
        recipients=[email]
    )
    msg.body = f"""
Hi {name},

Thanks for signing up! Please verify your account.

Click this link: {verify_link}

Or enter this code: {code}

This link/code will expire in 1 hour.

Cheers,
Your App Team
"""
    try:
        mail.send(msg)
        logger.info(f"Verification email sent successfully to {email}")
    except Exception as e:
        logger.error(f"Failed to send verification email to {email}: {str(e)}")
        return jsonify({"error": "Failed to send verification email"}), 500

    return jsonify({"message": "User created. Verification email sent."}), 201


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

    return redirect(f"{os.getenv("FRONTEND_BASE_URL")}/start?mode=login")  # adjust for your frontend


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

    msg = Message(
        subject="Your new verification code",
        recipients=[email]
    )
    msg.body = f"Your new code is: {code}"
    mail.send(msg)

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

    # ✅ Friendly Email
    msg = Message(
        subject="🔑 Reset Your Password – We've Got You Covered!",
        recipients=[email]
    )
    msg.body = f"""
Hey {user.name} 👋,

No stress – password resets happen to the best of us! 💪  
Here's your brand new password:  

👉  {temp_password}  

You can continue using this password if you'd like ✅,  
or update it anytime from your profile under **Change Password** for extra security 🔒.  

Stay awesome,  
✨ Your App Team ✨
"""

    try:
        mail.send(msg)
        logger.info(f"Password reset email sent successfully to {email}")
    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {str(e)}")
        return jsonify({"error": "Failed to send password reset email"}), 500

    return jsonify({"message": "Password reset email sent successfully"}), 200


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    user_name = current_user.name
    logout_user()
    session.clear()  # Clear all session data

    # Debug: print out the cookie config values being used
    # logger.info(f"REMEMBER_COOKIE_DOMAIN = {app.config.get('REMEMBER_COOKIE_DOMAIN')}")
    # logger.info(f"SESSION_COOKIE_DOMAIN  = {app.config.get('SESSION_COOKIE_DOMAIN')}")

    # logger.info(f"REMEMBER_COOKIE_SECURE = {app.config.get('REMEMBER_COOKIE_SECURE')}")
    # logger.info(f"SESSION_COOKIE_SECURE  = {app.config.get('SESSION_COOKIE_SECURE')}")
    
    # logger.info(f"REMEMBER_COOKIE_SAMESITE = {app.config.get('REMEMBER_COOKIE_SAMESITE')}")
    # logger.info(f"SESSION_COOKIE_SAMESITE = {app.config.get('SESSION_COOKIE_SAMESITE')}")

    # logger.info(f"REMEMBER_COOKIE_NAME = {app.config.get('REMEMBER_COOKIE_NAME')}")
    # logger.info(f"SESSION_COOKIE_NAME = {app.config.get('SESSION_COOKIE_NAME')}")

    response = make_response(jsonify({"message": "Logged out"}), 200)

    # Clear remember token cookie with same settings as when it was set
    response.set_cookie(
        "remember_token", "", expires=0,
        path=app.config.get("REMEMBER_COOKIE_PATH", "/"),
        samesite=app.config.get("REMEMBER_COOKIE_SAMESITE", "Lax"),
        secure=app.config.get("REMEMBER_COOKIE_SECURE", False),
        httponly=app.config.get("REMEMBER_COOKIE_HTTPONLY", True),
        domain=app.config.get("REMEMBER_COOKIE_DOMAIN", None),
    )

    # Clear session cookie (in case it exists)
    response.set_cookie(
        app.config.get("SESSION_COOKIE_NAME", "session"), "", expires=0,
        path=app.config.get("SESSION_COOKIE_PATH", "/"),
        samesite=app.config.get("SESSION_COOKIE_SAMESITE", "Lax"),
        secure=app.config.get("SESSION_COOKIE_SECURE", False),
        httponly=app.config.get("SESSION_COOKIE_HTTPONLY", True),
        domain=app.config.get("SESSION_COOKIE_DOMAIN", None),
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
    logger.info("Scheduled cleanup job started")
    deleted = delete_expired_unverified_users()
    logger.info(f"Scheduled cleanup completed: {deleted} expired unverified users deleted")

scheduler.start()
