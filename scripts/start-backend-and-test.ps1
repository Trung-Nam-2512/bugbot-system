# PowerShell script to start backend and run tests
# Phase 3 Week 5 Day 1-2: Enhanced Statistics Testing

Write-Host "Phase 3 Week 5 Day 1-2: Starting Backend and Running Tests" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Check if backend is already running
$backendProcess = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*backend*" -or $_.CommandLine -like "*index.js*" }
if ($backendProcess) {
    Write-Host "Backend is already running (PID: $($backendProcess.Id))" -ForegroundColor Yellow
    Write-Host "Skipping backend start..." -ForegroundColor Yellow
} else {
    Write-Host "Starting backend service..." -ForegroundColor Green
    Start-Process -FilePath "node" -ArgumentList "src/index.js" -WorkingDirectory (Get-Location) -WindowStyle Hidden
    Write-Host "Waiting for backend to start (10 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# Check backend health
Write-Host "`nChecking backend health..." -ForegroundColor Cyan
try {
    $healthResponse = Invoke-WebRequest -Uri "http://localhost:1435/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($healthResponse.StatusCode -eq 200) {
        Write-Host "✅ Backend is healthy" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Backend returned status: $($healthResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Backend not responding: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please start backend manually and try again" -ForegroundColor Yellow
    exit 1
}

# Run detection stats test
Write-Host "`nRunning detection statistics tests..." -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

node scripts/test-detection-stats.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ All tests passed!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Some tests failed" -ForegroundColor Red
    exit 1
}


