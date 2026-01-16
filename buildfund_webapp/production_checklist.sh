#!/bin/bash
# Production Deployment Checklist Script for www.buildfund.co.uk

echo "=========================================="
echo "BuildFund Production Deployment Checklist"
echo "=========================================="
echo ""

# Check environment variables
echo "1. Checking Environment Variables..."
if [ -f .env ]; then
    echo "   [OK] .env file exists"
    
    # Check critical variables
    if grep -q "DJANGO_SECRET_KEY=" .env && ! grep -q "DJANGO_SECRET_KEY=change-me" .env; then
        echo "   [OK] DJANGO_SECRET_KEY is set"
    else
        echo "   [ERROR] DJANGO_SECRET_KEY not set or using default"
    fi
    
    if grep -q "DJANGO_DEBUG=False" .env; then
        echo "   [OK] DJANGO_DEBUG is False"
    else
        echo "   [WARNING] DJANGO_DEBUG should be False in production"
    fi
    
    if grep -q "www.buildfund.co.uk" .env; then
        echo "   [OK] Production domain configured"
    else
        echo "   [WARNING] Production domain not found in .env"
    fi
    
    if grep -q "GOOGLE_API_KEY=" .env && ! grep -q "GOOGLE_API_KEY=\[YOUR" .env; then
        echo "   [OK] GOOGLE_API_KEY is set"
    else
        echo "   [ERROR] GOOGLE_API_KEY not configured"
    fi
    
    if grep -q "HMRC_API_KEY=" .env && ! grep -q "HMRC_API_KEY=your_hmrc" .env; then
        echo "   [OK] HMRC_API_KEY is set"
    else
        echo "   [ERROR] HMRC_API_KEY not configured"
    fi
else
    echo "   [ERROR] .env file not found"
fi

echo ""
echo "2. Checking Database..."
python manage.py check --database default 2>&1 | grep -q "System check identified" && echo "   [OK] Database connection works" || echo "   [WARNING] Check database connection"

echo ""
echo "3. Checking Migrations..."
python manage.py showmigrations --plan | grep -q "\[ \]" && echo "   [WARNING] Unapplied migrations found" || echo "   [OK] All migrations applied"

echo ""
echo "4. Checking Static Files..."
if [ -d "staticfiles" ]; then
    echo "   [OK] staticfiles directory exists"
else
    echo "   [WARNING] Run: python manage.py collectstatic"
fi

echo ""
echo "5. Security Checks..."
if [ -f .env ] && [ -r .env ]; then
    PERMS=$(stat -c "%a" .env 2>/dev/null || stat -f "%OLp" .env 2>/dev/null)
    if [ "$PERMS" = "600" ] || [ "$PERMS" = "400" ]; then
        echo "   [OK] .env file permissions are secure"
    else
        echo "   [WARNING] .env file should have 600 permissions (chmod 600 .env)"
    fi
fi

echo ""
echo "6. API Keys Security..."
# Check for common API key patterns in code (not in .env files)
if grep -rE "(sk-[a-zA-Z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})" --exclude-dir=node_modules --exclude="*.pyc" --exclude=".env" --exclude="*.env.example" --exclude="production_checklist.sh" . 2>/dev/null | grep -q .; then
    echo "   [ERROR] Potential API keys found in code files (should only be in .env)"
    echo "   [WARNING] Review the files above and ensure no secrets are committed"
else
    echo "   [OK] No obvious API key patterns found in code"
fi

echo ""
echo "=========================================="
echo "Checklist Complete"
echo "=========================================="
