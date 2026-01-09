"""
Auth Utilities for Keji Backend

This module contains:
- Background scheduler for DB maintenance (keep Supabase connection alive)
- Health check endpoint

Note: Authentication is now fully handled by Supabase on the frontend.
User data (name, email, initials, greeting) comes from Supabase user metadata.
"""

from flask import Blueprint
from extensions import db
import logging
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__)


# =============================================================================
# Background Scheduler (Keep Supabase DB Alive)
# =============================================================================

from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()


def init_scheduler(app):
    """
    Initialize scheduled jobs with Flask app context.
    Must be called after app is created.
    
    Primary purpose: Keep Supabase/database connection alive to avoid cold starts.
    Free tier databases hibernate after ~5 minutes of inactivity.
    """
    
    def keep_db_alive():
        """
        Ping the database every 4 minutes to prevent database hibernation.
        """
        with app.app_context():
            try:
                # Simple lightweight query to keep connection alive
                result = db.session.execute(db.text("SELECT 1")).scalar()
                logger.debug(f"Database keep-alive ping successful (result: {result})")
            except Exception as e:
                logger.error(f"Database keep-alive ping failed: {str(e)}", exc_info=True)
    
    # Register keep-alive job - ping every 4 minutes
    scheduler.add_job(keep_db_alive, 'interval', minutes=4, id='keep_db_alive')
    
    # Register worker jobs (summary generation, daily chat clearing)
    try:
        from workers import register_workers
        register_workers(scheduler, app)
    except ImportError:
        logger.warning("Workers module not found - skipping worker job registration")
    except Exception as e:
        logger.error(f"Failed to register workers: {str(e)}")
    
    # Start scheduler
    if not scheduler.running:
        scheduler.start()
        logger.info("Background scheduler started (keep-alive ping every 4 minutes)")


# =============================================================================
# Health Check Endpoint
# =============================================================================

@auth_bp.route("/health", methods=["GET"])
def health_check():
    """Simple health check endpoint for monitoring."""
    return {"status": "ok", "service": "keji-backend"}, 200
