"""
Minimal test endpoint to isolate the issue
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from libs.mongodb import init_mongodb_async, get_database
import uvicorn

app = FastAPI()

@app.get("/test")
async def test_endpoint():
    """Minimal test endpoint"""
    try:
        db = get_database()
        # Try to access collection
        result = await db.labeling_projects.find_one({"name": "test"})
        return {"ok": True, "result": result is not None}
    except Exception as e:
        # Return error directly without FastAPI serialization
        error_type = type(e).__name__
        error_msg = str(e)[:200] if hasattr(e, '__str__') else "Unknown error"
        return JSONResponse(
            status_code=500,
            content={"error_type": error_type, "error": error_msg}
        )

async def startup():
    await init_mongodb_async()

@app.on_event("startup")
async def startup_event():
    await startup()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)


