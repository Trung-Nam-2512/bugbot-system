"""
Script to add ESP32-CAM images from MinIO to Labeling Project
This script reads images from MinIO and adds them to the project via API
"""
import os
import sys
import requests
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from libs.minio_client import init_minio, get_minio_client
from dotenv import load_dotenv

load_dotenv()

def get_esp32_images_from_minio(device_id: str = "cam-03", year: str = "2025", month: str = "10", day: str = "17", limit: int = 100):
    """Get ESP32-CAM images from MinIO"""
    init_minio()
    client = get_minio_client()
    bucket = os.getenv("MINIO_BUCKET", "iot-raw")
    
    prefix = f"raw/{year}/{month}/{day}/{device_id}/"
    objects = list(client.list_objects(bucket, prefix=prefix, recursive=True))
    
    images = []
    for obj in objects[:limit]:
        object_key = obj.object_name
        # Construct image URL
        image_url = f"http://localhost:9002/{bucket}/{object_key}"
        images.append({
            "imageUrl": image_url,
            "objectKey": object_key
        })
    
    return images

def add_images_to_project(project_id: str, images: list):
    """Add images to project via API"""
    url = f"http://localhost:8001/api/projects/{project_id}/images"
    
    # Prepare request body - API requires imageIds and imageUrls
    image_urls = []
    image_ids = []
    
    for img in images:
        image_urls.append(img["imageUrl"])
        # Generate image ID from object key or use URL hash
        object_key = img["objectKey"]
        # Extract filename as ID
        image_id = object_key.split("/")[-1].replace(".jpg", "").replace(".jpeg", "")
        image_ids.append(image_id)
    
    # Split into batches of 50
    batch_size = 50
    total_added = 0
    
    for i in range(0, len(image_urls), batch_size):
        batch_urls = image_urls[i:i + batch_size]
        batch_ids = image_ids[i:i + batch_size]
        
        body = {
            "imageIds": batch_ids,
            "imageUrls": batch_urls
        }
        
        try:
            response = requests.post(url, json=body, timeout=30)
            response.raise_for_status()
            result = response.json()
            
            if result.get("ok"):
                added = result.get("added", len(batch_urls))
                total_added += added
                print(f"[OK] Added batch {i//batch_size + 1}: {added}/{len(batch_urls)} images")
            else:
                print(f"[ERROR] Batch {i//batch_size + 1} failed: {result.get('detail', 'Unknown error')}")
        except Exception as e:
            print(f"[ERROR] Batch {i//batch_size + 1} failed: {e}")
    
    return total_added

if __name__ == "__main__":
    project_id = sys.argv[1] if len(sys.argv) > 1 else "690b312bb853bd59591d5bb2"
    device_id = sys.argv[2] if len(sys.argv) > 2 else "cam-03"
    year = sys.argv[3] if len(sys.argv) > 3 else "2025"
    month = sys.argv[4] if len(sys.argv) > 4 else "10"
    day = sys.argv[5] if len(sys.argv) > 5 else "17"
    limit = int(sys.argv[6]) if len(sys.argv) > 6 else 100
    
    print("=== ADD ESP32-CAM IMAGES TO PROJECT ===")
    print(f"Project ID: {project_id}")
    print(f"Device: {device_id}")
    print(f"Date: {year}/{month}/{day}")
    print(f"Limit: {limit} images")
    print("")
    
    # Get images from MinIO
    print("Getting images from MinIO...")
    images = get_esp32_images_from_minio(device_id, year, month, day, limit)
    print(f"Found {len(images)} images in MinIO")
    print("")
    
    if not images:
        print("[WARN] No images found in MinIO!")
        sys.exit(1)
    
    # Add to project
    print("Adding images to project...")
    total_added = add_images_to_project(project_id, images)
    
    print("")
    print("=== SUMMARY ===")
    print(f"Found in MinIO: {len(images)}")
    print(f"Added to project: {total_added}")
    print("")
    print("Next step: Sync project to Label Studio")
    print(f"  POST http://localhost:8001/api/labelstudio/projects/{project_id}/sync?sync_images=true")

