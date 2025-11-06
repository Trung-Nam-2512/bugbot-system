# Script to export annotations
# Project ID: 690b312bb853bd59591d5bb2

$projectId = "690b312bb853bd59591d5bb2"

Write-Host "=== STEP 5: EXPORT ANNOTATIONS ===" -ForegroundColor Green
Write-Host ""

# Export COCO format
Write-Host "Exporting COCO format..." -ForegroundColor Yellow
try {
    $cocoResult = Invoke-RestMethod -Uri "http://localhost:8001/api/projects/$projectId/export?format=coco"
    
    if ($cocoResult.ok) {
        Write-Host "[OK] COCO export successful!" -ForegroundColor Green
        Write-Host "  Format: $($cocoResult.format)" -ForegroundColor Cyan
        Write-Host "  Categories: $($cocoResult.data.categories.Count)" -ForegroundColor Cyan
        Write-Host "  Images: $($cocoResult.data.images.Count)" -ForegroundColor Cyan
        Write-Host "  Annotations: $($cocoResult.data.annotations.Count)" -ForegroundColor Cyan
        
        # Save to file
        $cocoResult.data | ConvertTo-Json -Depth 10 | Out-File -FilePath "export_coco_$(Get-Date -Format 'yyyyMMdd_HHmmss').json" -Encoding UTF8
        Write-Host "  Saved to: export_coco_*.json" -ForegroundColor Gray
    }
} catch {
    Write-Host "[ERROR] COCO export error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Export YOLO format
Write-Host "Exporting YOLO format..." -ForegroundColor Yellow
try {
    $yoloResult = Invoke-RestMethod -Uri "http://localhost:8001/api/projects/$projectId/export?format=yolo"
    
    if ($yoloResult.ok) {
        Write-Host "[OK] YOLO export successful!" -ForegroundColor Green
        Write-Host "  Format: $($yoloResult.format)" -ForegroundColor Cyan
        Write-Host "  Images: $($yoloResult.data.images.Count)" -ForegroundColor Cyan
        
        # Save to file
        $yoloResult.data | ConvertTo-Json -Depth 10 | Out-File -FilePath "export_yolo_$(Get-Date -Format 'yyyyMMdd_HHmmss').json" -Encoding UTF8
        Write-Host "  Saved to: export_yolo_*.json" -ForegroundColor Gray
    }
} catch {
    Write-Host "[ERROR] YOLO export error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "[OK] Workflow completed!" -ForegroundColor Green
Write-Host ""

