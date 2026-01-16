# Debug script to start Django server and show all output
# API keys are loaded from .env file (gitignored, never committed)

Write-Host "========================================"
Write-Host "Starting Django Development Server"
Write-Host "========================================"
Write-Host "API Keys will be loaded from .env file"
Write-Host ""

cd "C:\Users\paul-\OneDrive - BARE Capital Ltd\BARE Drive\10.0 BUILDFUND\1.0 Website Dev\GitHub\buildfund_webapp"

# Check if .env file exists
if (Test-Path .env) {
    Write-Host "✅ .env file found" -ForegroundColor Green
    # Load and check keys (without exposing them)
    $envContent = Get-Content .env -Raw
    $hasGoogle = $envContent -match "GOOGLE_API_KEY=" -and $envContent -notmatch "GOOGLE_API_KEY=\[YOUR"
    $hasOpenAI = $envContent -match "OPENAI_API_KEY=" -and $envContent -notmatch "OPENAI_API_KEY=\[YOUR"
    Write-Host "  - Google Maps: $(if ($hasGoogle) { '✅ Configured' } else { '❌ Missing' })" -ForegroundColor $(if ($hasGoogle) { 'Green' } else { 'Red' })
    Write-Host "  - OpenAI: $(if ($hasOpenAI) { '✅ Configured' } else { '❌ Missing' })" -ForegroundColor $(if ($hasOpenAI) { 'Green' } else { 'Red' })
} else {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "Please create .env file with your API keys (see .env.example)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Current directory: $(Get-Location)"
Write-Host ""
Write-Host "Running: python manage.py runserver"
Write-Host "========================================"
Write-Host ""

python manage.py runserver
