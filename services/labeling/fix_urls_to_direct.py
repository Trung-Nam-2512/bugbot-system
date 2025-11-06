"""
Fix image URLs to use direct URLs (after bucket is public)
"""
from libs.mongodb import init_mongodb, get_database
from bson import ObjectId
from dotenv import load_dotenv
import os

load_dotenv()

def fix_urls_to_direct(project_id: str):
    """Change presigned URLs back to direct URLs"""
    init_mongodb()
    
    db = get_database()
    project_obj_id = ObjectId(project_id)
    
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
        
        # Extract object path from any URL format
        # Handle presigned URLs: http://localhost:9002/iot-raw/path?X-Amz-...
        # Handle direct URLs: http://localhost:9002/iot-raw/path
        
        if "localhost:9002/" in old_url:
            # Extract path before query params
            path_part = old_url.split("localhost:9002/")[1].split("?")[0].split("%3F")[0]
        elif "localhost:9000/" in old_url:
            path_part = old_url.split("localhost:9000/")[1].split("?")[0].split("%3F")[0]
        else:
            print(f"Skipping URL (unexpected format): {old_url[:80]}...")
            continue
        
        # Create direct URL (bucket should be public now)
        new_url = f"http://localhost:9002/{path_part}"
        
        result = db.project_images.update_one(
            {"_id": img["_id"]},
            {"$set": {"imageUrl": new_url}}
        )
        
        if result.modified_count > 0:
            updated_count += 1
            print(f"Updated to direct URL: {new_url}")
    
    print("")
    print(f"Fixed {updated_count} image URLs to direct URLs")
    print("")
    print("Note: Make sure bucket is public (run make_bucket_public.py)")

if __name__ == "__main__":
    project_id = "690b312bb853bd59591d5bb2"
    print("=== FIXING URLs TO DIRECT URLs ===")
    print(f"Project ID: {project_id}")
    print("")
    fix_urls_to_direct(project_id)

