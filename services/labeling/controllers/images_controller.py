"""
Images Controller
API logic cho project images management
"""

from fastapi import HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId

from libs.mongodb import get_database
from utils.logger import setup_logger
from utils.db_safe import db_safe
import asyncio

logger = setup_logger(__name__)

# Pydantic models
class ImageAddRequest(BaseModel):
    imageIds: List[str]
    imageUrls: List[str]
    deviceIds: Optional[List[str]] = None

class ImageStatusUpdate(BaseModel):
    status: str  # pending, annotating, reviewing, completed, rejected
    assignedTo: Optional[str] = None
    reviewedBy: Optional[str] = None

# Controller functions
@db_safe
async def add_images_to_project(project_id: str, request: ImageAddRequest):
    """Add images to labeling project"""
    db = get_database()
    loop = asyncio.get_event_loop()
    project_obj_id = ObjectId(project_id)
    
    # Verify project exists
    project = await loop.run_in_executor(
        None,
        lambda: db.labeling_projects.find_one({"_id": project_obj_id})
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if len(request.imageIds) != len(request.imageUrls):
        raise HTTPException(status_code=400, detail="imageIds and imageUrls must have same length")
    
    # Prepare images
    images = []
    for i, image_id in enumerate(request.imageIds):
        image = {
            "projectId": project_obj_id,
            "imageId": image_id,
            "imageUrl": request.imageUrls[i],
            "deviceId": request.deviceIds[i] if request.deviceIds and i < len(request.deviceIds) else "",
            "status": "pending",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }
        images.append(image)
    
    # Insert images (with upsert to avoid duplicates)
    inserted_count = 0
    for image in images:
        result = await loop.run_in_executor(
            None,
            lambda img=image: db.project_images.update_one(
                {"projectId": project_obj_id, "imageId": img["imageId"]},
                {"$setOnInsert": img},
                upsert=True
            )
        )
        if result.upserted_id:
            inserted_count += 1
    
    # Update project totalImages count
    await loop.run_in_executor(
        None,
        lambda: db.labeling_projects.update_one(
            {"_id": project_obj_id},
            {"$set": {"totalImages": len(images), "updatedAt": datetime.utcnow()}}
        )
    )
    
    logger.info(f"Added {inserted_count} images to project {project_id}")
    return {"ok": True, "added": inserted_count, "total": len(images)}

@db_safe
async def get_project_images(project_id: str, status: Optional[str] = None, limit: int = 50, skip: int = 0):
    """Get images in project"""
    db = get_database()
    loop = asyncio.get_event_loop()
    project_obj_id = ObjectId(project_id)
    
    query = {"projectId": project_obj_id}
    if status:
        query["status"] = status
    
    images = await loop.run_in_executor(
        None,
        lambda: list(db.project_images.find(query).sort("createdAt", -1).skip(skip).limit(limit))
    )
    total = await loop.run_in_executor(
        None,
        lambda: db.project_images.count_documents(query)
    )
    
    # Convert ObjectId to string
    for image in images:
        image["id"] = str(image["_id"])
        image["projectId"] = str(image["projectId"])
        del image["_id"]
    
    return {
        "ok": True,
        "images": images,
        "total": total,
        "limit": limit,
        "skip": skip
    }

@db_safe
async def get_image(image_id: str):
    """Get image by ID"""
    db = get_database()
    loop = asyncio.get_event_loop()
    
    image = await loop.run_in_executor(
        None,
        lambda: db.project_images.find_one({"_id": ObjectId(image_id)})
    )
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    
    image["id"] = str(image["_id"])
    image["projectId"] = str(image["projectId"])
    del image["_id"]
    
    return {"ok": True, "image": image}

@db_safe
async def update_image_status(image_id: str, update: ImageStatusUpdate):
    """Update image annotation status"""
    db = get_database()
    loop = asyncio.get_event_loop()
    image_obj_id = ObjectId(image_id)
    
    valid_statuses = ["pending", "annotating", "reviewing", "completed", "rejected"]
    if update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    update_data = {
        "status": update.status,
        "updatedAt": datetime.utcnow()
    }
    
    if update.assignedTo:
        update_data["assignedTo"] = update.assignedTo
    if update.reviewedBy:
        update_data["reviewedBy"] = update.reviewedBy
    
    result = await loop.run_in_executor(
        None,
        lambda: db.project_images.update_one(
            {"_id": image_obj_id},
            {"$set": update_data}
        )
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Update project stats if status changed to completed
    if update.status == "completed":
        image = await loop.run_in_executor(
            None,
            lambda: db.project_images.find_one({"_id": image_obj_id})
        )
        if image is not None:
            await loop.run_in_executor(
                None,
                lambda: db.labeling_projects.update_one(
                    {"_id": image["projectId"]},
                    {"$inc": {"annotatedImages": 1}, "$set": {"updatedAt": datetime.utcnow()}}
                )
            )
    
    return {"ok": True, "message": "Image status updated"}

@db_safe
async def remove_image_from_project(project_id: str, image_id: str):
    """Remove image from project"""
    db = get_database()
    loop = asyncio.get_event_loop()
    project_obj_id = ObjectId(project_id)
    image_obj_id = ObjectId(image_id)
    
    result = await loop.run_in_executor(
        None,
        lambda: db.project_images.delete_one({
            "_id": image_obj_id,
            "projectId": project_obj_id
        })
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Image not found in project")
    
    # Also delete related annotation
    await loop.run_in_executor(
        None,
        lambda: db.annotations.delete_one({
            "projectId": project_obj_id,
            "imageId": image_id
        })
    )
    
    # Update project count
    await loop.run_in_executor(
        None,
        lambda: db.labeling_projects.update_one(
            {"_id": project_obj_id},
            {"$inc": {"totalImages": -1}, "$set": {"updatedAt": datetime.utcnow()}}
        )
    )
    
    logger.info(f"Removed image {image_id} from project {project_id}")
    return {"ok": True, "message": "Image removed from project"}

