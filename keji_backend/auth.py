from flask import Blueprint, request, jsonify, session, make_response
from app import db
from models import User
from flask_login import login_user, logout_user, login_required, current_user
import logging

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/sign-up", methods=["POST"])
def signup():
    data = request.get_json()
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400

    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "User created successfully"}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    logger.info(f"Login attempt for email: {email}")
    
    user = User.query.filter_by(email=email).first()
    if user and user.check_password(password):
        login_user(user, remember=True)
        session.permanent = True  # Make session permanent (indefinite)
        logger.info(f"Successful login for user: {user.name} (ID: {user.id})")
        return jsonify({"message": "Login successful"}), 200
    
    logger.warning(f"Failed login attempt for email: {email}")
    return jsonify({"error": "Invalid email or password"}), 401


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