"""
Debug script to find exact location of truth value testing error
"""

import asyncio
import sys
import os
import traceback

sys.path.insert(0, os.path.dirname(__file__))

from libs.mongodb import init_mongodb_async, get_database
from controllers.projects_controller import get_projects, get_project

async def test_debug():
    """Test with full stack trace"""
    print("[1] Initializing MongoDB...")
    try:
        await init_mongodb_async()
        print("    [OK] MongoDB initialized")
    except Exception as e:
        print(f"    [FAIL] {e}")
        traceback.print_exc()
        return
    
    print("[2] Testing get_database()...")
    try:
        db = get_database()
        print(f"    [OK] Got database: {type(db)}")
    except Exception as e:
        print(f"    [FAIL] {e}")
        traceback.print_exc()
        return
    
    print("[3] Testing get_projects() directly...")
    try:
        result = await get_projects()
        print(f"    [OK] get_projects() returned: {type(result)}")
        print(f"    Result keys: {result.keys() if isinstance(result, dict) else 'N/A'}")
        # Try to serialize result
        import json
        json_result = json.dumps(result, default=str)
        print(f"    [OK] JSON serialization successful")
    except Exception as e:
        print(f"    [FAIL] {e}")
        print(f"    Exception type: {type(e).__name__}")
        traceback.print_exc()
        return
    
    print("[4] Testing with FastAPI endpoint simulation...")
    try:
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        
        app = FastAPI()
        
        @app.get("/test")
        async def test_endpoint():
            return await get_projects()
        
        client = TestClient(app)
        response = client.get("/test")
        print(f"    [OK] FastAPI response status: {response.status_code}")
        if response.status_code == 200:
            print(f"    [OK] Response: {response.json()}")
        else:
            print(f"    [FAIL] Response: {response.text[:500]}")
    except Exception as e:
        print(f"    [FAIL] {e}")
        print(f"    Exception type: {type(e).__name__}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_debug())

