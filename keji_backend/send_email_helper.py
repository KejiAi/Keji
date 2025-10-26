"""
Standalone email sending script.
This runs as a separate process, completely isolated from Eventlet.
"""

import sys
import json
import os

def send_email_subprocess(api_key, from_email, to_email, subject, html_content, text_content=None):
    """Send email using Resend SDK (runs in isolated process)"""
    try:
        import resend
        
        resend.api_key = api_key
        
        params = {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        
        if text_content:
            params["text"] = text_content
        
        response = resend.Emails.send(params)
        
        # Return success with message ID
        result = {
            "success": True,
            "id": response.get('id', 'unknown') if isinstance(response, dict) else 'unknown'
        }
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        # Return error
        result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(result))
        sys.exit(1)

if __name__ == "__main__":
    # Parse arguments from command line
    if len(sys.argv) < 6:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)
    
    api_key = sys.argv[1]
    from_email = sys.argv[2]
    to_email = sys.argv[3]
    subject = sys.argv[4]
    html_content = sys.argv[5]
    text_content = sys.argv[6] if len(sys.argv) > 6 else None
    
    send_email_subprocess(api_key, from_email, to_email, subject, html_content, text_content)

