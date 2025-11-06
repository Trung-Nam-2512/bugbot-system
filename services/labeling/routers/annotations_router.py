"""
Annotations Router
FastAPI router cho annotations management
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
from pydantic import BaseModel

from controllers.annotations_controller import (
    create_annotation,
    get_annotation,
    update_annotation,
    get_project_annotations,
    export_annotations,
    AnnotationCreate,
    AnnotationUpdate,
)

router = APIRouter()

@router.post("/projects/{project_id}/annotations")
async def create_annotation_endpoint(project_id: str, annotation: AnnotationCreate):
    """Create annotation for image"""
    return await create_annotation(project_id, annotation)

@router.get("/annotations/{annotation_id}")
async def get_annotation_endpoint(annotation_id: str):
    """Get annotation by ID"""
    return await get_annotation(annotation_id)

@router.put("/annotations/{annotation_id}")
async def update_annotation_endpoint(annotation_id: str, updates: AnnotationUpdate):
    """Update annotation"""
    return await update_annotation(annotation_id, updates)

@router.get("/projects/{project_id}/annotations")
async def get_project_annotations_endpoint(project_id: str, status: Optional[str] = None):
    """Get all annotations for project"""
    try:
        result = await get_project_annotations(project_id, status)
        return result
    except HTTPException as e:
        raise e
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"detail": "Failed to retrieve annotations"}
        )

@router.get("/projects/{project_id}/export")
async def export_annotations_endpoint(project_id: str, format: str = "coco", split: bool = False):
    """Export annotations in specified format (coco, yolo)"""
    return await export_annotations(project_id, format, split_dataset_flag=split)

