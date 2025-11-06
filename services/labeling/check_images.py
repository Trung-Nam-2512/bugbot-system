"""
Check images in database vs MinIO
"""
from libs.mongodb import init_mongodb, get_database
from libs.minio_client import init_minio, get_minio_client
from bson import ObjectId
from dotenv import load_dotenv
import os

load_dotenv()

def check_images():
    """Check if images in database exist in MinIO"""
    init_mongodb()
    init_minio()
    
    db = get_database()
    minio_client = get_minio_client()
    bucket_name = os.getenv("MINIO_BUCKET", "iot-raw")
    project_id = "690b312bb853bd59591d5bb2"
    
    # Get images from database
    images = list(db.project_images.find({
        "projectId": ObjectId(project_id)
    }))
    
    print(f"=== CHECKING {len(images)} IMAGES ===")
    print("")
    
    # Get all objects in MinIO
    minio_objects = {}
    minio_object_list = []
    try:
        for obj in minio_client.list_objects(bucket_name, recursive=True):
            minio_objects[obj.object_name] = True
            minio_object_list.append(obj.object_name)
    except Exception as e:
        print(f"Error listing MinIO objects: {e}")
        return
    
    print(f"Found {len(minio_objects)} objects in MinIO bucket '{bucket_name}'")
    if minio_object_list:
        print("Sample objects in MinIO:")
        for obj_name in minio_object_list[:5]:
            print(f"  - {obj_name}")
    print("")
    
    # Check each image
    missing_count = 0
    for img in images:
        url = img.get("imageUrl", "")
        print(f"Image ID: {img.get('_id')}")
        print(f"  URL: {url}")
        
        # Extract object key from URL
        if "localhost:9002/" in url:
            path = url.split("localhost:9002/")[1]
        elif "localhost:9000/" in url:
            path = url.split("localhost:9000/")[1]
        else:
            print(f"  [ERROR] Unexpected URL format")
            continue
        
        # Remove bucket name if present
        if path.startswith(f"{bucket_name}/"):
            object_key = path[len(bucket_name) + 1:]
        else:
            object_key = path
        
        print(f"  Object Key: {object_key}")
        
        # Check if exists in MinIO
        if object_key in minio_objects:
            print(f"  [OK] Found in MinIO")
        else:
            print(f"  [ERROR] NOT FOUND in MinIO!")
            missing_count += 1
            
            # Try to find similar objects
            similar = [k for k in minio_objects.keys() if object_key.split('/')[-1] in k]
            if similar:
                print(f"  Similar objects found:")
                for s in similar[:3]:
                    print(f"    - {s}")
        print("")
    
    print(f"=== SUMMARY ===")
    print(f"Total images: {len(images)}")
    print(f"Missing in MinIO: {missing_count}")
    print(f"Found in MinIO: {len(images) - missing_count}")

if __name__ == "__main__":
    check_images()

