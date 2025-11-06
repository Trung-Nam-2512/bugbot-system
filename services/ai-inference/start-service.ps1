# Start AI Inference Service
# Run this script in a separate terminal window

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "AI Inference Service Starter" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to service directory
Set-Location $PSScriptRoot

# Activate virtual environment
Write-Host "[1/3] Activating virtual environment..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"

# Check environment
Write-Host "[2/3] Checking configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "  ✓ Configuration file found" -ForegroundColor Green
} else {
    Write-Host "  ✗ Configuration file not found!" -ForegroundColor Red
    exit 1
}

# Start service
Write-Host "[3/3] Starting AI Inference Service..." -ForegroundColor Yellow
Write-Host ""
Write-Host "🚀 Service will start on http://localhost:8000" -ForegroundColor Green
Write-Host "📊 Health check: http://localhost:8000/health/liveness" -ForegroundColor Green
Write-Host "⏹  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Start Python service
python main.py


