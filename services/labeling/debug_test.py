"""
Debug script to test database connection and identify the truth value issue
"""

import asyncio
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from libs.mongodb import init_mongodb_async, get_database

async def test_database():
    """Test database operations"""
    try:
        print("1. Initializing MongoDB...")
        await init_mongodb_async()
        print("   [OK] MongoDB initialized")
        
        print("2. Getting database...")
        db = get_database()
        print(f"   ✅ Got database: {type(db)}")
        
        print("3. Testing query...")
        result = await db.labeling_projects.find_one({"name": "test"})
        print(f"   ✅ Query result: {result}")
        
        print("4. Testing insert...")
        test_project = {
            "name": f"Debug Test {int(asyncio.get_event_loop().time())}",
            "description": "Test",
            "status": "draft",
            "annotationType": "object_detection",
            "classNames": ["insect"],
            "totalImages": 0,
            "annotatedImages": 0,
            "reviewedImages": 0,
            "createdAt": __import__('datetime').datetime.utcnow(),
            "updatedAt": __import__('datetime').datetime.utcnow(),
            "createdBy": "debug",
        }
        insert_result = await db.labeling_projects.insert_one(test_project)
        print(f"   ✅ Insert result: {insert_result.inserted_id}")
        
        print("5. Testing delete...")
        delete_result = await db.labeling_projects.delete_one({"_id": insert_result.inserted_id})
        print(f"   ✅ Delete result: {delete_result.deleted_count}")
        
        print("\n✅ All database operations successful!")
        return True
        
    except Exception as e:
        print(f"\n[ERROR] Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_database())
    sys.exit(0 if success else 1)

