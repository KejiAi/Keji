"""
Gunicorn configuration file for production deployment with Eventlet workers.

This config ensures eventlet monkey patching happens ONLY in worker processes,
not in the Gunicorn master/arbiter process.
"""

import multiprocessing

# Server socket
bind = "0.0.0.0:5000"
backlog = 2048

# Worker processes
workers = 1  # MUST be 1 for WebSocket with eventlet
worker_class = "eventlet"
worker_connections = 1000
max_requests = 0  # No automatic worker restart (keep WebSocket connections alive)
max_requests_jitter = 0
timeout = 120  # 2 minutes timeout for long AI processing
keepalive = 25  # Keep connections alive with 25 second keepalive

# Logging
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "keji_ai_backend"

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL (uncomment and configure for HTTPS)
# keyfile = "/path/to/keyfile"
# certfile = "/path/to/certfile"


def post_fork(server, worker):
    """
    Called just after a worker has been forked.
    This is the CORRECT place to monkey patch for eventlet.
    """
    import eventlet
    eventlet.monkey_patch()
    server.log.info("Eventlet monkey patched in worker process %s", worker.pid)


def when_ready(server):
    """Called just after the server is started."""
    server.log.info("Keji AI Backend server is ready. Spawning workers")


def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info("Starting Keji AI Backend with Eventlet workers")


def worker_int(worker):
    """Called when a worker receives the INT or QUIT signal."""
    worker.log.info("Worker received INT or QUIT signal")


def worker_abort(worker):
    """Called when a worker receives the SIGABRT signal."""
    worker.log.info("Worker received SIGABRT signal")

