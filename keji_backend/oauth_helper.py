"""
Standalone OAuth script for Google OAuth operations.
This runs as a separate process, completely isolated from Eventlet.
"""

import sys
import json
import os
import urllib.parse
import secrets

def generate_oauth_redirect(redirect_uri, client_id, client_secret, server_metadata_url):
    """Generate OAuth authorization redirect URL (runs in isolated process)"""
    try:
        import requests
        
        # Fetch server metadata (this makes HTTPS request, but we're in clean process)
        metadata_response = requests.get(server_metadata_url, timeout=10)
        metadata_response.raise_for_status()
        metadata = metadata_response.json()
        
        # Generate state for CSRF protection
        state = secrets.token_urlsafe(32)
        
        # Build authorization URL
        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': 'openid email profile',
            'state': state,
            'access_type': 'offline',
            'prompt': 'consent'
        }
        
        authorization_url = f"{metadata['authorization_endpoint']}?{urllib.parse.urlencode(params)}"
        
        result = {
            "success": True,
            "authorization_url": authorization_url,
            "state": state
        }
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        import traceback
        result = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(result))
        sys.exit(1)


def exchange_oauth_token(authorization_code, redirect_uri, client_id, client_secret, server_metadata_url):
    """Exchange OAuth authorization code for access token (runs in isolated process)"""
    try:
        import requests
        
        # Fetch server metadata (this makes HTTPS request, but we're in clean process)
        metadata_response = requests.get(server_metadata_url, timeout=10)
        metadata_response.raise_for_status()
        metadata = metadata_response.json()
        
        # Exchange authorization code for access token
        token_data = {
            'code': authorization_code,
            'client_id': client_id,
            'client_secret': client_secret,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        }
        
        token_response = requests.post(
            metadata['token_endpoint'],
            data=token_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=10
        )
        token_response.raise_for_status()
        token = token_response.json()
        
        # Get user info from userinfo endpoint
        userinfo_response = requests.get(
            metadata['userinfo_endpoint'],
            headers={'Authorization': f"Bearer {token['access_token']}"},
            timeout=10
        )
        userinfo_response.raise_for_status()
        user_info = userinfo_response.json()
        
        result = {
            "success": True,
            "token": token,
            "userinfo": user_info
        }
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        import traceback
        result = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(result))
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing operation argument"}))
        sys.exit(1)
    
    operation = sys.argv[1]
    
    if operation == "redirect":
        # Generate redirect URL
        if len(sys.argv) < 6:
            print(json.dumps({"success": False, "error": "Missing arguments for redirect"}))
            sys.exit(1)
        
        redirect_uri = sys.argv[2]
        client_id = sys.argv[3]
        client_secret = sys.argv[4]
        server_metadata_url = sys.argv[5]
        
        generate_oauth_redirect(redirect_uri, client_id, client_secret, server_metadata_url)
        
    elif operation == "token":
        # Exchange code for token
        if len(sys.argv) < 7:
            print(json.dumps({"success": False, "error": "Missing arguments for token exchange"}))
            sys.exit(1)
        
        authorization_code = sys.argv[2]
        redirect_uri = sys.argv[3]
        client_id = sys.argv[4]
        client_secret = sys.argv[5]
        server_metadata_url = sys.argv[6]
        
        exchange_oauth_token(authorization_code, redirect_uri, client_id, client_secret, server_metadata_url)
    else:
        print(json.dumps({"success": False, "error": f"Unknown operation: {operation}"}))
        sys.exit(1)

