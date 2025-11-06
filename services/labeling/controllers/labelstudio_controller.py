"""
Label Studio Integration Controller
Handles synchronization between internal system and Label Studio
"""

import asyncio
from typing import List, Optional, Dict, Any
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from bson import ObjectId

from libs.mongodb import get_database
from libs.labelstudio_client import (
    sync_project_to_labelstudio,
    sync_annotations_from_labelstudio,
    get_project as get_ls_project,
    list_projects as list_ls_projects,
    get_is_connected
)
from utils.db_safe import db_safe
from utils.logger import setup_logger

logger = setup_logger(__name__)

@db_safe
async def sync_project_to_labelstudio_endpoint(
    project_id: str,
    sync_images: bool = True
) -> Dict:
    """
    Sync internal project to Label Studio
    
    Args:
        project_id: Internal MongoDB project ID
        sync_images: Whether to sync images to Label Studio
    
    Returns:
        Sync result
    """
    if not get_is_connected():
        return JSONResponse(
            status_code=503,
            content={"detail": "Label Studio not connected. Please configure LABELSTUDIO_URL and LABELSTUDIO_API_TOKEN"}
        )
    
    try:
        import asyncio
        db = get_database()
        loop = asyncio.get_event_loop()
        
        # Get project from database
        project = await loop.run_in_executor(
            None,
            lambda: db.labeling_projects.find_one({"_id": ObjectId(project_id)})
        )
        
        if project is None:
            return JSONResponse(
                status_code=404,
                content={"detail": "Project not found"}
            )
        
        # Get images if sync_images is True
        images = []
        if sync_images:
            images_raw = await loop.run_in_executor(
                None,
                lambda: list(db.project_images.find({
                    "projectId": ObjectId(project_id)
                }).limit(1000))
            )
            
            for img in images_raw:
                images.append({
                    "imageUrl": img.get("imageUrl", ""),
                    "width": img.get("width", 640),
                    "height": img.get("height", 480)
                })
        
        # Sync to Label Studio
        result = await loop.run_in_executor(
            None,
            lambda: sync_project_to_labelstudio(
                internal_project_id=project_id,
                project_name=project.get("name", ""),
                project_description=project.get("description", ""),
                images=images,
                class_names=project.get("classNames", ["object"])
            )
        )
        
        # Update project with Label Studio project ID
        ls_project_id = result.get("labelStudioProjectId")
        if ls_project_id:
            await loop.run_in_executor(
                None,
                lambda: db.labeling_projects.update_one(
                    {"_id": ObjectId(project_id)},
                    {"$set": {"labelStudioProjectId": ls_project_id}}
                )
            )
        
        return {"ok": True, "result": result}
        
    except Exception as e:
        logger.error(f"Failed to sync project to Label Studio: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to sync project: {str(e)}"}
        )

@db_safe
async def sync_annotations_from_labelstudio_endpoint(
    project_id: str
) -> Dict:
    """
    Sync annotations from Label Studio back to internal system
    
    Args:
        project_id: Internal MongoDB project ID
    
    Returns:
        Sync result
    """
    if not get_is_connected():
        return JSONResponse(
            status_code=503,
            content={"detail": "Label Studio not connected"}
        )
    
    try:
        import asyncio
        db = get_database()
        loop = asyncio.get_event_loop()
        
        # Get project
        project = await loop.run_in_executor(
            None,
            lambda: db.labeling_projects.find_one({"_id": ObjectId(project_id)})
        )
        
        if project is None:
            return JSONResponse(
                status_code=404,
                content={"detail": "Project not found"}
            )
        
        ls_project_id = project.get("labelStudioProjectId")
        if not ls_project_id:
            return JSONResponse(
                status_code=400,
                content={"detail": "Project not synced to Label Studio. Please sync project first."}
            )
        
        # Sync annotations from Label Studio
        annotations = await loop.run_in_executor(
            None,
            lambda: sync_annotations_from_labelstudio(
                project_id=ls_project_id,
                internal_project_id=project_id
            )
        )
        
        # Save annotations to database
        synced_count = 0
        for ann in annotations:
            # Check if annotation already exists
            existing = await loop.run_in_executor(
                None,
                lambda img_id=ann.get("imageId"): db.annotations.find_one({
                    "projectId": ObjectId(project_id),
                    "imageId": str(img_id)
                })
            )
            
            if existing is None:
                # Create new annotation
                annotation_data = {
                    "projectId": ObjectId(project_id),
                    "imageId": str(ann.get("imageId", "")),
                    "imageUrl": ann.get("imageUrl", ""),
                    "annotationData": {
                        "bbox": ann.get("bbox", []),
                        "class": ann.get("class", ""),
                        "category": ann.get("class", "")
                    },
                    "status": ann.get("status", "submitted"),
                    "source": "labelstudio",
                    "createdAt": None,  # Will be set by MongoDB default
                    "updatedAt": None
                }
                
                await loop.run_in_executor(
                    None,
                    lambda data=annotation_data: db.annotations.insert_one(data)
                )
                synced_count += 1
            else:
                # Update existing annotation
                await loop.run_in_executor(
                    None,
                    lambda img_id=ann.get("imageId"): db.annotations.update_one(
                        {
                            "projectId": ObjectId(project_id),
                            "imageId": str(img_id)
                        },
                        {
                            "$set": {
                                "annotationData": {
                                    "bbox": ann.get("bbox", []),
                                    "class": ann.get("class", ""),
                                    "category": ann.get("class", "")
                                },
                                "status": ann.get("status", "submitted"),
                                "source": "labelstudio",
                                "updatedAt": None
                            }
                        }
                    )
                )
                synced_count += 1
        
        return {
            "ok": True,
            "syncedCount": synced_count,
            "totalAnnotations": len(annotations),
            "message": f"Synced {synced_count} annotations from Label Studio"
        }
        
    except Exception as e:
        logger.error(f"Failed to sync annotations from Label Studio: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to sync annotations: {str(e)}"}
        )

@db_safe
async def get_labelstudio_projects() -> Dict:
    """Get list of projects from Label Studio"""
    if not get_is_connected():
        return JSONResponse(
            status_code=503,
            content={"detail": "Label Studio not connected"}
        )
    
    try:
        loop = asyncio.get_event_loop()
        projects = await loop.run_in_executor(
            None,
            lambda: list_ls_projects()
        )
        
        return {"ok": True, "projects": projects}
        
    except Exception as e:
        logger.error(f"Failed to get Label Studio projects: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to get projects: {str(e)}"}
        )

@db_safe
async def get_labelstudio_project_status(project_id: str) -> Dict:
    """Get Label Studio project status for internal project"""
    try:
        import asyncio
        db = get_database()
        loop = asyncio.get_event_loop()
        
        # Get internal project
        project = await loop.run_in_executor(
            None,
            lambda: db.labeling_projects.find_one({"_id": ObjectId(project_id)})
        )
        
        if project is None:
            return JSONResponse(
                status_code=404,
                content={"detail": "Project not found"}
            )
        
        ls_project_id = project.get("labelStudioProjectId")
        if not ls_project_id:
            return {
                "ok": True,
                "synced": False,
                "message": "Project not synced to Label Studio"
            }
        
        if not get_is_connected():
            return {
                "ok": True,
                "synced": True,
                "labelStudioProjectId": ls_project_id,
                "connected": False,
                "message": "Label Studio not connected"
            }
        
        # Get Label Studio project details
        try:
            ls_project = await loop.run_in_executor(
                None,
                lambda: get_ls_project(ls_project_id)
            )
            
            return {
                "ok": True,
                "synced": True,
                "labelStudioProjectId": ls_project_id,
                "connected": True,
                "labelStudioProject": ls_project
            }
        except Exception as e:
            return {
                "ok": True,
                "synced": True,
                "labelStudioProjectId": ls_project_id,
                "connected": True,
                "error": str(e)
            }
        
    except Exception as e:
        logger.error(f"Failed to get Label Studio project status: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to get status: {str(e)}"}
        )

