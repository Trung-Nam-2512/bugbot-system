"""
Script to upload ESP32-CAM images from local uploads directory to MinIO
and add them to Labeling Project
"""
import os
import json
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path to import libs
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from libs.minio_client import init_minio, get_minio_client
from dotenv import load_dotenv

load_dotenv()

def upload_esp32_image_to_minio(local_path: str, json_path: str) -> str:
    """
    Upload ESP32-CAM image to MinIO
    
    Args:
        local_path: Path to image file (e.g., uploads/cam-03/2025/10/17/1760696929_-41321.jpg)
        json_path: Path to metadata JSON file
    
    Returns:
        MinIO object key or None if failed
    """
    try:
        # Load metadata
        with open(json_path, 'r') as f:
            metadata = json.load(f)
        
        device_id = metadata['deviceId']
        ts = metadata['ts']
        shot_id = metadata.get('shotId', f"{device_id}-{ts}-{Path(local_path).stem.split('_')[-1]}")
        
        # Extract date from path: uploads/cam-03/2025/10/17/1760696929_-41321.jpg
        path_parts = Path(local_path).parts
        
        # Find date parts in path
        year = None
        month = None
        day = None
        
        for i, part in enumerate(path_parts):
            if part.isdigit() and len(part) == 4:  # Year
                year = part
                if i + 1 < len(path_parts) and path_parts[i + 1].isdigit():
                    month = path_parts[i + 1]
                if i + 2 < len(path_parts) and path_parts[i + 2].isdigit():
                    day = path_parts[i + 2]
                break
        
        if not year:
            # Use current date if not found
            now = datetime.now()
            year, month, day = str(now.year), str(now.month).zfill(2), str(now.day).zfill(2)
        
        # Format: raw/YYYY/MM/DD/deviceId/timestamp_shotId.jpg
        filename = Path(local_path).name
        object_key = f"raw/{year}/{month}/{day}/{device_id}/{filename}"
        
        # Upload to MinIO
        init_minio()
        client = get_minio_client()
        bucket = os.getenv("MINIO_BUCKET", "iot-raw")
        
        # Check if already exists
        try:
            client.stat_object(bucket, object_key)
            print(f"[SKIP] Already exists: {object_key}")
            return object_key
        except:
            pass
        
        # Upload
        client.fput_object(bucket, object_key, local_path)
        print(f"[OK] Uploaded: {object_key}")
        return object_key
        
    except Exception as e:
        print(f"[ERROR] Failed to upload {local_path}: {e}")
        return None

def add_image_to_project(project_id: str, image_url: str, width: int = 640, height: int = 480):
    """Add image to Labeling Project via API"""
    import requests
    
    url = f"http://localhost:8001/api/projects/{project_id}/images"
    data = {
        "images": [{
            "imageUrl": image_url,
            "width": width,
            "height": height
        }]
    }
    
    try:
        response = requests.post(url, json=data, timeout=10)
        response.raise_for_status()
        result = response.json()
        if result.get("ok"):
            print(f"[OK] Added to project: {image_url}")
            return True
        else:
            print(f"[ERROR] Failed to add: {result.get('detail', 'Unknown error')}")
            return False
    except Exception as e:
        print(f"[ERROR] API call failed: {e}")
        return False

def process_esp32_images(upload_dir: str, project_id: str):
    """
    Process all ESP32-CAM images in upload directory
    
    Args:
        upload_dir: Directory containing ESP32-CAM images (e.g., uploads/cam-03/2025/10/17)
        project_id: Labeling Project ID
    """
    upload_path = Path(upload_dir)
    
    if not upload_path.exists():
        print(f"[ERROR] Directory not found: {upload_dir}")
        return
    
    # Get all JPG files
    jpg_files = list(upload_path.glob("*.jpg"))
    
    if not jpg_files:
        print(f"[WARN] No JPG files found in {upload_dir}")
        return
    
    print(f"Found {len(jpg_files)} images to process")
    print("")
    
    uploaded_count = 0
    added_count = 0
    
    for jpg_file in jpg_files:
        json_file = jpg_file.with_suffix('.json')
        
        if not json_file.exists():
            print(f"[SKIP] No JSON metadata for {jpg_file.name}")
            continue
        
        print(f"Processing: {jpg_file.name}")
        
        # Upload to MinIO
        object_key = upload_esp32_image_to_minio(str(jpg_file), str(json_file))
        
        if object_key:
            uploaded_count += 1
            
            # Construct image URL
            bucket = os.getenv("MINIO_BUCKET", "iot-raw")
            image_url = f"http://localhost:9002/{bucket}/{object_key}"
            
            # Add to project
            if add_image_to_project(project_id, image_url):
                added_count += 1
        
        print("")
    
    print("=== SUMMARY ===")
    print(f"Uploaded to MinIO: {uploaded_count}/{len(jpg_files)}")
    print(f"Added to project: {added_count}/{len(jpg_files)}")
    print("")
    print(f"Next step: Sync project to Label Studio")
    print(f"  POST http://localhost:8001/api/labelstudio/projects/{project_id}/sync?sync_images=true")

if __name__ == "__main__":
    # Default values
    upload_dir = sys.argv[1] if len(sys.argv) > 1 else "uploads/cam-03/2025/10/17"
    project_id = sys.argv[2] if len(sys.argv) > 2 else "690b312bb853bd59591d5bb2"
    
    # Convert to absolute path
    if not os.path.isabs(upload_dir):
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), upload_dir)
    
    print("=== UPLOAD ESP32-CAM IMAGES ===")
    print(f"Upload directory: {upload_dir}")
    print(f"Project ID: {project_id}")
    print("")
    
    process_esp32_images(upload_dir, project_id)

