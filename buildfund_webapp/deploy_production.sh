#!/bin/bash
# Production Deployment Script for www.buildfund.co.uk

set -e  # Exit on error

echo "=========================================="
echo "BuildFund Production Deployment"
echo "www.buildfund.co.uk"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please create .env file with production configuration"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Verify critical settings
if [ "$DJANGO_DEBUG" != "False" ]; then
    echo "WARNING: DJANGO_DEBUG is not False. This is not recommended for production!"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "1. Installing/updating Python dependencies..."
pip install -r requirements.txt

echo ""
echo "2. Running database migrations..."
python manage.py migrate --noinput

echo ""
echo "3. Collecting static files..."
python manage.py collectstatic --noinput

echo ""
echo "4. Creating necessary directories..."
mkdir -p media
mkdir -p staticfiles
mkdir -p logs

echo ""
echo "5. Setting file permissions..."
chmod 600 .env
chmod -R 755 media
chmod -R 755 staticfiles

echo ""
echo "6. Checking for unapplied migrations..."
UNAPPLIED=$(python manage.py showmigrations --plan | grep "\[ \]" | wc -l)
if [ "$UNAPPLIED" -gt 0 ]; then
    echo "   WARNING: $UNAPPLIED unapplied migration(s) found"
    echo "   Run: python manage.py migrate"
else
    echo "   [OK] All migrations applied"
fi

echo ""
echo "7. Testing Django configuration..."
python manage.py check --deploy

echo ""
echo "=========================================="
echo "Deployment Preparation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Restart Gunicorn: sudo systemctl restart buildfund"
echo "2. Reload Nginx: sudo systemctl reload nginx"
echo "3. Test: https://www.buildfund.co.uk"
echo ""
