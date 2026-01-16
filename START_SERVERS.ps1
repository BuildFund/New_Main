# PowerShell script to start BuildFund servers
# Location: C:\dev\BuildFund\1.0 Website Dev\GitHub

Write-Host "BuildFund Server Startup Script" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

$projectRoot = "C:\dev\BuildFund\1.0 Website Dev\GitHub"
Set-Location $projectRoot

Write-Host "Starting Frontend Server (React)..." -ForegroundColor Yellow
Set-Location "$projectRoot\new_website"

# Check if node_modules exist, if not install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Cyan
    npm install
}

# Start the React development server in a new window
Write-Host "Starting React development server on http://localhost:3000" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\new_website'; npm start"

Write-Host ""
Write-Host "Frontend server starting in new PowerShell window..." -ForegroundColor Green
Write-Host "Frontend URL: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: If you need to start the backend server separately, use:" -ForegroundColor Yellow
Write-Host "  cd '$projectRoot\buildfund_webapp'" -ForegroundColor White
Write-Host "  python manage.py runserver" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit this script (servers will continue running)..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
