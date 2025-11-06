# Label Studio Quick Start - Local Setup

## ⚠️ Port Conflict Note

**Port 8080 đang được dùng bởi Redpanda Console** (Kafka management UI trong hệ thống của bạn).

**Giải pháp:** Dùng port **8082** cho Label Studio thay vì 8080.

---

## 🚀 Setup Label Studio trên máy local

### Bước 1: Cài đặt Label Studio

**Docker (Khuyên dùng):**
```powershell
# Chạy Label Studio trên port 8082 (tránh conflict với Redpanda Console)
docker run -it -p 8082:8080 -v C:\labelstudio-data:/label-studio/data heartexlabs/label-studio:latest
```

**Hoặc pip install:**
```powershell
pip install label-studio
label-studio --port 8082
```

### Bước 2: Truy cập Label Studio

1. Mở browser: `http://localhost:8082` (KHÔNG phải 8080)
2. Tạo account mới (lần đầu tiên)
3. Login vào Label Studio

### Bước 3: Lấy API Token

1. **Login vào Label Studio** tại `http://localhost:8082`
2. **Click vào avatar** (góc trên bên phải)
3. **Chọn "Account & Settings"**
4. **Tab "Access Token"**
5. **Copy token** (format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### Bước 4: Cấu hình trong Labeling Service

**Tạo file `.env` trong `services/labeling/`:**

```env
# Label Studio Configuration
LABELSTUDIO_URL=http://localhost:8082
LABELSTUDIO_API_TOKEN=your_token_here_paste_from_step_3
```

**Hoặc set environment variables:**

```powershell
# PowerShell
$env:LABELSTUDIO_URL="http://localhost:8082"
$env:LABELSTUDIO_API_TOKEN="your_token_here"
```

### Bước 5: Test kết nối

```powershell
cd C:\server-bugbot\services\labeling
.\venv\Scripts\activate
python -c "from libs.labelstudio_client import init_labelstudio; print('Connected!' if init_labelstudio() else 'Not connected')"
```

## 📝 Ports trong hệ thống

| Service | Port | URL |
|---------|------|-----|
| **Redpanda Console** | 8080 | http://localhost:8080 |
| **Label Studio** | 8082 | http://localhost:8082 |
| **Labeling Service** | 8001 | http://localhost:8001 |
| **AI Inference** | 8000 | http://localhost:8000 |
| **Backend API** | 1435 | http://localhost:1435 |

## 📝 Ví dụ sử dụng

### 1. Tạo project trong Labeling Service

```powershell
curl -X POST http://localhost:8001/api/projects `
  -H "Content-Type: application/json" `
  -d '{
    "name": "My Project",
    "description": "Test project",
    "annotationType": "object_detection",
    "classNames": ["insect", "bird"]
  }'
```

### 2. Sync project lên Label Studio

```powershell
# Lấy project_id từ response trên
$projectId = "your_project_id_here"

curl -X POST "http://localhost:8001/api/labelstudio/projects/$projectId/sync?sync_images=true"
```

### 3. Mở Label Studio và label

1. Mở `http://localhost:8082` (KHÔNG phải 8080)
2. Tìm project vừa sync
3. Click vào project
4. Label images với bounding boxes
5. Submit annotations

### 4. Sync annotations về

```powershell
curl -X POST "http://localhost:8001/api/labelstudio/projects/$projectId/sync-annotations"
```

### 5. Export annotations

```powershell
curl "http://localhost:8001/api/projects/$projectId/export?format=coco"
```

## 🔍 Troubleshooting

### Port 8082 đã được sử dụng

**Giải pháp:**
```powershell
# Kiểm tra port
netstat -ano | findstr :8082

# Hoặc dùng port khác (ví dụ 8083)
docker run -it -p 8083:8080 heartexlabs/label-studio:latest
# Sau đó set LABELSTUDIO_URL=http://localhost:8083
```

### Không tìm thấy API Token

**Giải pháp:**
1. Đảm bảo đã login vào Label Studio
2. Check xem có quyền admin không
3. Token nằm ở: Avatar → Account & Settings → Access Token

### Connection refused

**Kiểm tra:**
1. Label Studio đang chạy không? (mở `http://localhost:8082`)
2. URL đúng chưa? (`LABELSTUDIO_URL=http://localhost:8082`)
3. Token đúng chưa? (copy lại từ Label Studio)

## 💡 Tips

- **Docker**: Dễ nhất, tự động setup
- **Data persistence**: Dùng volume để lưu data: `-v C:\labelstudio-data:/label-studio/data`
- **Multiple projects**: Label Studio có thể quản lý nhiều projects
- **Auto-sync**: Có thể setup webhook để auto-sync khi annotation xong

## 🎯 Next Steps

Sau khi setup xong:
1. ✅ Test connection
2. ✅ Create project và sync
3. ✅ Label một vài images
4. ✅ Sync annotations về
5. ✅ Export annotations (COCO/YOLO)
