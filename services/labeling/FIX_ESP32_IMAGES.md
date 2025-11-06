# Fix: ESP32-CAM Images Not Showing in Label Studio

## 🔴 Vấn Đề

Bạn đã:
1. ✅ Upload ảnh ESP32-CAM lên MinIO (139 ảnh)
2. ✅ Sync project lên Label Studio
3. ❌ **NHƯNG không thấy ảnh ESP32-CAM trong Label Studio!**

## 🔍 Nguyên Nhân

**Vấn đề:** Ảnh ESP32-CAM đã có trong MinIO, NHƯNG chưa được thêm vào Project trong MongoDB!

**Workflow:**
```
MinIO (139 ảnh ESP32-CAM)
    ↓ ❌ THIẾU BƯỚC NÀY!
MongoDB Project (chỉ có 3 test images)
    ↓
Sync → Label Studio (chỉ sync 3 test images)
```

**Sync chỉ lấy ảnh từ MongoDB → Label Studio**, không tự động lấy từ MinIO!

## ✅ Giải Pháp

### Bước 1: Thêm Ảnh ESP32-CAM vào Project

**Chạy script:**
```bash
cd C:\server-bugbot\services\labeling
python add_esp32_to_project.py [project_id] [device_id] [year] [month] [day] [limit]
```

**Ví dụ:**
```bash
# Thêm 20 ảnh đầu tiên
python add_esp32_to_project.py 690b312bb853bd59591d5bb2 cam-03 2025 10 17 20

# Thêm tất cả ảnh (100 ảnh)
python add_esp32_to_project.py 690b312bb853bd59591d5bb2 cam-03 2025 10 17 100
```

**Script sẽ:**
1. Lấy danh sách ảnh từ MinIO (`raw/2025/10/17/cam-03/`)
2. Thêm vào Project qua API (`POST /api/projects/{id}/images`)
3. Lưu vào MongoDB collection `project_images`

### Bước 2: Sync Project Lên Label Studio

**Sau khi thêm ảnh vào project:**
```powershell
$projectId = "690b312bb853bd59591d5bb2"
Invoke-RestMethod -Uri "http://localhost:8001/api/labelstudio/projects/$projectId/sync?sync_images=true" -Method POST
```

**Hoặc dùng script:**
```powershell
.\complete_workflow.ps1
```

## 📋 Workflow Đúng

```
1. ESP32-CAM chụp ảnh
   ↓
2. Backend API upload lên MinIO ✅
   ↓
3. Thêm ảnh vào Project (MongoDB) ✅ ← BƯỚC NÀY BẠN THIẾU!
   ↓
4. Sync Project lên Label Studio ✅
   ↓
5. Ảnh hiển thị trong Label Studio ✅
```

## 🎯 Sau Khi Fix

**Kiểm tra:**
```powershell
# Kiểm tra ảnh trong project
Invoke-RestMethod -Uri "http://localhost:8001/api/projects/690b312bb853bd59591d5bb2/images"

# Kiểm tra Label Studio project
Invoke-RestMethod -Uri "http://localhost:8001/api/labelstudio/projects/690b312bb853bd59591d5bb2/status"
```

**Kết quả mong đợi:**
- ✅ Project có nhiều ảnh ESP32-CAM (20+ ảnh)
- ✅ Label Studio Project ID: 11 (đã sync)
- ✅ Ảnh hiển thị trong Label Studio UI

## 📝 Lưu Ý

1. **Script `upload_esp32_images.py`** chỉ upload lên MinIO, KHÔNG thêm vào project
2. **Script `add_esp32_to_project.py`** đọc từ MinIO và thêm vào project
3. **Cần chạy cả 2 bước** nếu ảnh chưa có trong MinIO
4. **Nếu ảnh đã có trong MinIO**, chỉ cần chạy `add_esp32_to_project.py`

## ✅ Đã Fix

- ✅ Script `add_esp32_to_project.py` đã được tạo
- ✅ 20 ảnh ESP32-CAM đã được thêm vào project
- ✅ Project hiện có 23 ảnh (20 ESP32 + 3 test)
- ✅ Sync lại lên Label Studio để hiển thị ảnh mới

---

**Lần sau:** Nhớ thêm ảnh vào project trước khi sync! 🎯

