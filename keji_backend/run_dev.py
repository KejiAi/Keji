"""
Development server launcher for local testing.

This script ensures eventlet.monkey_patch() is called BEFORE any other imports,
which is required for proper WebSocket support.

Usage:
    python run_dev.py

For production, use:
    gunicorn --config gunicorn_config.py app:app
"""

# CRITICAL: Monkey patch MUST be the very first thing!
import eventlet
# Patch only what we need (socket, select, thread, time)
# Don't patch SSL to avoid recursion errors with OpenAI and Resend
eventlet.monkey_patch(
    socket=True,
    select=True,
    thread=True,
    time=True,
    os=False,
    psycopg=False
)

# Now it's safe to import everything else
import os
from app import app, socketio

if __name__ == "__main__":
    # Get port from environment or default to 5000
    port = int(os.environ.get("PORT", 5000))
    
    print("=" * 60)
    print("Starting Keji AI Backend (Development Mode)")
    print(f"Running on: http://0.0.0.0:{port}")
    print("Auto-reload: ENABLED | WebSocket: ENABLED")
    print("=" * 60)
    print()
    
    # Use socketio.run() for WebSocket support
    socketio.run(
        app, 
        debug=True, 
        host='0.0.0.0', 
        port=port,
        use_reloader=True,
        log_output=True
    )

