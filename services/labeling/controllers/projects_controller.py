"""
Projects Controller
API endpoints cho labeling project management
"""

from fastapi import HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId

from libs.mongodb import get_database
from utils.logger import setup_logger
from utils.db_safe import db_safe

logger = setup_logger(__name__)

# Pydantic models
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    annotationType: str = "object_detection"  # object_detection, classification, segmentation
    classNames: List[str] = []

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    classNames: Optional[List[str]] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    annotationType: str
    classNames: List[str]
    totalImages: int
    annotatedImages: int
    reviewedImages: int
    createdAt: datetime
    updatedAt: datetime

# Controller functions
@db_safe
async def create_project(project_data: ProjectCreate, created_by: str = "system"):
    """Create new labeling project"""
    import asyncio
    db = get_database()
    loop = asyncio.get_event_loop()
    
    # Check if project name exists
    existing = await loop.run_in_executor(
        None,
        lambda: db.labeling_projects.find_one({"name": project_data.name})
    )
    if existing is not None:
        # Return JSONResponse directly instead of raising HTTPException
        # This avoids FastAPI serializing exception that might contain database objects
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=400,
            content={"detail": "Project name already exists"}
        )
    
    project = {
        "name": project_data.name,
        "description": project_data.description,
        "status": "draft",
        "annotationType": project_data.annotationType,
        "classNames": project_data.classNames,
        "totalImages": 0,
        "annotatedImages": 0,
        "reviewedImages": 0,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "createdBy": created_by,
    }
    
    result = await loop.run_in_executor(
        None,
        lambda: db.labeling_projects.insert_one(project)
    )
    project["_id"] = result.inserted_id
    
    # Convert ObjectId to string for JSON serialization
    project["id"] = str(project["_id"])
    del project["_id"]
    
    # Logger removed to avoid potential database object serialization
    # logger.info("Created labeling project", extra={"project_name": project_data.name})
    return {"ok": True, "project": project}

@db_safe
async def get_projects(status: Optional[str] = None):
    """Get all labeling projects"""
    import asyncio
    from fastapi.encoders import jsonable_encoder
    from fastapi.responses import JSONResponse
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    
    # Run sync operation in thread pool to avoid blocking
    loop = asyncio.get_event_loop()
    projects = await loop.run_in_executor(
        None,
        lambda: list(db.labeling_projects.find(query).sort("createdAt", -1).limit(100))
    )
    
    # Convert ObjectId to string
    for project in projects:
        project["id"] = str(project["_id"])
        del project["_id"]
    
    payload = {"ok": True, "projects": projects, "count": len(projects)}
    # Force safe encoding to avoid any non-serializable object sneaking in
    return JSONResponse(content=jsonable_encoder(payload))

@db_safe
async def get_project(project_id: str):
    """Get project by ID"""
    import asyncio
    db = get_database()
    loop = asyncio.get_event_loop()
    project = await loop.run_in_executor(
        None,
        lambda: db.labeling_projects.find_one({"_id": ObjectId(project_id)})
    )
    if project is None:
        # Return JSONResponse directly instead of raising HTTPException
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=404,
            content={"detail": "Project not found"}
        )
    
    project["id"] = str(project["_id"])
    del project["_id"]
    
    return {"ok": True, "project": project}

@db_safe
async def update_project(project_id: str, updates: ProjectUpdate):
    """Update project"""
    import asyncio
    db = get_database()
    loop = asyncio.get_event_loop()
    
    update_data = {"updatedAt": datetime.utcnow()}
    if updates.name:
        update_data["name"] = updates.name
    if updates.description is not None:
        update_data["description"] = updates.description
    if updates.status:
        update_data["status"] = updates.status
    if updates.classNames:
        update_data["classNames"] = updates.classNames
    
    result = await loop.run_in_executor(
        None,
        lambda: db.labeling_projects.update_one(
            {"_id": ObjectId(project_id)},
            {"$set": update_data}
        )
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"ok": True, "message": "Project updated"}

@db_safe
async def delete_project(project_id: str):
    """Delete project"""
    import asyncio
    db = get_database()
    loop = asyncio.get_event_loop()
    project_obj_id = ObjectId(project_id)
    
    result = await loop.run_in_executor(
        None,
        lambda: db.labeling_projects.delete_one({"_id": project_obj_id})
    )
    if result.deleted_count == 0:
        # Return JSONResponse directly instead of raising HTTPException
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=404,
            content={"detail": "Project not found"}
        )
    
    # Also delete related images and annotations
    await loop.run_in_executor(
        None,
        lambda: db.project_images.delete_many({"projectId": project_obj_id})
    )
    await loop.run_in_executor(
        None,
        lambda: db.annotations.delete_many({"projectId": project_obj_id})
    )
    
    logger.info(f"Deleted project: {project_id}")
    return {"ok": True, "message": "Project deleted"}

