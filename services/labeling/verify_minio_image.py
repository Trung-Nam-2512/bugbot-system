"""
Verify image exists in MinIO
"""
import os
import sys
from libs.minio_client import init_minio, get_minio_client

object_key = "raw/2025/11/05/cam-03/1762360229414_9-test.jpg"

init_minio()
client = get_minio_client()
bucket = os.getenv("MINIO_BUCKET", "iot-raw")

try:
    stat = client.stat_object(bucket, object_key)
    print("[OK] Anh co trong MinIO!")
    print(f"  Object Key: {object_key}")
    print(f"  Size: {stat.size} bytes")
    print(f"  Content Type: {stat.content_type}")
    print(f"  Last Modified: {stat.last_modified}")
    print("")
    print(f"  MinIO URL: http://localhost:9002/{bucket}/{object_key}")
except Exception as e:
    print(f"[ERROR] Anh KHONG co trong MinIO: {e}")

