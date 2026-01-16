# Security Remediation Plan
**Date:** $(date)  
**Status:** Implementation Guide

---

## A. Repository Containment and Hygiene

### A.1: Identified Tracked Files

**Tracked .env files (REMOVED from index):**
- ✅ `buildfund_webapp/.env` - REMOVED
- ✅ `new_website/.env` - REMOVED
- ✅ `buildfund_webapp/.env.example` - KEPT (safe, contains placeholders only)

**Files with hardcoded secrets (to be removed from history):**
- `buildfund_webapp/-LAPTOP-AR0LDBHL.env` - Contains real API keys (not tracked, but exists locally)

### A.2: Git Commands Executed

```bash
# Remove tracked .env files from Git index (local files preserved)
git rm --cached buildfund_webapp/.env
git rm --cached new_website/.env
```

### A.3: .gitignore Updated

✅ Enhanced `.gitignore` with comprehensive patterns:
- `.env`, `.env.*`, `*.env`, `*.env.local`, `*.env.production`
- `*-LAPTOP-*.env`, `*-DESKTOP-*.env`, `*-PC-*.env`
- Machine-specific environment files

### A.4: .env.example Files

✅ Created/Updated:
- `buildfund_webapp/.env.example` - Complete with all required variables
- `new_website/.env.example` - Frontend environment variables

---

## B. Git History Rewrite Plan

### B.1: Tool Selection
**Recommended:** `git filter-repo` (modern, safer than filter-branch)

### B.2: Installation
```bash
# Install git-filter-repo
pip install git-filter-repo
# OR on macOS
brew install git-filter-repo
```

### B.3: Exact Commands for History Rewrite

**⚠️ WARNING: These commands rewrite Git history. Coordinate with all team members.**

```bash
# 1. Backup your repository first!
cd "C:\dev\BuildFund\1.0 Website Dev\GitHub"
git clone --mirror . ../BuildFund-backup.git

# 2. Remove .env files from all history
git filter-repo --path buildfund_webapp/.env --invert-paths
git filter-repo --path new_website/.env --invert-paths
git filter-repo --path buildfund_webapp/-LAPTOP-AR0LDBHL.env --invert-paths

# 3. Remove files containing hardcoded secrets (if any found in history)
# Check first:
git log --all --full-history --source --all -- "**/*.env" | head -20

# 4. Force push to remote (coordinate with team!)
git push origin --force --all
git push origin --force --tags

# 5. Require all developers to:
#    - Delete their local repository
#    - Re-clone from remote
#    - Recreate their .env files from .env.example
```

### B.4: Alternative: BFG Repo-Cleaner

If `git filter-repo` is not available:

```bash
# Download BFG: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --delete-files ".env" --delete-files "-LAPTOP-*.env"
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### B.5: Coordination Instructions

**Before executing:**
1. Notify all team members
2. Ensure all work is committed and pushed
3. Create a backup branch: `git branch backup-before-history-rewrite`

**After executing:**
1. Send team-wide notification
2. Provide re-clone instructions
3. Update CI/CD pipelines (invalidate caches)
4. Verify no secrets remain: `git log --all -p | grep -E "(sk-|AIza|api_key)"`

---

## C. Guardrails to Prevent Recurrence

### C.1: Secret Scanning in CI

**Option 1: Gitleaks (Recommended)**

Create `.github/workflows/secret-scanning.yml`:

```yaml
name: Secret Scanning

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Full history for better detection
      
      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Upload results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: gitleaks-report
          path: gitleaks-report.json
```

**Installation for local use:**
```bash
# Download from: https://github.com/gitleaks/gitleaks/releases
# Or use: brew install gitleaks

# Create .gitleaksignore (optional)
echo ".env.example" > .gitleaksignore

# Run scan
gitleaks detect --source . --verbose
```

**Option 2: TruffleHog**

```yaml
name: Secret Scanning

on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Run TruffleHog
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
```

### C.2: Pre-commit Hook (Optional but Recommended)

Create `.git/hooks/pre-commit` (or use husky for Node projects):

```bash
#!/bin/bash
# Pre-commit hook to scan for secrets

# Install gitleaks first: https://github.com/gitleaks/gitleaks

# Scan staged files
gitleaks protect --staged --verbose --no-banner

if [ $? -ne 0 ]; then
    echo "❌ Secret detected! Commit blocked."
    echo "Remove secrets from staged files before committing."
    exit 1
fi

# Also check for common patterns
if git diff --cached --name-only | xargs grep -lE "(sk-[a-zA-Z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35})" 2>/dev/null; then
    echo "❌ Potential API key detected in staged files!"
    exit 1
fi

exit 0
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

### C.3: Simple Script to Check for Banned Patterns

Create `scripts/check-secrets.sh`:

```bash
#!/bin/bash
# Check for banned secret patterns in source code

BANNED_PATTERNS=(
    "sk-[a-zA-Z0-9_-]{20,}"
    "AIza[0-9A-Za-z_-]{35}"
    "BEGIN PRIVATE KEY"
    "BEGIN RSA PRIVATE KEY"
    "api_key.*=.*['\"][^'\"]{20,}"
)

EXCLUDE_DIRS="node_modules|__pycache__|\.git|\.env|build|dist"

FOUND_SECRETS=0

for pattern in "${BANNED_PATTERNS[@]}"; do
    if grep -rE "$pattern" --exclude-dir="{$EXCLUDE_DIRS}" --exclude="*.example" . 2>/dev/null; then
        echo "❌ Found banned pattern: $pattern"
        FOUND_SECRETS=1
    fi
done

if [ $FOUND_SECRETS -eq 1 ]; then
    echo "❌ Secrets detected! Do not commit."
    exit 1
fi

echo "✅ No secrets detected"
exit 0
```

Add to `package.json` (frontend):
```json
{
  "scripts": {
    "check-secrets": "bash ../scripts/check-secrets.sh"
  }
}
```

---

## D. Attacker-Focused Improvements

### D.1: Disable Source Maps in Production

**For Create React App (CRA):**

Update `new_website/package.json`:

```json
{
  "scripts": {
    "build": "GENERATE_SOURCEMAP=false react-scripts build",
    "build:dev": "react-scripts build"
  }
}
```

**Alternative: Create `.env.production` file:**
```bash
# new_website/.env.production
GENERATE_SOURCEMAP=false
```

**Verify in CI:**
```yaml
- name: Verify no source maps
  run: |
    npm run build
    if find build -name "*.map" | grep -q .; then
      echo "❌ Source maps found in production build!"
      exit 1
    fi
```

### D.2: Remove Console Logging from Production

**Option 1: Babel Plugin (Recommended for CRA)**

Install:
```bash
cd new_website
npm install --save-dev babel-plugin-transform-remove-console
```

Create/update `new_website/.babelrc` or add to `package.json`:

```json
{
  "babel": {
    "env": {
      "production": {
        "plugins": ["transform-remove-console"]
      }
    }
  }
}
```

**Option 2: Conditional Logging Wrapper**

Create `new_website/src/utils/logger.js`:

```javascript
// Production-safe logging utility
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  error: (...args) => {
    // Always log errors, but sanitize in production
    if (isDevelopment) {
      console.error(...args);
    } else {
      // In production, send to error tracking service (e.g., Sentry)
      // console.error('[Production Error]', ...args);
    }
  },
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  }
};
```

**Option 3: Terser Plugin (Build-time removal)**

Update `new_website/package.json` (if using custom webpack config):

```json
{
  "scripts": {
    "build": "react-scripts build && npm run remove-console"
  }
}
```

**Recommended: Use babel-plugin-transform-remove-console** (simplest for CRA)

### D.3: Stage 1 Token Storage Migration

**Goal:** Store tokens in memory, keep localStorage as fallback for backward compatibility.

**Files to modify:**
1. `new_website/src/api.js` - Token storage/retrieval
2. `new_website/src/App.js` - Initial token loading
3. `new_website/src/pages/Login.js` - Token storage after login

**Implementation:**

Create `new_website/src/utils/tokenStorage.js`:

```javascript
/**
 * Secure token storage utility
 * Stage 1: Store in memory, fallback to localStorage for migration
 */

// In-memory token storage (not accessible via JavaScript in browser console)
let memoryToken = null;
let memoryRole = null;
let memoryUsername = null;
let memoryStepUpSessionKey = null;
let memoryStepUpExpiresAt = null;

// Feature flag to control migration
const USE_MEMORY_STORAGE = true; // Set to false to rollback

export const tokenStorage = {
  // Token management
  getToken: () => {
    if (USE_MEMORY_STORAGE && memoryToken) {
      return memoryToken;
    }
    // Fallback to localStorage for backward compatibility
    return localStorage.getItem('token');
  },

  setToken: (token) => {
    if (USE_MEMORY_STORAGE) {
      memoryToken = token;
      // Stop writing to localStorage (migration)
      // localStorage.removeItem('token'); // Uncomment in Stage 2
    } else {
      localStorage.setItem('token', token);
    }
  },

  removeToken: () => {
    memoryToken = null;
    localStorage.removeItem('token');
  },

  // Role management
  getRole: () => {
    if (USE_MEMORY_STORAGE && memoryRole) {
      return memoryRole;
    }
    return localStorage.getItem('role');
  },

  setRole: (role) => {
    if (USE_MEMORY_STORAGE) {
      memoryRole = role;
    } else {
      localStorage.setItem('role', role);
    }
  },

  removeRole: () => {
    memoryRole = null;
    localStorage.removeItem('role');
  },

  // Username management
  getUsername: () => {
    if (USE_MEMORY_STORAGE && memoryUsername) {
      return memoryUsername;
    }
    return localStorage.getItem('username');
  },

  setUsername: (username) => {
    if (USE_MEMORY_STORAGE) {
      memoryUsername = username;
    } else {
      localStorage.setItem('username', username);
    }
  },

  // Step-up authentication
  getStepUpSessionKey: () => {
    if (USE_MEMORY_STORAGE && memoryStepUpSessionKey) {
      return memoryStepUpSessionKey;
    }
    return localStorage.getItem('stepUpSessionKey');
  },

  setStepUpSessionKey: (key, expiresAt) => {
    if (USE_MEMORY_STORAGE) {
      memoryStepUpSessionKey = key;
      memoryStepUpExpiresAt = expiresAt;
    } else {
      localStorage.setItem('stepUpSessionKey', key);
      localStorage.setItem('stepUpExpiresAt', expiresAt);
    }
  },

  removeStepUpSession: () => {
    memoryStepUpSessionKey = null;
    memoryStepUpExpiresAt = null;
    localStorage.removeItem('stepUpSessionKey');
    localStorage.removeItem('stepUpExpiresAt');
  },

  // Clear all (logout)
  clearAll: () => {
    memoryToken = null;
    memoryRole = null;
    memoryUsername = null;
    memoryStepUpSessionKey = null;
    memoryStepUpExpiresAt = null;
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('stepUpSessionKey');
    localStorage.removeItem('stepUpExpiresAt');
  },

  // Migration helper: Load from localStorage on app start
  migrateFromLocalStorage: () => {
    if (USE_MEMORY_STORAGE) {
      const token = localStorage.getItem('token');
      const role = localStorage.getItem('role');
      const username = localStorage.getItem('username');
      
      if (token) {
        memoryToken = token;
        if (role) memoryRole = role;
        if (username) memoryUsername = username;
      }
    }
  }
};
```

**Update `new_website/src/api.js`:**

```javascript
import axios from 'axios';
import { tokenStorage } from './utils/tokenStorage';

// ... existing code ...

api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getToken(); // Changed from localStorage.getItem
    if (token && !config.url?.includes('/api/auth/token/')) {
      config.headers['Authorization'] = `Token ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// In error handler, update logout:
if (error.response.status === 401 && !isStepUpAuth && !isPermissionError) {
  if (window.location.pathname !== '/login' && !error.config?.url?.includes('/api/auth/token/')) {
    tokenStorage.clearAll(); // Changed from localStorage.removeItem
    window.location.href = '/login';
  }
}
```

**Update `new_website/src/App.js`:**

```javascript
import { tokenStorage } from './utils/tokenStorage';

function App() {
  // Migrate from localStorage on mount
  React.useEffect(() => {
    tokenStorage.migrateFromLocalStorage();
  }, []);

  const [token, setToken] = React.useState(() => tokenStorage.getToken());
  const [role, setRole] = React.useState(() => tokenStorage.getRole());

  const handleLogin = (tok, userRole) => {
    tokenStorage.setToken(tok);
    tokenStorage.setRole(userRole);
    setToken(tok);
    setRole(userRole);
  };

  const handleLogout = () => {
    tokenStorage.clearAll();
    setToken(null);
    setRole(null);
  };

  // ... rest of component
}
```

**Update `new_website/src/pages/Login.js`:**

```javascript
import { tokenStorage } from '../utils/tokenStorage';

// In handleSubmit, after successful login:
tokenStorage.setToken(token);
tokenStorage.setRole(userRole);
tokenStorage.setUsername(usernameToStore);
```

**Stage 2 Migration Checklist:**
- [ ] Monitor Stage 1 for 2-4 weeks
- [ ] Verify no localStorage dependencies remain
- [ ] Update `tokenStorage.js`: Remove localStorage fallback
- [ ] Update `tokenStorage.js`: Set `USE_MEMORY_STORAGE = true` permanently
- [ ] Remove `migrateFromLocalStorage()` function
- [ ] Implement HttpOnly cookie backend endpoint
- [ ] Update login flow to use cookies instead of tokens
- [ ] Remove token storage entirely

---

## Verification Checklist

Run these commands to verify remediation:

```bash
# 1. Check no .env files are tracked
git ls-files | grep "\.env$"
# Should only show .env.example files

# 2. Check .gitignore is working
git status
# Should not show .env files as untracked (they're ignored)

# 3. Install dependencies
cd new_website && npm install
cd ../buildfund_webapp && pip install -r requirements.txt

# 4. Run linters (if configured)
cd new_website && npm run lint
cd ../buildfund_webapp && python manage.py check

# 5. Production build (frontend)
cd new_website
npm run build
# Verify no source maps:
find build -name "*.map" | wc -l
# Should output: 0

# 6. Check build output for secrets
cd new_website/build
grep -rE "(sk-|AIza|api_key)" . || echo "✅ No secrets in build"
# Should output: ✅ No secrets in build

# 7. Check for console.log in production build
grep -r "console\." new_website/build/static/js/*.js | head -5
# Should show minimal or no results (only error handlers if any)

# 8. Secret pattern scan
grep -rE "(sk-[a-zA-Z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35})" --exclude-dir=node_modules --exclude="*.pyc" --exclude=".env" buildfund_webapp/src new_website/src || echo "✅ No secrets in source"
```

---

## Files Changed Summary

### Modified Files:
1. `.gitignore` - Enhanced env file patterns
2. `buildfund_webapp/production_checklist.sh` - Removed hardcoded API keys from grep
3. `new_website/package.json` - Added GENERATE_SOURCEMAP=false to build script

### New Files:
1. `buildfund_webapp/.env.example` - Updated with all required variables
2. `new_website/.env.example` - Frontend environment template
3. `new_website/src/utils/tokenStorage.js` - Stage 1 token storage migration
4. `.github/workflows/secret-scanning.yml` - CI secret scanning (to be created)
5. `scripts/check-secrets.sh` - Local secret checking script (to be created)

### Files Removed from Git Index:
1. `buildfund_webapp/.env` - Removed (local file preserved)
2. `new_website/.env` - Removed (local file preserved)

---

## Next Steps

1. ✅ Complete A.1-A.4 (Repository hygiene)
2. ⏳ Execute B (History rewrite) - **Coordinate with team first**
3. ⏳ Set up C (Guardrails) - CI scanning and pre-commit hooks
4. ⏳ Implement D.1 (Source maps) - Update package.json
5. ⏳ Implement D.2 (Console logs) - Install babel plugin
6. ⏳ Implement D.3 (Token storage) - Create tokenStorage utility and update files

---

**Status:** Ready for implementation. Follow steps in order, verify after each change.
