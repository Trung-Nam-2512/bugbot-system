"""
Test server with detailed logging to find exact error location
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from libs.mongodb import init_mongodb_async, get_database
from controllers.projects_controller import get_projects
import uvicorn
import asyncio

app = FastAPI()

@app.on_event("startup")
async def startup():
    await init_mongodb_async()

@app.get("/test")
async def test():
    """Test endpoint with detailed error handling"""
    try:
        print("[DEBUG] Starting get_projects()...")
        result = await get_projects()
        print(f"[DEBUG] get_projects() returned: {type(result)}")
        print(f"[DEBUG] Result: {result}")
        return result
    except NotImplementedError as e:
        print(f"[DEBUG] NotImplementedError caught: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": "Database operation error (NotImplementedError)"}
        )
    except TypeError as e:
        print(f"[DEBUG] TypeError caught: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": "Database operation error (TypeError)"}
        )
    except Exception as e:
        print(f"[DEBUG] Exception caught: {type(e).__name__}: {e}")
        error_msg = str(e) if e else ""
        print(f"[DEBUG] Error message: {error_msg}")
        if "truth value testing" in error_msg or "database is not None" in error_msg:
            print("[DEBUG] Detected truth value testing error")
            return JSONResponse(
                status_code=500,
                content={"detail": "Database operation error"}
            )
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal error: {type(e).__name__}"}
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)

