"""
Fix image URLs to use presigned URLs or public access
"""
import os
from datetime import timedelta
from libs.mongodb import init_mongodb, get_database
from libs.minio_client import init_minio, get_minio_client
from bson import ObjectId
from dotenv import load_dotenv
import os

load_dotenv()

def generate_presigned_url(object_key: str, expiry_hours: int = 24 * 7) -> str:
    """Generate presigned URL for MinIO object"""
    try:
        minio_client = get_minio_client()
        bucket_name = os.getenv("MINIO_BUCKET", "iot-raw")
        
        # Remove bucket name if present in object_key
        if object_key.startswith(f"{bucket_name}/"):
            object_key = object_key[len(bucket_name) + 1:]
        elif object_key.startswith("/"):
            object_key = object_key[1:]
        
        # Generate presigned URL (7 days expiry)
        url = minio_client.presigned_get_object(
            bucket_name,
            object_key,
            expires=timedelta(hours=expiry_hours)
        )
        return url
    except Exception as e:
        print(f"Error generating presigned URL for '{object_key}': {e}")
        return None

def fix_image_urls_to_presigned(project_id: str):
    """Update image URLs to use presigned URLs"""
    init_mongodb()
    init_minio()
    
    db = get_database()
    project_obj_id = ObjectId(project_id)
    
    # Get all images
    images = list(db.project_images.find({
        "projectId": project_obj_id
    }))
    
    print(f"Found {len(images)} images")
    print("")
    
    if not images:
        print("No images to fix!")
        return
    
    updated_count = 0
    for img in images:
        old_url = img.get("imageUrl", "")
        
        # Extract object path from URL
        # Format: http://localhost:9002/iot-raw/path/to/image.jpg
        # Or: http://localhost:9002/iot-raw/path/to/image.jpg?X-Amz-... (already presigned)
        
        # Check if URL is already presigned
        if "?X-Amz-" in old_url or "%3FX-Amz-" in old_url:
            print(f"URL already presigned, skipping: {old_url[:80]}...")
            continue
        
        # Extract object key (remove bucket name and query params)
        if "localhost:9002/" in old_url:
            path_part = old_url.split("localhost:9002/")[1].split("?")[0]
        elif "localhost:9000/" in old_url:
            path_part = old_url.split("localhost:9000/")[1].split("?")[0]
        else:
            print(f"Skipping URL (unexpected format): {old_url}")
            continue
        
        # Remove bucket name from path if present
        if path_part.startswith("iot-raw/"):
            object_key = path_part[len("iot-raw/"):]
        else:
            object_key = path_part
        
        # Generate presigned URL
        new_url = generate_presigned_url(object_key)
        
        if new_url:
            result = db.project_images.update_one(
                {"_id": img["_id"]},
                {"$set": {"imageUrl": new_url}}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                print(f"Updated: {old_url}")
                print(f"  -> {new_url[:80]}...")
        else:
            print(f"Failed to generate presigned URL for: {old_url}")
    
    print("")
    print(f"Fixed {updated_count} image URLs to use presigned URLs")

if __name__ == "__main__":
    project_id = "690b312bb853bd59591d5bb2"
    print("=== FIXING IMAGE URLs TO PRESIGNED URLs ===")
    print(f"Project ID: {project_id}")
    print("")
    fix_image_urls_to_presigned(project_id)

