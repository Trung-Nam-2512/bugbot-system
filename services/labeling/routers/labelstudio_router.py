"""
Label Studio Integration Router
FastAPI router cho Label Studio integration
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import Optional

from controllers.labelstudio_controller import (
    sync_project_to_labelstudio_endpoint,
    sync_annotations_from_labelstudio_endpoint,
    get_labelstudio_projects,
    get_labelstudio_project_status
)

router = APIRouter(prefix="/api/labelstudio", tags=["Label Studio"])

@router.post("/projects/{project_id}/sync")
async def sync_project_endpoint(
    project_id: str,
    sync_images: bool = Query(True, description="Whether to sync images to Label Studio")
):
    """
    Sync internal project to Label Studio
    
    - **project_id**: Internal MongoDB project ID
    - **sync_images**: Whether to sync images to Label Studio
    """
    try:
        result = await sync_project_to_labelstudio_endpoint(project_id, sync_images)
        if isinstance(result, JSONResponse):
            return result
        return result
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to sync project: {str(e)}"}
        )

@router.post("/projects/{project_id}/sync-annotations")
async def sync_annotations_endpoint(project_id: str):
    """
    Sync annotations from Label Studio back to internal system
    
    - **project_id**: Internal MongoDB project ID
    """
    try:
        result = await sync_annotations_from_labelstudio_endpoint(project_id)
        if isinstance(result, JSONResponse):
            return result
        return result
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to sync annotations: {str(e)}"}
        )

@router.get("/projects/{project_id}/status")
async def get_project_status_endpoint(project_id: str):
    """
    Get Label Studio project status for internal project
    
    - **project_id**: Internal MongoDB project ID
    """
    try:
        result = await get_labelstudio_project_status(project_id)
        if isinstance(result, JSONResponse):
            return result
        return result
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to get status: {str(e)}"}
        )

@router.get("/projects")
async def list_labelstudio_projects_endpoint():
    """Get list of projects from Label Studio"""
    try:
        result = await get_labelstudio_projects()
        if isinstance(result, JSONResponse):
            return result
        return result
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to get projects: {str(e)}"}
        )

