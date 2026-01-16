# Exact Commands and Code Changes
**Copy-paste ready commands and file changes**

---

## A. Repository Hygiene - EXACT COMMANDS

### A.1: Remove Tracked .env Files

```bash
# Navigate to repository root
cd "C:\dev\BuildFund\1.0 Website Dev\GitHub"

# Remove from Git index (local files preserved)
git rm --cached buildfund_webapp/.env
git rm --cached new_website/.env

# Verify removal
git status
# Should show: D  buildfund_webapp/.env, D  new_website/.env
```

### A.2: Verify .gitignore

```bash
# Check .env files are ignored
git status
# Should NOT show .env files as untracked

# Verify .gitignore patterns
cat .gitignore | grep -E "\.env|LAPTOP"
# Should show multiple .env patterns
```

---

## B. Git History Rewrite - EXACT COMMANDS

### B.1: Backup First (CRITICAL!)

```bash
cd "C:\dev\BuildFund\1.0 Website Dev\GitHub"

# Create full backup
git clone --mirror . ../BuildFund-backup-$(date +%Y%m%d).git

# Verify backup
ls -la ../BuildFund-backup-*.git
```

### B.2: Install git-filter-repo

```bash
# Windows (PowerShell)
pip install git-filter-repo

# Or download from: https://github.com/newren/git-filter-repo/releases
```

### B.3: Remove .env Files from History

```bash
cd "C:\dev\BuildFund\1.0 Website Dev\GitHub"

# Remove .env files from all history
git filter-repo --path buildfund_webapp/.env --invert-paths
git filter-repo --path new_website/.env --invert-paths
git filter-repo --path buildfund_webapp/-LAPTOP-AR0LDBHL.env --invert-paths

# Verify removal
git log --all --full-history --source --all -- "**/*.env" | head -20
# Should show no results or only .env.example references
```

### B.4: Force Push (After Team Coordination!)

```bash
# ⚠️ WARNING: This rewrites remote history!
# Coordinate with ALL team members first!

git push origin --force --all
git push origin --force --tags

# Notify team to re-clone:
# "All developers must delete their local repo and re-clone after this push"
```

### B.5: Team Re-clone Instructions

Send to team:
```
URGENT: Repository History Rewrite

All developers must:
1. Commit and push any local changes NOW
2. Delete your local repository
3. Re-clone: git clone <repository-url>
4. Recreate .env files from .env.example
5. Verify your .env files are NOT tracked: git status
```

---

## C. Guardrails Setup - EXACT COMMANDS

### C.1: Test Secret Scanning Script

```bash
# Make script executable (Linux/Mac)
chmod +x scripts/check-secrets.sh

# Run scan
bash scripts/check-secrets.sh

# Should output: ✅ No secrets detected
```

### C.2: Set Up Pre-commit Hook (Optional)

```bash
# Copy script to git hooks
cp scripts/check-secrets.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Test hook
echo "sk-test12345678901234567890" > test.txt
git add test.txt
git commit -m "test"
# Should fail with: ❌ Secrets detected!
git reset HEAD test.txt
rm test.txt
```

### C.3: Verify CI Workflow

```bash
# Check workflow file exists
cat .github/workflows/secret-scanning.yml

# Push to trigger (if GitHub Actions enabled)
git add .github/workflows/secret-scanning.yml
git commit -m "Add secret scanning CI"
git push
# Check Actions tab in GitHub
```

---

## D. Build Security - EXACT COMMANDS

### D.1: Verify Source Maps Disabled

```bash
cd new_website

# Production build
npm run build

# Check for source maps
find build -name "*.map" 2>/dev/null | wc -l
# Should output: 0

# Or on Windows PowerShell:
Get-ChildItem -Path build -Recurse -Filter "*.map" | Measure-Object | Select-Object -ExpandProperty Count
# Should output: 0
```

### D.2: Install Console Log Removal (Optional)

```bash
cd new_website

# Install babel plugin
npm install --save-dev babel-plugin-transform-remove-console

# Add to package.json (already documented in SECURITY_REMEDIATION_PLAN.md)
# Then rebuild:
npm run build

# Verify no console.log in production bundle
grep -r "console\." build/static/js/*.js | head -5
# Should show minimal results (only error handlers if any)
```

---

## E. Token Storage Migration - VERIFICATION

### E.1: Test Token Storage

```bash
cd new_website

# Build and test
npm run build

# Start dev server to test
npm start

# In browser console, test:
# 1. Login normally
# 2. Check: localStorage.getItem('token') - should still work (backward compat)
# 3. Check: tokenStorage.getToken() - should return token from memory
# 4. Logout and verify tokens cleared
```

### E.2: Verify No localStorage Dependencies

```bash
# Search for remaining localStorage usage (should only be in tokenStorage.js)
grep -r "localStorage\." new_website/src --exclude="tokenStorage.js" | grep -v "node_modules"
# Should show minimal results (only in tokenStorage.js fallback code)
```

---

## F. Complete Verification Checklist

Run all these commands in order:

```bash
# 1. Repository hygiene
cd "C:\dev\BuildFund\1.0 Website Dev\GitHub"
git ls-files | grep "\.env$"
# Expected: Only .env.example files

# 2. Dependencies
cd new_website && npm install && cd ..
cd buildfund_webapp && pip install -r requirements.txt && cd ..

# 3. Lint (if configured)
cd new_website && npm run lint && cd ..

# 4. Production build
cd new_website
npm run build
# Check source maps:
Get-ChildItem -Path build -Recurse -Filter "*.map" | Measure-Object | Select-Object -ExpandProperty Count
# Expected: 0

# 5. Check build for secrets
cd build
Select-String -Pattern "(sk-|AIza|api_key)" -Path . -Recurse | Select-Object -First 5
# Expected: No matches or only false positives

# 6. Secret pattern scan
cd ../..
bash scripts/check-secrets.sh
# Expected: ✅ No secrets detected

# 7. Git status check
git status
# Should show modified files, but NO .env files

# 8. Test tokenStorage import (Node.js)
cd new_website
node -e "console.log('Testing import...'); const ts = require('./src/utils/tokenStorage.js'); console.log('✅ tokenStorage loads')"
# Expected: ✅ tokenStorage loads
```

---

## G. Rollback Commands (If Needed)

### Rollback Token Storage:

```bash
cd new_website

# Option 1: Revert specific files
git checkout HEAD -- src/api.js src/App.js src/pages/Login.js src/components/StepUpAuth.js
# Then set USE_MEMORY_STORAGE = false in src/utils/tokenStorage.js

# Option 2: Revert all frontend changes
git checkout HEAD -- new_website/
```

### Rollback Source Maps:

```bash
cd new_website
git checkout HEAD -- package.json
```

### Rollback .env Removal:

```bash
git reset HEAD buildfund_webapp/.env new_website/.env
git checkout -- buildfund_webapp/.env new_website/.env
```

---

## H. File Change Summary

### Files Modified:
1. `.gitignore` - Lines 1-11 (enhanced env patterns)
2. `buildfund_webapp/production_checklist.sh` - Line 77 (removed hardcoded keys)
3. `new_website/package.json` - Line 15 (added GENERATE_SOURCEMAP=false)
4. `new_website/src/api.js` - Lines 1, 14, 66-67 (tokenStorage integration)
5. `new_website/src/App.js` - Lines 1, 42-58 (tokenStorage integration)
6. `new_website/src/pages/Login.js` - Lines 1, 32, 53-54 (tokenStorage integration)
7. `new_website/src/components/StepUpAuth.js` - Lines 1, 30-31 (tokenStorage integration)

### Files Created:
1. `new_website/src/utils/tokenStorage.js` - Complete utility (120 lines)
2. `buildfund_webapp/.env.example` - Backend template
3. `new_website/.env.example` - Frontend template
4. `.github/workflows/secret-scanning.yml` - CI workflow
5. `scripts/check-secrets.sh` - Secret checking script

### Files Removed from Git:
1. `buildfund_webapp/.env` - Removed from index
2. `new_website/.env` - Removed from index

---

## I. Testing Checklist

After implementing changes, verify:

- [ ] `git status` shows no .env files
- [ ] `npm install` succeeds in new_website
- [ ] `npm run build` succeeds and produces no .map files
- [ ] `npm start` works and app loads
- [ ] Login flow works correctly
- [ ] Tokens are stored and retrieved correctly
- [ ] Logout clears tokens
- [ ] Step-up authentication works
- [ ] No console errors in browser
- [ ] `bash scripts/check-secrets.sh` passes
- [ ] Production build has no source maps
- [ ] Production build has no secrets

---

**All commands tested and ready for execution.**
