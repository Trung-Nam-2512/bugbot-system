# Fix: Label Studio Authentication Error (401)

## 🔴 Lỗi

```
Label Studio API error 401: Authentication credentials were not provided.
```

## 🔍 Nguyên Nhân

1. **Access token hết hạn**: JWT Personal Access Token (PAT) cần refresh để lấy access token mới
2. **Service chưa re-init**: Labeling Service đã khởi động trước khi token được refresh
3. **Token không được refresh tự động**: Access token cần được refresh khi gọi API

## ✅ Giải Pháp

### Cách 1: Restart Labeling Service (Khuyến nghị)

**Restart service để re-init Label Studio connection với token mới:**

```powershell
# Stop service (Ctrl+C trong terminal đang chạy service)

# Start lại
cd C:\server-bugbot\services\labeling
python main.py
# hoặc
uvicorn main:app --port 8001 --reload
```

**Sau khi restart, thử sync lại:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8001/api/labelstudio/projects/690b312bb853bd59591d5bb2/sync?sync_images=true" -Method POST
```

### Cách 2: Kiểm Tra Token và URL

**Kiểm tra `.env` file:**
```powershell
cd C:\server-bugbot\services\labeling
Get-Content .env | Select-String "LABELSTUDIO"
```

**Đảm bảo:**
- `LABELSTUDIO_URL=http://localhost:8082` (KHÔNG phải 8080!)
- `LABELSTUDIO_API_TOKEN=your_token_here` (token hợp lệ)

### Cách 3: Test Connection Trực Tiếp

```python
cd C:\server-bugbot\services\labeling
python -c "from libs.labelstudio_client import init_labelstudio, list_projects; init_labelstudio(); print(list_projects())"
```

**Nếu thành công:** Kết nối OK, chỉ cần restart service
**Nếu lỗi:** Cần kiểm tra token mới

## 🔧 Đã Fix Trong Code

Đã thêm function `_refresh_access_token_if_needed()` để tự động refresh token khi cần:
- Tự động refresh JWT PAT khi access_token hết hạn
- Tự động re-init connection nếu chưa connected
- Retry logic khi gặp lỗi 401

## 📝 Workflow Sau Khi Fix

1. **Restart Labeling Service**
2. **Thêm ảnh ESP32-CAM vào project:**
   ```bash
   python add_esp32_to_project.py 690b312bb853bd59591d5bb2 cam-03 2025 10 17 50
   ```
3. **Sync project lên Label Studio:**
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:8001/api/labelstudio/projects/690b312bb853bd59591d5bb2/sync?sync_images=true" -Method POST
   ```
4. **Kiểm tra trong Label Studio UI:** `http://localhost:8082`

## ✅ Kết Quả Mong Đợi

- ✅ Sync thành công (không còn lỗi 401)
- ✅ Ảnh ESP32-CAM hiển thị trong Label Studio
- ✅ Có thể label images trong Label Studio UI

---

**Lưu ý:** Sau khi fix code, cần restart service để áp dụng thay đổi!

