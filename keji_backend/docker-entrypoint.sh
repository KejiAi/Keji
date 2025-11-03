#!/bin/bash
set -e

echo "🚀 Starting Keji AI Backend..."

# Run database migrations (optional - skips if already applied)
if [ -n "$DATABASE_URL" ]; then
    echo "🔄 Running database migrations..."
    flask db upgrade || echo "⚠️  Migrations skipped"
fi

# Start the application
echo "🚀 Starting Gunicorn server..."
exec gunicorn --config gunicorn_config.py app:app

