# Complete Label Studio Workflow Script
# Project ID: 690b312bb853bd59591d5bb2

$projectId = "690b312bb853bd59591d5bb2"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "LABEL STUDIO WORKFLOW - STEP BY STEP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: Insect Dataset" -ForegroundColor Green
Write-Host "Project ID: $projectId" -ForegroundColor Green
Write-Host ""

# ==========================================
# STEP 1: Add Images (Completed)
# ==========================================
Write-Host "[OK] STEP 1: Add Images - COMPLETED" -ForegroundColor Green
Write-Host "  - Added 3 images to project" -ForegroundColor Gray
Write-Host ""

# ==========================================
# STEP 2: Sync to Label Studio
# ==========================================
Write-Host "=== STEP 2: SYNC TO LABEL STUDIO ===" -ForegroundColor Yellow
Write-Host ""

# Check Label Studio config
$labelStudioUrl = $null
$labelStudioToken = $null

if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "LABELSTUDIO_URL=(.+)") {
        $labelStudioUrl = $matches[1].Trim()
    }
    if ($envContent -match "LABELSTUDIO_API_TOKEN=(.+)") {
        $labelStudioToken = $matches[1].Trim()
    }
}

if (-not $labelStudioToken -or $labelStudioToken -eq "" -or $labelStudioToken -eq "paste_your_token_here") {
    Write-Host "[WARN] Label Studio not configured!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You need to:" -ForegroundColor Cyan
    Write-Host "  1. Run Label Studio:" -ForegroundColor White
    Write-Host "     docker run -it -p 8082:8080 heartexlabs/label-studio:latest" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Open http://localhost:8082 and login" -ForegroundColor White
    Write-Host ""
    Write-Host "  3. Get API Token:" -ForegroundColor White
    Write-Host "     - Click Avatar (top right)" -ForegroundColor Gray
    Write-Host "     - Account & Settings -> Access Token" -ForegroundColor Gray
    Write-Host "     - Copy token" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  4. Create .env file in services/labeling/ with:" -ForegroundColor White
    Write-Host "     LABELSTUDIO_URL=http://localhost:8082" -ForegroundColor Gray
    Write-Host "     LABELSTUDIO_API_TOKEN=<paste_token_here>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Then run this script again." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

Write-Host "[OK] Label Studio configured" -ForegroundColor Green
Write-Host "  URL: $labelStudioUrl" -ForegroundColor Gray
Write-Host ""

# Check if Label Studio is running
Write-Host "Checking Label Studio connection..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-WebRequest -Uri "$labelStudioUrl/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "[OK] Label Studio is running" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Label Studio is not running at $labelStudioUrl" -ForegroundColor Red
    Write-Host "Please start Label Studio first:" -ForegroundColor Yellow
    Write-Host "  docker run -it -p 8082:8080 heartexlabs/label-studio:latest" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host ""

# Sync project
Write-Host "Syncing project to Label Studio..." -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod -Uri "http://localhost:8001/api/labelstudio/projects/$projectId/sync?sync_images=true" `
        -Method POST
    
    if ($result.ok) {
        Write-Host "[OK] Sync successful!" -ForegroundColor Green
        Write-Host "  Label Studio Project ID: $($result.result.labelStudioProjectId)" -ForegroundColor Cyan
        Write-Host ""
        
        Write-Host "=== STEP 3: LABEL IN LABEL STUDIO UI ===" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "1. Open Label Studio: $labelStudioUrl" -ForegroundColor Cyan
        Write-Host "2. Find project 'Insect Dataset'" -ForegroundColor Cyan
        Write-Host "3. Click on project" -ForegroundColor Cyan
        Write-Host "4. Label images:" -ForegroundColor Cyan
        Write-Host "   - Click and drag to draw bounding box" -ForegroundColor Gray
        Write-Host "   - Select class: insect, fly, or bee" -ForegroundColor Gray
        Write-Host "   - Submit annotation" -ForegroundColor Gray
        Write-Host "   - Repeat for all images" -ForegroundColor Gray
        Write-Host ""
        Write-Host "After labeling, run sync-annotations.ps1" -ForegroundColor Yellow
    } else {
        Write-Host "[ERROR] Sync failed: $($result.detail)" -ForegroundColor Red
    }
} catch {
    Write-Host "[ERROR] Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        try {
            $errorObj = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "Details: $($errorObj.detail)" -ForegroundColor Red
        } catch {
            Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
}

Write-Host ""

