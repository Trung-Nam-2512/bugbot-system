"""
Images Router
FastAPI router cho project images management
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import Optional, List
from pydantic import BaseModel

from controllers.images_controller import (
    add_images_to_project,
    get_project_images,
    get_image,
    update_image_status,
    remove_image_from_project,
    ImageAddRequest,
    ImageStatusUpdate,
)

router = APIRouter()

@router.post("/projects/{project_id}/images")
async def add_images_endpoint(project_id: str, request: ImageAddRequest):
    """Add images to project"""
    return await add_images_to_project(project_id, request)

@router.get("/projects/{project_id}/images")
async def get_images_endpoint(
    project_id: str,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0)
):
    """Get images in project"""
    try:
        result = await get_project_images(project_id, status, limit, skip)
        return result
    except HTTPException as e:
        raise e
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"detail": "Failed to retrieve images"}
        )

@router.get("/images/{image_id}")
async def get_image_endpoint(image_id: str):
    """Get image details"""
    return await get_image(image_id)

@router.put("/images/{image_id}/status")
async def update_image_status_endpoint(image_id: str, update: ImageStatusUpdate):
    """Update image annotation status"""
    return await update_image_status(image_id, update)

@router.delete("/projects/{project_id}/images/{image_id}")
async def remove_image_endpoint(project_id: str, image_id: str):
    """Remove image from project"""
    return await remove_image_from_project(project_id, image_id)

