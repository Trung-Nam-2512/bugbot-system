"""
Fix image URLs to use actual MinIO object keys
"""
from libs.mongodb import init_mongodb, get_database
from libs.minio_client import init_minio, get_minio_client
from bson import ObjectId
from dotenv import load_dotenv
import os

load_dotenv()

def fix_image_urls_to_real_objects(project_id: str):
    """Update image URLs to match actual MinIO objects"""
    init_mongodb()
    init_minio()
    
    db = get_database()
    minio_client = get_minio_client()
    bucket_name = os.getenv("MINIO_BUCKET", "iot-raw")
    project_obj_id = ObjectId(project_id)
    
    # Get all objects in MinIO
    minio_objects = []
    try:
        for obj in minio_client.list_objects(bucket_name, recursive=True):
            minio_objects.append(obj.object_name)
    except Exception as e:
        print(f"Error listing MinIO objects: {e}")
        return
    
    print(f"Found {len(minio_objects)} objects in MinIO")
    if minio_objects:
        print("Sample objects:")
        for obj_name in minio_objects[:3]:
            print(f"  - {obj_name}")
    print("")
    
    # Get images from database
    images = list(db.project_images.find({
        "projectId": project_obj_id
    }))
    
    print(f"Found {len(images)} images in database")
    print("")
    
    if not images:
        print("No images to fix!")
        return
    
    if not minio_objects:
        print("[ERROR] No objects in MinIO! Cannot fix URLs.")
        print("")
        print("You need to:")
        print("  1. Upload images to MinIO first")
        print("  2. Or use existing images from ClickHouse/backend")
        return
    
    # Update images to use first available MinIO object
    # In production, you'd match by deviceId/timestamp/etc.
    updated_count = 0
    
    for i, img in enumerate(images):
        if i < len(minio_objects):
            object_key = minio_objects[i]
            new_url = f"http://localhost:9002/{bucket_name}/{object_key}"
            
            result = db.project_images.update_one(
                {"_id": img["_id"]},
                {"$set": {"imageUrl": new_url}}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                print(f"Updated image {i+1}:")
                print(f"  Old: {img.get('imageUrl', 'N/A')[:80]}...")
                print(f"  New: {new_url}")
                print("")
        else:
            print(f"Image {i+1}: No MinIO object available (only {len(minio_objects)} objects)")
    
    print(f"Fixed {updated_count} image URLs")
    print("")
    print("Note: This uses first available objects. In production, match by deviceId/timestamp.")

if __name__ == "__main__":
    project_id = "690b312bb853bd59591d5bb2"
    print("=== FIXING URLs TO REAL MINIO OBJECTS ===")
    print(f"Project ID: {project_id}")
    print("")
    fix_image_urls_to_real_objects(project_id)

