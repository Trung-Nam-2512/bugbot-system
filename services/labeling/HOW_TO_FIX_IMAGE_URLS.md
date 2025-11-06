# How to Fix Image URLs for Label Studio

## ✅ Working Solution (Successfully Applied)

### Step 1: Check Actual MinIO Objects
```python
# Check what objects actually exist in MinIO
from libs.minio_client import init_minio, get_minio_client
import os

init_minio()
client = get_minio_client()
bucket = os.getenv("MINIO_BUCKET", "iot-raw")

for obj in client.list_objects(bucket, recursive=True):
    print(obj.object_name)
```

### Step 2: Make Bucket Public
```python
# Run: python make_bucket_public.py
# This sets bucket policy to allow public read access
```

### Step 3: Fix URLs to Match Actual Objects
```python
# Run: python fix_image_urls_to_real.py
# This updates image URLs in database to use actual MinIO object keys
```

### Step 4: Re-sync to Label Studio
```powershell
.\complete_workflow.ps1
```

---

## 🔑 Key Points

### Port Configuration
- ✅ **Port 9002** = MinIO (CORRECT for images)
- ❌ **Port 9000** = ClickHouse (NOT for images)

### URL Format
- ❌ **Wrong**: `http://localhost:9000/iot-raw/deviceId/test.jpg` (from backend API)
- ✅ **Correct**: `http://localhost:9002/iot-raw/raw/2024/11/01/deviceId/timestamp_shotId.jpg` (actual MinIO object key)

### MinIO Object Key Format
- Actual format: `raw/YYYY/MM/DD/deviceId/timestamp_shotId.jpg`
- Backend API returns: `deviceId/test.jpg` (WRONG - doesn't match)

---

## 📝 Scripts Created

1. **check_images.py** - Check which images exist in MinIO
2. **make_bucket_public.py** - Make bucket public for read access
3. **fix_image_urls_to_real.py** - Fix URLs to use actual MinIO objects
4. **fix_urls_to_direct.py** - Change presigned URLs to direct URLs

---

## 🎯 Workflow

1. **Check MinIO objects**:
   ```bash
   python check_images.py
   ```

2. **Make bucket public** (if not already):
   ```bash
   python make_bucket_public.py
   ```

3. **Fix URLs to match actual objects**:
   ```bash
   python fix_image_urls_to_real.py
   ```

4. **Re-sync to Label Studio**:
   ```powershell
   .\complete_workflow.ps1
   ```

---

## ⚠️ Important Notes

1. **Backend API Issue**: Backend API returns wrong URLs (port 9000, wrong format)
   - Need to fix backend API to return correct URLs
   - Or use ClickHouse to get correct `image_url` values

2. **Object Key Mismatch**: URLs must match actual MinIO object keys
   - Format: `raw/YYYY/MM/DD/deviceId/timestamp_shotId.jpg`
   - Not: `deviceId/test.jpg`

3. **Bucket Policy**: Bucket must be public for Label Studio to access images
   - Use `make_bucket_public.py` or MinIO Console
   - Set policy to "Download" (read-only)

---

## ✅ Success Criteria

- ✅ Images load in Label Studio UI
- ✅ No "Access Denied" errors
- ✅ No "NoSuchKey" errors
- ✅ URLs use port 9002
- ✅ URLs match actual MinIO object keys

---

**Last Tested**: Working with 1 image successfully
**Method**: Use actual MinIO object keys, make bucket public, use port 9002

