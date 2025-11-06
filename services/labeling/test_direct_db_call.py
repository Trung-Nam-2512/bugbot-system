"""
Test direct database call without FastAPI
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from libs.mongodb import init_mongodb_async, get_database

async def test():
    print("[TEST] Testing direct database call...")
    try:
        await init_mongodb_async()
        db = get_database()
        print(f"[OK] Got database: {type(db)}")
        
        # Try to query
        result = await db.labeling_projects.find_one({"name": "test"})
        print(f"[OK] Query successful: {result is None}")
        
        # Try to list
        projects = await db.labeling_projects.find({}).to_list(length=10)
        print(f"[OK] List successful: {len(projects)} projects")
        
        return True
    except Exception as e:
        print(f"[FAIL] Error: {type(e).__name__}: {str(e)[:300]}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test())
    sys.exit(0 if result else 1)


