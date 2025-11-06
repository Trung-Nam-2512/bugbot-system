"""
MinIO client for Labeling Service
"""

from minio import Minio
from minio.error import S3Error
from utils.logger import setup_logger
import os

logger = setup_logger(__name__)

minio_client = None
is_connected = False

def init_minio():
    """Initialize MinIO client"""
    global minio_client, is_connected
    
    try:
        endpoint = os.getenv("MINIO_ENDPOINT", "localhost")
        port = int(os.getenv("MINIO_PORT", "9002"))
        access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
        secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
        use_ssl = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
        
        minio_client = Minio(
            f"{endpoint}:{port}",
            access_key=access_key,
            secret_key=secret_key,
            secure=use_ssl
        )
        
        # Test connection
        minio_client.list_buckets()
        is_connected = True
        
        logger.info(f"MinIO connected: {endpoint}:{port}")
        is_connected = True
        return True
    except Exception as e:
        logger.error(f"Failed to connect to MinIO: {e}")
        is_connected = False
        return False

async def init_minio_async():
    """Initialize MinIO client (async wrapper)"""
    return init_minio()

def get_minio_client():
    """Get MinIO client instance"""
    if not is_connected or not minio_client:
        raise Exception("MinIO not connected")
    return minio_client

def generate_presigned_url(object_key: str, bucket_name: str = None, expiry_hours: int = 24 * 7) -> str:
    """Generate presigned URL for MinIO object"""
    if not is_connected or not minio_client:
        raise Exception("MinIO not connected")
    
    if bucket_name is None:
        bucket_name = os.getenv("MINIO_BUCKET", "iot-raw")
    
    try:
        from datetime import timedelta
        url = minio_client.presigned_get_object(
            bucket_name,
            object_key,
            expires=timedelta(hours=expiry_hours)
        )
        return url
    except Exception as e:
        logger.error(f"Failed to generate presigned URL: {e}")
        raise

