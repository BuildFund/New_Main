# BuildFund Server Startup Commands

## Project Location
```
C:\dev\BuildFund\1.0 Website Dev\GitHub
```

## Quick Start (Recommended)

### Option 1: Use the PowerShell Script
Run the provided script to start the frontend server:
```powershell
cd "C:\dev\BuildFund\1.0 Website Dev\GitHub"
.\START_SERVERS.ps1
```

### Option 2: Manual Start Commands

#### Start Frontend Server (React)
Open PowerShell and run:
```powershell
# Navigate to the project root
cd "C:\dev\BuildFund\1.0 Website Dev\GitHub\new_website"

# Install dependencies (first time only, or after npm install)
npm install

# Start the React development server
npm start
```

The frontend will be available at: **http://localhost:3000**

#### Start Backend Server (Django - if needed)
If you have a Django backend, open a **new** PowerShell window and run:
```powershell
# Navigate to the backend directory
cd "C:\dev\BuildFund\1.0 Website Dev\GitHub\buildfund_webapp"

# Activate virtual environment (if using one)
# venv\Scripts\Activate.ps1

# Start Django development server
python manage.py runserver
```

The backend will typically be available at: **http://localhost:8000**

## Important Notes

1. **Two Terminal Windows**: You'll need separate PowerShell windows for frontend and backend (if running both)

2. **First Time Setup**: 
   - Make sure Node.js and npm are installed
   - Run `npm install` in the `new_website` directory before starting

3. **Dependencies**: 
   - Frontend uses React (React Scripts)
   - Backend uses Django (if applicable)

4. **Ports**:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8000 (if Django backend exists)

## Troubleshooting

- If `npm start` fails, make sure you're in the `new_website` directory
- If port 3000 is already in use, React will prompt you to use a different port
- Make sure all dependencies are installed: `npm install`
