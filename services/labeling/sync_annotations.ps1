# Script to sync annotations from Label Studio
# Project ID: 690b312bb853bd59591d5bb2

$projectId = "690b312bb853bd59591d5bb2"

Write-Host "=== STEP 4: SYNC ANNOTATIONS FROM LABEL STUDIO ===" -ForegroundColor Green
Write-Host ""

Write-Host "Syncing annotations from Label Studio..." -ForegroundColor Yellow

try {
    $result = Invoke-RestMethod -Uri "http://localhost:8001/api/labelstudio/projects/$projectId/sync-annotations" `
        -Method POST
    
    if ($result.ok) {
        Write-Host "[OK] Sync successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Results:" -ForegroundColor Yellow
        Write-Host "  - Synced: $($result.syncedCount) annotations" -ForegroundColor Cyan
        Write-Host "  - Total: $($result.totalAnnotations) annotations" -ForegroundColor Cyan
        Write-Host "  - Message: $($result.message)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "=== STEP 5: EXPORT ANNOTATIONS ===" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "You can export annotations:" -ForegroundColor Cyan
        Write-Host "  - COCO format: GET /api/projects/$projectId/export?format=coco" -ForegroundColor Gray
        Write-Host "  - YOLO format: GET /api/projects/$projectId/export?format=yolo" -ForegroundColor Gray
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

