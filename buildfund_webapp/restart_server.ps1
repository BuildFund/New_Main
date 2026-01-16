# PowerShell script to restart the Django development server
# This script stops any existing server and starts a fresh one

Write-Host "=== Restarting Django Server ===" -ForegroundColor Cyan
Write-Host ""

# Change to the buildfund_webapp directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Check if port 8000 is in use
Write-Host "Checking if server is running on port 8000..." -ForegroundColor Yellow
$portInUse = Test-NetConnection -ComputerName localhost -Port 8000 -InformationLevel Quiet -WarningAction SilentlyContinue

if ($portInUse) {
    Write-Host "⚠️  Port 8000 is in use. Attempting to stop existing server..." -ForegroundColor Yellow
    
    # Try to find and kill the process using port 8000
    try {
        $process = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            $processId = $process | Select-Object -First 1
            Write-Host "   Found process ID: $processId" -ForegroundColor Gray
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            Write-Host "   ✅ Stopped existing server process" -ForegroundColor Green
            Start-Sleep -Seconds 2
        } else {
            Write-Host "   ⚠️  Could not find process. You may need to stop it manually (Ctrl+C in the server window)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ⚠️  Could not automatically stop server. Please stop it manually (Ctrl+C)" -ForegroundColor Yellow
        Write-Host "   Press any key to continue anyway, or Ctrl+C to cancel..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
} else {
    Write-Host "✅ Port 8000 is free" -ForegroundColor Green
}

Write-Host ""

# Check if .env file exists
if (Test-Path ".env") {
    Write-Host "✅ .env file found" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env file not found - server may not start correctly" -ForegroundColor Yellow
    Write-Host "   Expected location: $scriptPath\.env" -ForegroundColor Yellow
}

# Load environment variables from .env file
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env file..." -ForegroundColor Cyan
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "✅ Environment variables loaded" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting Django development server..." -ForegroundColor Green
Write-Host "Server will be available at: http://localhost:8000" -ForegroundColor White
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the Django server
python manage.py runserver
