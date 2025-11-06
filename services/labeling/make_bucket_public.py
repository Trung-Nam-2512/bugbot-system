"""
Make MinIO bucket public for read access
This is simpler than presigned URLs for Label Studio
"""
from libs.minio_client import init_minio, get_minio_client
import json
from dotenv import load_dotenv
import os

load_dotenv()

def make_bucket_public():
    """Make MinIO bucket public for read access"""
    init_minio()
    minio_client = get_minio_client()
    bucket_name = os.getenv("MINIO_BUCKET", "iot-raw")
    
    try:
        # Set bucket policy to allow public read
        # This is the S3 bucket policy format
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": "*"},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
                }
            ]
        }
        
        # Apply policy
        minio_client.set_bucket_policy(bucket_name, json.dumps(policy))
        print(f"[OK] Bucket '{bucket_name}' is now public for read access")
        print("")
        print("You can now use direct URLs like:")
        print(f"  http://localhost:9002/{bucket_name}/path/to/image.jpg")
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to make bucket public: {e}")
        print("")
        print("Alternative: Use MinIO Console to set bucket policy:")
        print("  1. Open http://localhost:9001 (MinIO Console)")
        print("  2. Login with minioadmin/minioadmin123")
        print(f"  3. Go to bucket '{bucket_name}'")
        print("  4. Set policy to 'Download' (public read)")
        return False

if __name__ == "__main__":
    print("=== MAKING MINIO BUCKET PUBLIC ===")
    print("")
    make_bucket_public()

