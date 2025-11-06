"""
Direct test of database operations to isolate the issue
"""

import asyncio
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from libs.mongodb import init_mongodb_async, get_database

async def test_database_operations():
    """Test database operations directly"""
    print("[TEST] Testing database operations directly...")
    
    try:
        print("[1] Initializing MongoDB...")
        await init_mongodb_async()
        print("    [OK] MongoDB connected")
        
        print("[2] Getting database...")
        db = get_database()
        print(f"    [OK] Got database: {type(db)}")
        print(f"    Database is None: {db is None}")
        
        # Try to access database attribute
        print("[3] Testing database access...")
        try:
            # Try to get a collection
            collection = db.labeling_projects
            print(f"    [OK] Got collection: {type(collection)}")
            
            # Try to find one (this might trigger the issue)
            print("[4] Testing find_one operation...")
            result = await db.labeling_projects.find_one({"name": "test"})
            print(f"    [OK] find_one worked: {result is None}")
            
            print("\n[SUCCESS] All database operations worked!")
            return True
            
        except Exception as e:
            print(f"    [FAIL] Error accessing database: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return False
            
    except Exception as e:
        print(f"[FAIL] Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test_database_operations())
    sys.exit(0 if result else 1)


