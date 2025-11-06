# Label Studio Workflow - Hướng Dẫn Chi Tiết

## 📋 Workflow Tổng Quan

```
1. Tạo Project trong Labeling Service
   ↓
2. Sync Project lên Label Studio (từ terminal/API)
   ↓
3. Vào Label Studio UI để label images
   ↓
4. Sync Annotations về (từ terminal/API - KHÔNG cần vào Label Studio)
   ↓
5. Export annotations (COCO/YOLO)
```

---

## 🔄 Chi Tiết Từng Bước

### Bước 1: Tạo Project trong Labeling Service

**Chạy từ terminal (KHÔNG cần vào Label Studio):**

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

**Response:**
```json
{
  "ok": true,
  "project": {
    "id": "507f1f77bcf86cd799439011",
    "name": "My Project",
    ...
  }
}
```

**Lưu `project_id` để dùng cho các bước tiếp theo.**

---

### Bước 2: Thêm Images vào Project

**Chạy từ terminal (KHÔNG cần vào Label Studio):**

```powershell
$projectId = "507f1f77bcf86cd799439011"

curl -X POST "http://localhost:8001/api/projects/$projectId/images" `
  -H "Content-Type: application/json" `
  -d '{
    "images": [
      {
        "imageUrl": "http://example.com/image1.jpg",
        "width": 640,
        "height": 480
      }
    ]
  }'
```

---

### Bước 3: Sync Project lên Label Studio

**Chạy từ terminal (KHÔNG cần vào Label Studio):**

```powershell
curl -X POST "http://localhost:8001/api/labelstudio/projects/$projectId/sync?sync_images=true"
```

**Endpoint này sẽ:**
- ✅ Tạo project trong Label Studio
- ✅ Import tất cả images vào Label Studio
- ✅ Tự động tạo labeling interface dựa trên classNames

**Response:**
```json
{
  "ok": true,
  "result": {
    "labelStudioProjectId": 1,
    "internalProjectId": "507f1f77bcf86cd799439011",
    "message": "Project synced to Label Studio successfully"
  }
}
```

---

### Bước 4: Vào Label Studio UI để Label

**Bước này CẦN vào Label Studio UI:**

1. Mở browser: `http://localhost:8082`
2. Login vào Label Studio
3. Tìm project vừa sync (tên sẽ là "My Project")
4. Click vào project
5. Label images với bounding boxes:
   - Click và kéo để vẽ bounding box
   - Chọn class (insect, bird, etc.)
   - Submit annotation
6. Lặp lại cho tất cả images cần label

**Lưu ý:** Đây là bước DUY NHẤT cần vào Label Studio UI.

---

### Bước 5: Sync Annotations về (TỪ TERMINAL)

**Chạy từ terminal (KHÔNG cần vào Label Studio):**

```powershell
curl -X POST "http://localhost:8001/api/labelstudio/projects/$projectId/sync-annotations"
```

**Endpoint này sẽ:**
- ✅ Tự động export annotations từ Label Studio
- ✅ Transform về format internal
- ✅ Lưu vào MongoDB
- ✅ **Bạn KHÔNG cần vào Label Studio để chạy lệnh này!**

**Response:**
```json
{
  "ok": true,
  "syncedCount": 5,
  "totalAnnotations": 5,
  "message": "Synced 5 annotations from Label Studio"
}
```

---

### Bước 6: Export Annotations

**Chạy từ terminal (KHÔNG cần vào Label Studio):**

```powershell
# Export COCO format
curl "http://localhost:8001/api/projects/$projectId/export?format=coco"

# Export YOLO format
curl "http://localhost:8001/api/projects/$projectId/export?format=yolo"
```

---

## 🎯 Tóm Tắt

| Bước | Cần Vào Label Studio? | Chạy Từ |
|------|----------------------|---------|
| 1. Tạo Project | ❌ KHÔNG | Terminal/API |
| 2. Thêm Images | ❌ KHÔNG | Terminal/API |
| 3. Sync lên Label Studio | ❌ KHÔNG | Terminal/API |
| 4. Label Images | ✅ **CÓ** | Label Studio UI |
| 5. Sync Annotations về | ❌ **KHÔNG** | Terminal/API |
| 6. Export | ❌ KHÔNG | Terminal/API |

---

## 💡 Lưu Ý

1. **Chỉ bước 4 (Label Images) cần vào Label Studio UI**
2. **Tất cả các bước khác đều chạy từ terminal/API**
3. **Endpoint `sync-annotations` tự động lấy annotations từ Label Studio - bạn không cần làm gì trong Label Studio**
4. **Có thể chạy `sync-annotations` nhiều lần - nó sẽ update annotations mới**

---

## 🔄 Workflow Tự Động (Nếu Muốn)

Có thể setup webhook hoặc cron job để tự động sync annotations:

```powershell
# Chạy mỗi 5 phút để sync annotations mới
while ($true) {
    curl -X POST "http://localhost:8001/api/labelstudio/projects/$projectId/sync-annotations"
    Start-Sleep -Seconds 300
}
```

---

## ❓ FAQ

**Q: Tôi có thể chạy sync-annotations mà không vào Label Studio không?**  
A: ✅ **CÓ!** Endpoint này hoàn toàn tự động, chỉ cần chạy từ terminal.

**Q: Sync-annotations làm gì?**  
A: Tự động export annotations từ Label Studio và lưu vào MongoDB của bạn.

**Q: Khi nào cần vào Label Studio?**  
A: Chỉ khi bạn muốn label images (bước 4).

**Q: Có thể label trực tiếp trong hệ thống không?**  
A: Hiện tại chưa có UI, nên cần dùng Label Studio. Nhưng có thể tạo UI sau.

