#!/bin/bash
# Check for banned secret patterns in source code
# This script should be run before committing code

set -e

BANNED_PATTERNS=(
    "sk-[a-zA-Z0-9_-]{20,}"
    "AIza[0-9A-Za-z_-]{35}"
    "BEGIN PRIVATE KEY"
    "BEGIN RSA PRIVATE KEY"
    "api_key.*=.*['\"][^'\"]{20,}"
)

EXCLUDE_DIRS="node_modules|__pycache__|\.git|\.env|build|dist|\.cache"

FOUND_SECRETS=0

echo "Scanning for banned secret patterns..."

for pattern in "${BANNED_PATTERNS[@]}"; do
    if grep -rE "$pattern" \
        --exclude-dir="{$EXCLUDE_DIRS}" \
        --exclude="*.example" \
        --exclude="*.env.example" \
        --exclude="check-secrets.sh" \
        --exclude="production_checklist.sh" \
        . 2>/dev/null | grep -v "^Binary" | head -5; then
        echo "❌ Found banned pattern: $pattern"
        FOUND_SECRETS=1
    fi
done

if [ $FOUND_SECRETS -eq 1 ]; then
    echo ""
    echo "❌ Secrets detected! Do not commit."
    echo "Remove secrets from files before committing."
    exit 1
fi

echo "✅ No secrets detected"
exit 0
