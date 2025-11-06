# Script to upload ESP32-CAM images to MinIO and add to Labeling Project
# Usage: .\add_esp32_images.ps1 [upload_dir] [project_id]

param(
    [string]$UploadDir = "uploads\cam-03\2025\10\17",
    [string]$ProjectId = "690b312bb853bd59591d5bb2"
)

Write-Host "=== UPLOAD ESP32-CAM IMAGES ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Upload directory: $UploadDir" -ForegroundColor Yellow
Write-Host "Project ID: $ProjectId" -ForegroundColor Yellow
Write-Host ""

# Convert to absolute path
if (-not [System.IO.Path]::IsPathRooted($UploadDir)) {
    $UploadDir = Join-Path $PSScriptRoot "..\..\$UploadDir"
}

if (-not (Test-Path $UploadDir)) {
    Write-Host "[ERROR] Directory not found: $UploadDir" -ForegroundColor Red
    exit 1
}

# Get all JPG files
$jpgFiles = Get-ChildItem -Path $UploadDir -Filter "*.jpg"

if ($jpgFiles.Count -eq 0) {
    Write-Host "[WARN] No JPG files found in $UploadDir" -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($jpgFiles.Count) images to process" -ForegroundColor Green
Write-Host ""

$uploadedCount = 0
$addedCount = 0

foreach ($jpgFile in $jpgFiles) {
    $jsonFile = $jpgFile.FullName -replace "\.jpg$", ".json"
    
    if (-not (Test-Path $jsonFile)) {
        Write-Host "[SKIP] No JSON metadata for $($jpgFile.Name)" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "Processing: $($jpgFile.Name)" -ForegroundColor Cyan
    
    # Load metadata
    $metadata = Get-Content $jsonFile | ConvertFrom-Json
    $deviceId = $metadata.deviceId
    
    # Extract date from path
    $pathParts = $jpgFile.FullName -split [regex]::Escape([IO.Path]::DirectorySeparatorChar)
    $year = $null
    $month = $null
    $day = $null
    
    for ($i = 0; $i -lt $pathParts.Length; $i++) {
        if ($pathParts[$i] -match '^\d{4}$') {
            $year = $pathParts[$i]
            if ($i + 1 -lt $pathParts.Length -and $pathParts[$i + 1] -match '^\d{1,2}$') {
                $month = $pathParts[$i + 1].PadLeft(2, '0')
            }
            if ($i + 2 -lt $pathParts.Length -and $pathParts[$i + 2] -match '^\d{1,2}$') {
                $day = $pathParts[$i + 2].PadLeft(2, '0')
            }
            break
        }
    }
    
    if (-not $year) {
        $now = Get-Date
        $year = $now.Year.ToString()
        $month = $now.Month.ToString().PadLeft(2, '0')
        $day = $now.Day.ToString().PadLeft(2, '0')
    }
    
    # Construct MinIO object key
    $filename = $jpgFile.Name
    $objectKey = "raw/$year/$month/$day/$deviceId/$filename"
    
    # Use Python script to upload (more reliable)
    Write-Host "  Uploading to MinIO..." -ForegroundColor Gray
    $pythonScript = Join-Path $PSScriptRoot "upload_esp32_images.py"
    $result = python $pythonScript $jpgFile.DirectoryName $ProjectId 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $uploadedCount++
        
        # Construct image URL
        $bucket = if ($env:MINIO_BUCKET) { $env:MINIO_BUCKET } else { "iot-raw" }
        $imageUrl = "http://localhost:9002/$bucket/$objectKey"
        
        # Add to project
        Write-Host "  Adding to project..." -ForegroundColor Gray
        $body = @{
            images = @(
                @{
                    imageUrl = $imageUrl
                    width = 640
                    height = 480
                }
            )
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:8001/api/projects/$ProjectId/images" `
                -Method POST `
                -ContentType "application/json" `
                -Body $body `
                -ErrorAction Stop
            
            if ($response.ok) {
                Write-Host "  [OK] Added to project" -ForegroundColor Green
                $addedCount++
            } else {
                Write-Host "  [ERROR] Failed to add: $($response.detail)" -ForegroundColor Red
            }
        } catch {
            Write-Host "  [ERROR] API call failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "  [ERROR] Upload failed" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "=== SUMMARY ===" -ForegroundColor Green
Write-Host "Uploaded to MinIO: $uploadedCount/$($jpgFiles.Count)" -ForegroundColor Cyan
Write-Host "Added to project: $addedCount/$($jpgFiles.Count)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next step: Sync project to Label Studio" -ForegroundColor Yellow
Write-Host "  POST http://localhost:8001/api/labelstudio/projects/$ProjectId/sync?sync_images=true" -ForegroundColor Gray
Write-Host ""

