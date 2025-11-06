# ESP32-CAM Workflow - Đồng Bộ Ảnh Lên Label Studio

## 📋 Tổng Quan Workflow

```
ESP32-CAM chụp ảnh
    ↓
Upload lên MinIO (backend API)
    ↓
Lưu metadata vào MongoDB (backend API)
    ↓
Thêm ảnh vào Labeling Project (Labeling Service)
    ↓
Sync Project lên Label Studio
    ↓
Label images trong Label Studio UI
    ↓
Sync annotations về MongoDB
    ↓
Export annotations (COCO/YOLO)
```

---

## 🔍 Bước 1: Kiểm Tra Ảnh Đã Có Trong MinIO Chưa?

### Vị trí ảnh ESP32-CAM:
- **Local path**: `uploads/cam-03/2025/10/17/1760696929_-41321.jpg`
- **Metadata**: `uploads/cam-03/2025/10/17/1760696929_-41321.json`

### Thông tin từ JSON:
```json
{
  "deviceId": "cam-03",
  "ts": 1760696929,
  "shotId": "cam-03-1760696929-41321",
  "size": 138297,
  "mime": "image/jpeg"
}
```

### MinIO Object Key Format:
- Format: `raw/YYYY/MM/DD/deviceId/timestamp_shotId.jpg`
- Ví dụ: `raw/2025/10/17/cam-03/1760696929_-41321.jpg`

### Kiểm tra:
```python
# Check if image exists in MinIO
from libs.minio_client import init_minio, get_minio_client
import os

init_minio()
client = get_minio_client()
bucket = os.getenv("MINIO_BUCKET", "iot-raw")

# Check for this specific image
object_key = "raw/2025/10/17/cam-03/1760696929_-41321.jpg"
try:
    client.stat_object(bucket, object_key)
    print(f"✅ Image exists in MinIO: {object_key}")
except:
    print(f"❌ Image NOT found in MinIO: {object_key}")
    print("Need to upload image to MinIO first")
```

---

## 📤 Bước 2: Upload Ảnh Lên MinIO (Nếu Chưa Có)

### Nếu ảnh chưa có trong MinIO:

**Option 1: Backend API tự động upload (nếu backend đã setup)**
- ESP32-CAM gửi ảnh → Backend API nhận và upload lên MinIO
- Metadata được lưu vào MongoDB

**Option 2: Upload thủ công bằng script**
```python
# upload_to_minio.py
from libs.minio_client import init_minio, get_minio_client
import os
from pathlib import Path

def upload_esp32_image(local_path: str, json_path: str):
    """Upload ESP32-CAM image to MinIO"""
    import json
    
    # Load metadata
    with open(json_path, 'r') as f:
        metadata = json.load(f)
    
    device_id = metadata['deviceId']
    ts = metadata['ts']
    shot_id = metadata['shotId']
    
    # Format: raw/YYYY/MM/DD/deviceId/timestamp_shotId.jpg
    # Extract date from path or use current date
    # For now, use from path: uploads/cam-03/2025/10/17/...
    path_parts = Path(local_path).parts
    year = path_parts[-3]  # 2025
    month = path_parts[-2]  # 10
    day = path_parts[-1].split('_')[0][:2] if len(path_parts[-1]) > 2 else "17"
    
    # Actually, better to parse from path
    # uploads/cam-03/2025/10/17/1760696929_-41321.jpg
    # Extract: 2025, 10, 17
    import re
    date_match = re.search(r'(\d{4})[/\\](\d{1,2})[/\\](\d{1,2})', local_path)
    if date_match:
        year, month, day = date_match.groups()
    else:
        from datetime import datetime
        now = datetime.now()
        year, month, day = str(now.year), str(now.month).zfill(2), str(now.day).zfill(2)
    
    # Extract filename
    filename = Path(local_path).name
    # 1760696929_-41321.jpg
    object_key = f"raw/{year}/{month}/{day}/{device_id}/{filename}"
    
    # Upload to MinIO
    init_minio()
    client = get_minio_client()
    bucket = os.getenv("MINIO_BUCKET", "iot-raw")
    
    try:
        client.fput_object(bucket, object_key, local_path)
        print(f"✅ Uploaded: {object_key}")
        return f"http://localhost:9002/{bucket}/{object_key}"
    except Exception as e:
        print(f"❌ Upload failed: {e}")
        return None

# Usage
if __name__ == "__main__":
    upload_esp32_image(
        "uploads/cam-03/2025/10/17/1760696929_-41321.jpg",
        "uploads/cam-03/2025/10/17/1760696929_-41321.json"
    )
```

---

## 🎯 Bước 3: Thêm Ảnh Vào Labeling Project

### Sau khi ảnh đã có trong MinIO:

**Option 1: Thêm qua API**
```powershell
$projectId = "690b312bb853bd59591d5bb2"  # Insect Dataset project

# Image URL format: http://localhost:9002/iot-raw/raw/2025/10/17/cam-03/1760696929_-41321.jpg
$imageUrl = "http://localhost:9002/iot-raw/raw/2025/10/17/cam-03/1760696929_-41321.jpg"

$body = @{
    images = @(
        @{
            imageUrl = $imageUrl
            width = 640  # Get from image metadata or actual image
            height = 480
        }
    )
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8001/api/projects/$projectId/images" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

**Option 2: Dùng script tự động**
```powershell
# add_esp32_images.ps1
$projectId = "690b312bb853bd59591d5bb2"
$uploadDir = "C:\server-bugbot\uploads\cam-03\2025\10\17"

# Get all JPG files
$images = Get-ChildItem -Path $uploadDir -Filter "*.jpg"

foreach ($img in $images) {
    $jsonFile = $img.FullName -replace "\.jpg$", ".json"
    
    if (Test-Path $jsonFile) {
        $metadata = Get-Content $jsonFile | ConvertFrom-Json
        
        # Construct MinIO URL
        $objectKey = "raw/2025/10/17/cam-03/$($img.Name)"
        $imageUrl = "http://localhost:9002/iot-raw/$objectKey"
        
        # Add to project
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
            $result = Invoke-RestMethod -Uri "http://localhost:8001/api/projects/$projectId/images" `
                -Method POST `
                -ContentType "application/json" `
                -Body $body
            
            Write-Host "✅ Added: $($img.Name)" -ForegroundColor Green
        } catch {
            Write-Host "❌ Failed: $($img.Name) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}
```

---

## 🔄 Bước 4: Sync Project Lên Label Studio

```powershell
$projectId = "690b312bb853bd59591d5bb2"
Invoke-RestMethod -Uri "http://localhost:8001/api/labelstudio/projects/$projectId/sync?sync_images=true" -Method POST
```

**Kết quả:**
- Project được tạo trong Label Studio
- Tất cả ảnh (bao gồm ESP32-CAM images) được import vào Label Studio
- Sẵn sàng để label

---

## 🏷️ Bước 5: Label Images trong Label Studio UI

1. Mở `http://localhost:8082`
2. Tìm project "Insect Dataset"
3. Label các ảnh ESP32-CAM:
   - Vẽ bounding boxes
   - Chọn class (insect, fly, bee, etc.)
   - Submit

---

## 📥 Bước 6: Lấy Dữ Liệu Gán Nhãn Về

### Cách 1: Sync Annotations Về MongoDB (Khuyến nghị)

**Làm gì:**
```powershell
.\sync_annotations.ps1
```

Hoặc:
```powershell
$projectId = "690b312bb853bd59591d5bb2"
Invoke-RestMethod -Uri "http://localhost:8001/api/labelstudio/projects/$projectId/sync-annotations" -Method POST
```

**Tại sao:**
- Annotations từ Label Studio được lưu vào MongoDB
- Format: `{"bbox": [x1, y1, x2, y2], "class": "insect", "imageId": "...", "projectId": "..."}`
- Dễ dàng query, filter, và tích hợp với hệ thống

**Kết quả:**
```json
{
  "ok": true,
  "syncedCount": 5,
  "totalAnnotations": 5,
  "message": "Synced 5 annotations from Label Studio"
}
```

### Cách 2: Export Trực Tiếp Từ Label Studio

**Làm gì:**
```powershell
.\export_annotations.ps1
```

Hoặc:
```powershell
# Export COCO format
Invoke-RestMethod -Uri "http://localhost:8001/api/projects/$projectId/export?format=coco"

# Export YOLO format
Invoke-RestMethod -Uri "http://localhost:8001/api/projects/$projectId/export?format=yolo"
```

**Tại sao:**
- Export ra format chuẩn (COCO/YOLO) để train AI models
- File JSON sẵn sàng cho training

**Kết quả:**
- File `export_coco_*.json` hoặc `export_yolo_*.json`
- Format chuẩn cho AI training

---

## 📊 Tóm Tắt Workflow Cho ESP32-CAM Images

```
1. ESP32-CAM chụp ảnh
   → Lưu vào uploads/cam-03/YYYY/MM/DD/

2. Backend API upload lên MinIO
   → Object key: raw/YYYY/MM/DD/cam-03/timestamp_shotId.jpg
   → URL: http://localhost:9002/iot-raw/raw/...

3. Thêm ảnh vào Labeling Project
   → POST /api/projects/{id}/images
   → Lưu URL vào MongoDB

4. Sync Project lên Label Studio
   → POST /api/labelstudio/projects/{id}/sync
   → Images hiển thị trong Label Studio

5. Label trong Label Studio UI
   → Vẽ bounding boxes, chọn class

6. Sync Annotations về MongoDB
   → POST /api/labelstudio/projects/{id}/sync-annotations
   → Annotations lưu trong MongoDB

7. Export Annotations
   → GET /api/projects/{id}/export?format=coco
   → File JSON sẵn sàng cho training
```

---

## ✅ Checklist

- [ ] Ảnh ESP32-CAM đã có trong MinIO?
- [ ] Ảnh đã được thêm vào Labeling Project?
- [ ] Project đã sync lên Label Studio?
- [ ] Đã label images trong Label Studio UI?
- [ ] Đã sync annotations về MongoDB?
- [ ] Đã export annotations (COCO/YOLO)?

---

## 🎯 Kết Luận

**Có, bạn cần đồng bộ ảnh ESP32-CAM lên Label Studio để gán nhãn!**

**Sau khi gán nhãn, lấy dữ liệu về bằng:**
1. **Sync về MongoDB**: `.\sync_annotations.ps1` (khuyến nghị)
2. **Export COCO/YOLO**: `.\export_annotations.ps1` (cho training)

**Workflow đầy đủ đã được thiết lập và sẵn sàng!** ✅

