# Logging Setup for Flask Backend

This document describes the comprehensive logging setup implemented for debugging and monitoring the Flask backend application.

## Overview

The logging system has been enhanced with:

- **Structured logging** with timestamps, module names, and line numbers
- **Multiple log levels** (DEBUG, INFO, WARNING, ERROR)
- **File rotation** to prevent log files from growing too large
- **Request/Response logging** for API endpoints
- **Database operation logging** for debugging data issues
- **Authentication flow logging** for security monitoring

## Log Files

- **Console Output**: All logs are displayed in the console during development
- **File Output**: Logs are saved to `logs/app.log` with automatic rotation
- **Log Rotation**: Files are rotated when they reach 10MB, keeping 10 backup files

## Log Levels Used

### DEBUG

- Detailed information for debugging
- Database queries and operations
- User authentication details
- File upload information
- LLM request/response details

### INFO

- General application flow
- User actions (login, signup, chat requests)
- Successful operations
- Application startup/shutdown

### WARNING

- Failed authentication attempts
- Invalid verification codes
- Missing or invalid data

### ERROR

- Email sending failures
- Database errors
- Unhandled exceptions

## Key Logging Points

### Authentication (`auth.py`)

- User signup attempts and results
- Email verification processes
- Login attempts (successful and failed)
- Password reset requests
- User cleanup operations

### Chat System (`chat.py`)

- Chat message processing
- File upload handling
- LLM interactions
- Conversation management
- Message history retrieval

### Database Operations (`models.py`)

- Password hashing operations
- User authentication checks

### Application Level (`app.py`)

- Request/response logging for all endpoints
- User session management
- Error handling and exception logging

## Usage Examples

### In Your Code

```python
import logging

# Get logger for your module
logger = logging.getLogger(__name__)

# Log different levels
logger.debug("Detailed debugging information")
logger.info("General information about application flow")
logger.warning("Something unexpected happened")
logger.error("An error occurred", exc_info=True)
```

### Logging User Actions

```python
logger.info(f"User {user.name} ({user.email}) performed action: {action}")
logger.debug(f"Action details: {action_details}")
```

### Logging API Requests

```python
logger.info(f"API request: {request.method} {request.url}")
logger.debug(f"Request data: {request.get_json()}")
```

## Monitoring and Debugging

### Common Debug Scenarios

1. **Authentication Issues**

   - Check for failed login attempts in logs
   - Verify email verification processes
   - Monitor password reset flows

2. **Chat System Problems**

   - Review message processing logs
   - Check file upload handling
   - Monitor LLM response generation

3. **Database Issues**

   - Review database operation logs
   - Check for connection problems
   - Monitor query performance

4. **Email Delivery Problems**
   - Check email sending logs
   - Verify SMTP configuration
   - Monitor verification email delivery

### Log Analysis Tips

- Use `grep` to filter logs by user email or action type
- Look for ERROR and WARNING levels first
- Check timestamps to correlate issues with user actions
- Review request/response logs for API debugging

## Configuration

The logging configuration is centralized in `logging_config.py` and can be customized:

- **Log Level**: Set based on environment (DEBUG for development, INFO for production)
- **File Rotation**: Adjust size limits and backup count
- **Format**: Customize log message format
- **Handlers**: Add additional log destinations (database, external services)

## Security Considerations

- **Sensitive Data**: Passwords and tokens are never logged
- **User Privacy**: Email addresses are logged for debugging but can be filtered in production
- **Log Access**: Ensure log files have appropriate permissions
- **Log Retention**: Consider log retention policies for compliance

## Production Recommendations

1. Set log level to INFO or WARNING in production
2. Implement log aggregation (ELK stack, Splunk, etc.)
3. Set up log monitoring and alerting
4. Implement log retention policies
5. Consider using structured logging (JSON format) for better parsing
