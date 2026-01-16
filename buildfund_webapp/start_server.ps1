# PowerShell script to start Django development server
# This script loads environment variables and starts the server

Write-Host "Starting Django Development Server..." -ForegroundColor Green
Write-Host ""

# Change to the buildfund_webapp directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Load environment variables from .env file if it exists
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env file..." -ForegroundColor Cyan
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
} else {
    Write-Host "Warning: .env file not found. Using default environment variables." -ForegroundColor Yellow
}

# Check if port 8000 is already in use
$portInUse = Test-NetConnection -ComputerName localhost -Port 8000 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($portInUse) {
    Write-Host "Warning: Port 8000 is already in use. The server may already be running." -ForegroundColor Yellow
    Write-Host "If you need to restart, stop the existing server first (Ctrl+C)." -ForegroundColor Yellow
    Write-Host ""
}

# Start the Django server
Write-Host "Starting server on http://localhost:8000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

python manage.py runserver
