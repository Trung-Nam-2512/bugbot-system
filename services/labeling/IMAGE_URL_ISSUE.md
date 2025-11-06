# Image URL Issue - Root Cause & Solution

## 🔴 Problem

Images in Label Studio show "NoSuchKey" error because:
1. **Backend API returns wrong URLs**: `http://localhost:9000/iot-raw/deviceId/test.jpg`
2. **Actual MinIO object keys**: `raw/2024/11/01/deviceId/timestamp_shotId.jpg`
3. **URLs don't match actual objects in MinIO**

## ✅ Solution

### Option 1: Use Actual MinIO Objects (Current Fix)
- ✅ Fixed 1 image to use actual MinIO object
- ⚠️ Only 1 object exists in MinIO (need more images)

### Option 2: Fix Backend API (Recommended for Production)
- Backend API should return correct URLs matching MinIO object keys
- Format: `raw/YYYY/MM/DD/deviceId/timestamp_shotId.jpg`
- Port: `9002` (not `9000`)

### Option 3: Upload More Images
- Upload test images to MinIO
- Use correct object key format: `raw/YYYY/MM/DD/deviceId/timestamp_shotId.jpg`

## 📊 Current Status

- **MinIO Objects**: 1 object found
  - `raw/2024/11/01/TEST_001/1762034554794_na.jpg`
- **Database Images**: 3 images
  - 1 image fixed ✅
  - 2 images still need MinIO objects

## 🔧 Fix Scripts

1. `check_images.py` - Check which images exist in MinIO
2. `fix_image_urls_to_real.py` - Fix URLs to use actual MinIO objects
3. `make_bucket_public.py` - Make bucket public for read access

## 📝 Next Steps

1. **Upload more images to MinIO** OR
2. **Fix backend API** to return correct URLs OR
3. **Use ClickHouse** to get correct `image_url` values

## 🎯 For Testing

For now, you can:
1. Use the 1 fixed image to test Label Studio
2. Upload more test images to MinIO
3. Or wait for backend API fix

---

**Last Updated**: After identifying root cause
**Status**: Partial fix - 1/3 images working

