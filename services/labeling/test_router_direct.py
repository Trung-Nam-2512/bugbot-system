"""
Test router directly to find error location
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from libs.mongodb import init_mongodb_async
from routers.projects_router import router
import uvicorn
import asyncio

app = FastAPI()

@app.on_event("startup")
async def startup():
    await init_mongodb_async()

app.include_router(router, prefix="/api/projects", tags=["projects"])

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler with detailed logging"""
    import traceback
    print(f"[GLOBAL HANDLER] Exception: {type(exc).__name__}: {exc}")
    print(f"[GLOBAL HANDLER] Traceback:")
    traceback.print_exc()
    
    # Check if this is a truth value testing error
    try:
        error_msg = str(exc) if exc else ""
        if "truth value testing" in error_msg or "database is not None" in error_msg:
            return JSONResponse(
                status_code=500,
                content={"detail": "Database operation error"}
            )
    except Exception:
        pass
    
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)

