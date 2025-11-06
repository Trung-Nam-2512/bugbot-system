"""
Fix image URLs in database: Change port 9000 to 9002
"""
import sys
from libs.mongodb import init_mongodb, get_database
from bson import ObjectId

def fix_image_urls(project_id: str):
    """Fix image URLs from port 9000 to 9002"""
    db = get_database()
    project_obj_id = ObjectId(project_id)
    
    # Find all images with port 9000
    images = list(db.project_images.find({
        "projectId": project_obj_id,
        "imageUrl": {"$regex": "localhost:9000"}
    }))
    
    print(f"Found {len(images)} images with port 9000")
    print("")
    
    if not images:
        print("No images to fix!")
        return
    
    # Show current URLs
    print("Current URLs:")
    for img in images:
        print(f"  - {img.get('imageUrl', 'N/A')}")
    print("")
    
    # Update URLs
    updated_count = 0
    for img in images:
        old_url = img.get("imageUrl", "")
        new_url = old_url.replace("localhost:9000", "localhost:9002")
        
        result = db.project_images.update_one(
            {"_id": img["_id"]},
            {"$set": {"imageUrl": new_url}}
        )
        
        if result.modified_count > 0:
            updated_count += 1
            print(f"Updated: {old_url} -> {new_url}")
    
    print("")
    print(f"Fixed {updated_count} image URLs")

if __name__ == "__main__":
    # Initialize MongoDB
    init_mongodb()
    
    project_id = "690b312bb853bd59591d5bb2"
    print("=== FIXING IMAGE URLs ===")
    print(f"Project ID: {project_id}")
    print("")
    fix_image_urls(project_id)

