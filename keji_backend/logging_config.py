"""
Logging configuration for the Flask application.
This module provides centralized logging setup and configuration.
"""

import logging
import os
from logging.handlers import RotatingFileHandler

def setup_logging(app):
    """
    Set up logging configuration for the Flask application.
    
    Args:
        app: Flask application instance
    """
    
    # Create logs directory if it doesn't exist
    if not os.path.exists('logs'):
        os.makedirs('logs')
    
    # Set logging level based on environment
    log_level = logging.DEBUG if app.debug else logging.INFO
    
    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
        handlers=[
            logging.StreamHandler(),  # Console output
            RotatingFileHandler('logs/app.log', maxBytes=10240000, backupCount=10)  # File output with rotation
        ]
    )
    
    # Set specific loggers
    logging.getLogger('werkzeug').setLevel(logging.WARNING)  # Reduce Flask's internal logging
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)  # Reduce SQLAlchemy logging
    
    # Create application logger
    app_logger = logging.getLogger(__name__)
    app_logger.info("Logging configuration completed")
    
    return app_logger

def get_logger(name):
    """
    Get a logger instance for a specific module.
    
    Args:
        name: Name of the module (usually __name__)
        
    Returns:
        Logger instance
    """
    return logging.getLogger(name)
