# Script to add images to Insect Dataset project
# Project ID: 690b312bb853bd59591d5bb2

$projectId = "690b312bb853bd59591d5bb2"

Write-Host "=== STEP 1: GET IMAGES FROM SYSTEM ===" -ForegroundColor Green
Write-Host ""

# Get images from backend API
Write-Host "Getting images from backend API..." -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "http://localhost:1435/api/cam/images?limit=5"

if (-not $response.images -or $response.images.Count -eq 0) {
    Write-Host "[ERROR] No images found in system!" -ForegroundColor Red
    Write-Host "You can:" -ForegroundColor Yellow
    Write-Host "  1. Upload images via backend API" -ForegroundColor White
    Write-Host "  2. Or use test images with fake URLs" -ForegroundColor White
    exit 1
}

Write-Host "Found $($response.images.Count) images" -ForegroundColor Green
Write-Host ""

# Prepare images for labeling project
$imagesToAdd = @()
foreach ($img in $response.images | Select-Object -First 3) {
    $imagesToAdd += @{
        imageId = $img.id
        imageUrl = $img.url
        deviceId = $img.deviceId
        width = 640  # Default, can parse from actual image
        height = 480
    }
    Write-Host "  - $($img.filename) ($($img.id))" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=== STEP 2: ADD IMAGES TO PROJECT ===" -ForegroundColor Green
Write-Host ""

# Prepare request body
$requestBody = @{
    imageIds = $imagesToAdd | ForEach-Object { $_.imageId }
    imageUrls = $imagesToAdd | ForEach-Object { $_.imageUrl }
    deviceIds = $imagesToAdd | ForEach-Object { $_.deviceId }
} | ConvertTo-Json -Depth 10

Write-Host "Adding images to project..." -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod -Uri "http://localhost:8001/api/projects/$projectId/images" `
        -Method POST `
        -Body $requestBody `
        -ContentType "application/json"
    
    Write-Host "[OK] Success!" -ForegroundColor Green
    Write-Host "  - Added: $($result.added) images" -ForegroundColor Cyan
    Write-Host "  - Total: $($result.total) images" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Project ID: $projectId" -ForegroundColor Yellow
    Write-Host "Next step: Sync project to Label Studio" -ForegroundColor Yellow
} catch {
    Write-Host "[ERROR] Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
}

