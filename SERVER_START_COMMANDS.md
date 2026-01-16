# BuildFund Server Start Commands

## Project Location
```
C:\dev\BuildFund\1.0 Website Dev\GitHub
```

---

## Frontend Server (React)

### Commands:
```powershell
cd "C:\dev\BuildFund\1.0 Website Dev\GitHub\new_website"
npm start
```

**URL:** http://localhost:3000

---

## Backend Server (Django - if applicable)

**⚠️ Note:** `manage.py` is currently missing from the backend directory. It may need to be restored from the backup location.

### If manage.py exists:
```powershell
cd "C:\dev\BuildFund\1.0 Website Dev\GitHub\buildfund_webapp"
python manage.py runserver
```

**URL:** http://localhost:8000

**If manage.py is missing:** The file may need to be copied from the backup location: `C:\Users\paul-\OneDrive - BARE Capital Ltd\BARE Drive\10.0 BUILDFUND\1.0 Website Dev\GitHub\buildfund_webapp\manage.py`

---

## Quick Reference

**Frontend:**
- Folder: `new_website`
- Command: `npm start`
- Port: 3000

**Backend:**
- Folder: `buildfund_webapp`
- Command: `python manage.py runserver`
- Port: 8000
