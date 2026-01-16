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
    
    if grep -q "COMPANIES_HOUSE_API_KEY=" .env && ! grep -q "COMPANIES_HOUSE_API_KEY=\[YOUR" .env; then
        echo "   [OK] COMPANIES_HOUSE_API_KEY is set"
    else
        echo "   [ERROR] COMPANIES_HOUSE_API_KEY not configured"
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
if grep -r "AIzaSyAxx5YgFTXW0CEze3iriL2Bg01FxNM6k_M\|06b96b3f-520d-45d3-8c47-40a51c560a2d" --exclude-dir=node_modules --exclude="*.pyc" --exclude=".env" . 2>/dev/null | grep -q .; then
    echo "   [ERROR] API keys found in code files (should only be in .env)"
else
    echo "   [OK] No API keys found in code"
fi

echo ""
echo "=========================================="
echo "Checklist Complete"
echo "=========================================="
