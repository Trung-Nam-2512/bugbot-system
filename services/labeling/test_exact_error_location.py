"""
Find exact location where truth value testing error occurs
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import logging
logging.basicConfig(level=logging.DEBUG)

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from libs.mongodb import init_mongodb_async, get_database
from controllers.projects_controller import get_projects
import uvicorn
import traceback

app = FastAPI()

@app.on_event("startup")
async def startup():
    await init_mongodb_async()

@app.middleware("http")
async def catch_all_middleware(request: Request, call_next):
    """Middleware to catch all exceptions before FastAPI processes them"""
    try:
        response = await call_next(request)
        return response
    except NotImplementedError as e:
        print(f"[MIDDLEWARE] Caught NotImplementedError: {type(e).__name__}")
        # Don't access exception attributes - just return error
        return JSONResponse(
            status_code=500,
            content={"detail": "Database operation error (middleware)"}
        )
    except Exception as e:
        print(f"[MIDDLEWARE] Caught Exception: {type(e).__name__}")
        exc_type = type(e).__name__
        if exc_type == "NotImplementedError":
            return JSONResponse(
                status_code=500,
                content={"detail": "Database operation error (middleware)"}
            )
        # Re-raise to let FastAPI handle it
        raise

@app.get("/test")
async def test():
    """Test endpoint"""
    print("[ENDPOINT] Starting...")
    try:
        print("[ENDPOINT] Calling get_projects()...")
        result = await get_projects()
        print(f"[ENDPOINT] get_projects() returned successfully")
        return result
    except NotImplementedError as e:
        print(f"[ENDPOINT] Caught NotImplementedError")
        return JSONResponse(
            status_code=500,
            content={"detail": "Database operation error (endpoint)"}
        )
    except Exception as e:
        print(f"[ENDPOINT] Caught Exception: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        exc_type = type(e).__name__
        if exc_type == "NotImplementedError":
            return JSONResponse(
                status_code=500,
                content={"detail": "Database operation error (endpoint)"}
            )
        raise

@app.exception_handler(Exception)
async def global_handler(request, exc):
    """Global exception handler"""
    print(f"[GLOBAL HANDLER] Exception: {type(exc).__name__}")
    exc_type = type(exc).__name__
    if exc_type == "NotImplementedError":
        return JSONResponse(
            status_code=500,
            content={"detail": "Database operation error (global)"}
        )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8004, log_level="debug")

