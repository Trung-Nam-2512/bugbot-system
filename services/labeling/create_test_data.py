"""
Script to create test data directly in MongoDB
This bypasses the POST endpoint issue and allows testing GET endpoints
"""

import asyncio
import sys
import os
from datetime import datetime
from bson import ObjectId

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from libs.mongodb import init_mongodb_async, get_database

async def create_test_project():
    """Create test project directly in MongoDB"""
    try:
        print("[1] Initializing MongoDB...")
        await init_mongodb_async()
        print("    [OK] MongoDB connected")
        
        print("[2] Getting database...")
        db = get_database()
        print(f"    [OK] Got database: {type(db)}")
        
        print("[3] Creating test project...")
        test_project = {
            "name": f"Test Project {int(datetime.utcnow().timestamp())}",
            "description": "Test project created directly in MongoDB",
            "status": "active",
            "annotationType": "object_detection",
            "classNames": ["insect", "bird", "animal"],
            "totalImages": 0,
            "annotatedImages": 0,
            "reviewedImages": 0,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
            "createdBy": "test-script",
        }
        
        result = await db.labeling_projects.insert_one(test_project)
        project_id = str(result.inserted_id)
        print(f"    [OK] Project created: {project_id}")
        print(f"        Name: {test_project['name']}")
        
        return project_id
        
    except Exception as e:
        print(f"    [FAIL] Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    project_id = asyncio.run(create_test_project())
    if project_id:
        print(f"\n[SUCCESS] Test project created: {project_id}")
        print(f"\nYou can now test GET endpoints with this project ID")
        sys.exit(0)
    else:
        print("\n[FAILED] Could not create test project")
        sys.exit(1)


