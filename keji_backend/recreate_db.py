"""
Script to test Supabase connection and recreate all database tables.
Run with: python recreate_db.py
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Check which database URL variable is set
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI")

if not DATABASE_URL:
    print("❌ ERROR: No database URL found!")
    print("   Please set DATABASE_URL or SQLALCHEMY_DATABASE_URI in your .env file")
    print("\n   For Supabase, it should look like:")
    print("   DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres")
    sys.exit(1)

# Mask password for display
display_url = DATABASE_URL
if "@" in display_url and ":" in display_url:
    # Mask password between :// and @
    start = display_url.find("://") + 3
    at_pos = display_url.find("@")
    colon_pos = display_url.find(":", start)
    if colon_pos < at_pos:
        display_url = display_url[:colon_pos+1] + "****" + display_url[at_pos:]

print("=" * 60)
print("🔗 SUPABASE DATABASE CONNECTION TEST")
print("=" * 60)
print(f"\n📍 Connection URL: {display_url}")

# Test raw connection first
print("\n📡 Testing connection...")

try:
    from sqlalchemy import create_engine, text
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version()"))
        version = result.fetchone()[0]
        print(f"✅ Connected successfully!")
        print(f"   PostgreSQL version: {version[:50]}...")
        
except Exception as e:
    print(f"❌ Connection failed: {str(e)}")
    sys.exit(1)

# Now test with Flask app
print("\n" + "=" * 60)
print("🗃️  RECREATING DATABASE TABLES")
print("=" * 60)

# Set the environment variable that Flask app expects
os.environ["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL

# Import Flask app and models
from app import app, db
from models import User, Conversation, Message, MessageAttachment, Feedback

print("\n📋 Tables to create:")
print("   - User")
print("   - Conversation")
print("   - Message")
print("   - MessageAttachment")
print("   - Feedback")

# Confirm before proceeding
print("\n⚠️  WARNING: This will DROP all existing tables and data!")
confirm = input("   Type 'yes' to continue: ")

if confirm.lower() != 'yes':
    print("\n❌ Aborted.")
    sys.exit(0)

try:
    with app.app_context():
        print("\n🗑️  Dropping all tables...")
        db.drop_all()
        print("   Done.")
        
        print("\n🔨 Creating all tables...")
        db.create_all()
        print("   Done.")
        
        # Verify tables were created
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        print(f"\n✅ Tables created successfully!")
        print(f"   Found {len(tables)} tables: {', '.join(tables)}")
        
except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    sys.exit(1)

print("\n" + "=" * 60)
print("🎉 DATABASE SETUP COMPLETE!")
print("=" * 60 + "\n")
