# Script to sync project to Label Studio
# Project ID: 690b312bb853bd59591d5bb2

$projectId = "690b312bb853bd59591d5bb2"

Write-Host "=== BƯỚC 2: SYNC PROJECT LÊN LABEL STUDIO ===" -ForegroundColor Green
Write-Host ""

# Check if Label Studio is configured
Write-Host "Kiểm tra Label Studio connection..." -ForegroundColor Yellow

$env:LABELSTUDIO_URL = "http://localhost:8082"
$env:LABELSTUDIO_API_TOKEN = ""

# Check if .env file exists
if (Test-Path ".\env") {
    $envContent = Get-Content ".\env" -Raw
    if ($envContent -match "LABELSTUDIO_URL=(.+)") {
        $env:LABELSTUDIO_URL = $matches[1].Trim()
    }
    if ($envContent -match "LABELSTUDIO_API_TOKEN=(.+)") {
        $env:LABELSTUDIO_API_TOKEN = $matches[1].Trim()
    }
}

if (-not $env:LABELSTUDIO_API_TOKEN -or $env:LABELSTUDIO_API_TOKEN -eq "") {
    Write-Host "⚠️  Label Studio chưa được cấu hình!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Để sync project lên Label Studio:" -ForegroundColor Yellow
    Write-Host "  1. Chạy Label Studio: docker run -it -p 8082:8080 heartexlabs/label-studio:latest" -ForegroundColor Cyan
    Write-Host "  2. Mở http://localhost:8082 và login" -ForegroundColor Cyan
    Write-Host "  3. Click Avatar → Account & Settings → Access Token" -ForegroundColor Cyan
    Write-Host "  4. Copy token và tạo file .env với nội dung:" -ForegroundColor Cyan
    Write-Host "     LABELSTUDIO_URL=http://localhost:8082" -ForegroundColor White
    Write-Host "     LABELSTUDIO_API_TOKEN=<paste_token_here>" -ForegroundColor White
    Write-Host ""
    Write-Host "Sau đó chạy lại script này." -ForegroundColor Yellow
    exit 0
}

Write-Host "Label Studio URL: $env:LABELSTUDIO_URL" -ForegroundColor Cyan
Write-Host ""

# Sync project to Label Studio
Write-Host "Đang sync project lên Label Studio..." -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod -Uri "http://localhost:8001/api/labelstudio/projects/$projectId/sync?sync_images=true" `
        -Method POST
    
    if ($result.ok) {
        Write-Host "✅ Sync thành công!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Kết quả:" -ForegroundColor Yellow
        Write-Host "  - Label Studio Project ID: $($result.result.labelStudioProjectId)" -ForegroundColor Cyan
        Write-Host "  - Internal Project ID: $($result.result.internalProjectId)" -ForegroundColor Cyan
        Write-Host "  - Message: $($result.result.message)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "=== BƯỚC TIẾP THEO ===" -ForegroundColor Green
        Write-Host "1. Mở Label Studio: $env:LABELSTUDIO_URL" -ForegroundColor Cyan
        Write-Host "2. Tìm project 'Insect Dataset'" -ForegroundColor Cyan
        Write-Host "3. Label images với bounding boxes" -ForegroundColor Cyan
        Write-Host "4. Sau khi label xong, chạy sync-annotations script" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Sync thất bại: $($result.detail)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Lỗi: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        $errorObj = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Chi tiết: $($errorObj.detail)" -ForegroundColor Red
    }
}

