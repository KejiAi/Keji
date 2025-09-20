from flask import Blueprint, request, jsonify, session, make_response, redirect
from app import db, mail
import string
from models import User
from werkzeug.security import generate_password_hash
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

# ✅ SIGN-UP (with verification code + link)
@auth_bp.route("/sign-up", methods=["POST"])
def signup():
    data = request.get_json()
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400

    # Generate code & token
    code = str(random.randint(100000, 999999))
    token = serializer.dumps(email, salt="email-verify")

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

    # Build link
    verify_link = f"{os.getenv('BACKEND_URL_LOCAL')}/verify-email/{token}"

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
    mail.send(msg)


    return jsonify({"message": "User created. Verification email sent."}), 201


# ✅ VERIFY BY LINK
@auth_bp.route("/verify-email/<token>", methods=["GET"])
def verify_link(token):
    try:
        email = serializer.loads(token, salt="email-verify", max_age=3600)
    except (SignatureExpired, BadSignature):
        return jsonify({"error": "Invalid or expired token"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.is_verified = True
    user.verification_code = None
    db.session.commit()

    return redirect(f"{os.getenv("FRONTEND_BASE_URL")}/start?mode=login")  # adjust for your frontend


# ✅ VERIFY BY CODE
@auth_bp.route("/verify-email/code", methods=["POST"])
def verify_code():
    data = request.get_json()
    email = data.get("email")
    code = data.get("code")

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.verification_code == code:
        user.is_verified = True
        user.verification_code = None
        db.session.commit()
        return jsonify({"message": "Email verified"}), 200

    return jsonify({"error": "Invalid code"}), 400


# ✅ RESEND CODE
@auth_bp.route("/verify-email/resend", methods=["POST"])
def resend_code():
    data = request.get_json()
    email = data.get("email")

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
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    if not user.is_verified:
        return jsonify({"error": "Email not verified"}), 403

    login_user(user, remember=True)
    session.permanent = True
    return jsonify({"message": "Login successful"}), 200

# Handle forgot password
def generate_temp_password(length=10):
    """Generate a secure, user-friendly random password."""
    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()
    email = data.get("email")

    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    # ✅ Generate a clean random password
    temp_password = generate_temp_password()

    # ✅ Hash and save in DB
    user.set_password(temp_password)
    db.session.commit()

    # ✅ Friendly Email
    msg = Message(
        subject="🔑 Reset Your Password – We’ve Got You Covered!",
        recipients=[email]
    )
    msg.body = f"""
Hey {user.name} 👋,

No stress – password resets happen to the best of us! 💪  
Here’s your brand new password:  

👉  {temp_password}  

You can continue using this password if you’d like ✅,  
or update it anytime from your profile under **Change Password** for extra security 🔒.  

Stay awesome,  
✨ Your App Team ✨
"""

    mail.send(msg)

    return jsonify({"message": "Password reset email sent successfully"}), 200


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    user_name = current_user.name
    logout_user()
    session.clear()  # Clear all session data
    
    # Create response and explicitly clear all authentication cookies
    response = make_response(jsonify({"message": "Logged out"}), 200)
    
    # Clear remember token cookie with same settings as when it was set
    response.set_cookie('remember_token', '', expires=0, path='/', samesite='Lax', httponly=True)
    
    # Clear session cookie (in case it exists)
    response.set_cookie('session', '', expires=0, path='/', samesite='Lax', httponly=True)
    
    logger.info(f"User logged out: {user_name}")
    return response


@auth_bp.route("/check-session", methods=["GET"])
def check_session():
    if current_user.is_authenticated:
        initial = current_user.name.split()[0][0] if current_user.name else ""
        fname = current_user.name.split()[0] if current_user.name else ""
        user_data = {
            "loggedIn": True,
            "id": current_user.id,
            "name": current_user.name,
            "fname": fname,
            "email": current_user.email,
            "initial": initial
        }
        logger.debug(f"Session check successful for user: {current_user.name}")
        return jsonify(user_data), 200
    
    logger.debug("Session check failed - user not authenticated")
    return jsonify({"loggedIn": False}), 401


# The scheduler will call this function at the specified interval
EXPIRATION_HOURS = 24

def delete_expired_unverified_users():
    expiry_time = datetime.utcnow() - timedelta(hours=EXPIRATION_HOURS)
    expired_users = User.query.filter(
        User.is_verified == False,
        User.created_at < expiry_time
    ).all()

    for user in expired_users:
        print(f"Deleting unverified user: {user.email}")
        db.session.delete(user)

    db.session.commit()
    return len(expired_users)

from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()

@scheduler.scheduled_job("interval", hours=1)
def cleanup_job():
    deleted = delete_expired_unverified_users()
    print(f"Deleted {deleted} expired unverified users")

scheduler.start()
