"""
Minimal FastAPI test to isolate issue
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

@app.on_event("startup")
async def startup():
    await init_mongodb_async()

@app.get("/test")
async def test():
    try:
        db = get_database()
        result = await db.labeling_projects.find({}).to_list(length=10)
        return {"ok": True, "count": len(result)}
    except Exception as e:
        # Return JSONResponse directly
        error_type = type(e).__name__
        error_msg = str(e)[:200] if hasattr(e, '__str__') else "Unknown"
        return JSONResponse(
            status_code=500,
            content={"error_type": error_type, "error": error_msg}
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)


