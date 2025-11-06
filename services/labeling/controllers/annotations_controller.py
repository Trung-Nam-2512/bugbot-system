"""
Annotations Controller
API logic cho annotations management
"""

from fastapi import HTTPException
from typing import Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId
import json

from libs.mongodb import get_database
from utils.logger import setup_logger
from utils.export_formats import export_coco_format, export_yolo_format, split_dataset
from utils.db_safe import db_safe
import asyncio

logger = setup_logger(__name__)

# Pydantic models
class AnnotationCreate(BaseModel):
    imageId: str
    annotationData: Dict[str, Any]
    annotationFormat: str = "coco"  # coco, yolo, pascal_voc, custom
    annotatedBy: Optional[str] = None

class AnnotationUpdate(BaseModel):
    annotationData: Optional[Dict[str, Any]] = None
    status: Optional[str] = None  # draft, submitted, approved, rejected
    reviewedBy: Optional[str] = None

# Controller functions
@db_safe
async def create_annotation(project_id: str, annotation: AnnotationCreate):
    """Create annotation for image"""
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
    
    # Verify image exists in project
    image = await loop.run_in_executor(
        None,
        lambda: db.project_images.find_one({
            "projectId": project_obj_id,
            "imageId": annotation.imageId
        })
    )
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found in project")
    
    # Check if annotation already exists
    existing = await loop.run_in_executor(
        None,
        lambda: db.annotations.find_one({
            "projectId": project_obj_id,
            "imageId": annotation.imageId
        })
    )
    
    if existing is not None:
        raise HTTPException(status_code=400, detail="Annotation already exists for this image")
    
    # Create annotation
    annotation_doc = {
        "projectId": project_obj_id,
        "imageId": annotation.imageId,
        "annotationData": annotation.annotationData,
        "annotationFormat": annotation.annotationFormat,
        "status": "draft",
        "annotatedBy": annotation.annotatedBy or "system",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    
    result = await loop.run_in_executor(
        None,
        lambda: db.annotations.insert_one(annotation_doc)
    )
    annotation_doc["_id"] = result.inserted_id
    
    # Update image status
    await loop.run_in_executor(
        None,
        lambda: db.project_images.update_one(
            {"_id": image["_id"]},
            {"$set": {"status": "annotating", "updatedAt": datetime.utcnow()}}
        )
    )
    
    annotation_doc["id"] = str(annotation_doc["_id"])
    annotation_doc["projectId"] = str(annotation_doc["projectId"])
    del annotation_doc["_id"]
    
    logger.info(f"Created annotation for image {annotation.imageId} in project {project_id}")
    return {"ok": True, "annotation": annotation_doc}

@db_safe
async def get_annotation(annotation_id: str):
    """Get annotation by ID"""
    db = get_database()
    loop = asyncio.get_event_loop()
    
    annotation = await loop.run_in_executor(
        None,
        lambda: db.annotations.find_one({"_id": ObjectId(annotation_id)})
    )
    if annotation is None:
        raise HTTPException(status_code=404, detail="Annotation not found")
    
    annotation["id"] = str(annotation["_id"])
    annotation["projectId"] = str(annotation["projectId"])
    del annotation["_id"]
    
    return {"ok": True, "annotation": annotation}

async def update_annotation(annotation_id: str, updates: AnnotationUpdate):
    """Update annotation"""
    try:
        import asyncio
        db = get_database()
        loop = asyncio.get_event_loop()
        
        update_data = {"updatedAt": datetime.utcnow()}
        
        if updates.annotationData:
            update_data["annotationData"] = updates.annotationData
        if updates.status:
            valid_statuses = ["draft", "submitted", "approved", "rejected"]
            if updates.status not in valid_statuses:
                raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
            update_data["status"] = updates.status
        if updates.reviewedBy:
            update_data["reviewedBy"] = updates.reviewedBy
        
        result = await loop.run_in_executor(
            None,
            lambda: db.annotations.update_one(
                {"_id": ObjectId(annotation_id)},
                {"$set": update_data}
            )
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Annotation not found")
        
        # Update image status if annotation approved
        if updates.status == "approved":
            annotation = await loop.run_in_executor(
                None,
                lambda: db.annotations.find_one({"_id": ObjectId(annotation_id)})
            )
            if annotation is not None:
                await loop.run_in_executor(
                    None,
                    lambda: db.project_images.update_one(
                        {"projectId": annotation["projectId"], "imageId": annotation["imageId"]},
                        {"$set": {"status": "completed", "updatedAt": datetime.utcnow()}}
                    )
                )
                await loop.run_in_executor(
                    None,
                    lambda: db.labeling_projects.update_one(
                        {"_id": annotation["projectId"]},
                        {"$inc": {"reviewedImages": 1}, "$set": {"updatedAt": datetime.utcnow()}}
                    )
                )
        
        return {"ok": True, "message": "Annotation updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update annotation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@db_safe
async def get_project_annotations(project_id: str, status: Optional[str] = None):
    """Get all annotations for project"""
    db = get_database()
    loop = asyncio.get_event_loop()
    query = {"projectId": ObjectId(project_id)}
    if status:
        query["status"] = status
    
    annotations = await loop.run_in_executor(
        None,
        lambda: list(db.annotations.find(query).sort("createdAt", -1).limit(1000))
    )
    
    # Convert ObjectId to string
    for ann in annotations:
        ann["id"] = str(ann["_id"])
        ann["projectId"] = str(ann["projectId"])
        del ann["_id"]
    
    return {"ok": True, "annotations": annotations, "count": len(annotations)}

async def export_annotations(project_id: str, format: str = "coco", split_dataset_flag: bool = False):
    """Export annotations in specified format"""
    try:
        import asyncio
        db = get_database()
        loop = asyncio.get_event_loop()
        
        # Verify project exists
        project = await loop.run_in_executor(
            None,
            lambda: db.labeling_projects.find_one({"_id": ObjectId(project_id)})
        )
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get all images in project
        images = await loop.run_in_executor(
            None,
            lambda: list(db.project_images.find({
                "projectId": ObjectId(project_id)
            }).limit(10000))
        )
        
        # Get all annotations
        annotations_raw = await loop.run_in_executor(
            None,
            lambda: list(db.annotations.find({
                "projectId": ObjectId(project_id),
                "status": {"$in": ["approved", "submitted"]}
            }).limit(10000))
        )
        
        # Convert annotations to format expected by export functions
        annotations = []
        for ann in annotations_raw:
            # Extract bbox from annotationData
            ann_data = ann.get("annotationData", {})
            bbox = ann_data.get("bbox", [])
            
            annotations.append({
                "imageId": ann.get("imageId", ""),
                "imageUrl": ann.get("imageUrl", ""),
                "bbox": bbox,
                "class": ann_data.get("class", ""),
                "category": ann_data.get("category", ""),
                "annotationData": ann_data
            })
        
        # Convert images to format expected by export functions
        images_formatted = []
        for img in images:
            images_formatted.append({
                "id": str(img.get("_id", "")),
                "imageUrl": img.get("imageUrl", ""),
                "width": img.get("width", 640),
                "height": img.get("height", 480),
                "createdAt": img.get("createdAt", datetime.utcnow()).isoformat() if isinstance(img.get("createdAt"), datetime) else str(img.get("createdAt", ""))
            })
        
        categories = project.get("classNames", [])
        if not categories:
            categories = ["object"]  # Default category
        
        if format.lower() == "coco":
            # Use COCO export utility
            coco_data = export_coco_format(
                images=images_formatted,
                annotations=annotations,
                categories=categories,
                info={
                    "description": project.get("description", "IoT Camera Dataset"),
                    "version": "1.0",
                    "year": datetime.now().year,
                    "contributor": "IoT Labeling Service",
                    "date_created": datetime.now().isoformat()
                }
            )
            
            if split_dataset_flag:
                # Split dataset
                splits = split_dataset(images_formatted, annotations)
                return {
                    "ok": True,
                    "format": "coco",
                    "data": coco_data,
                    "splits": {
                        "train": export_coco_format(splits["train"]["images"], splits["train"]["annotations"], categories),
                        "val": export_coco_format(splits["val"]["images"], splits["val"]["annotations"], categories),
                        "test": export_coco_format(splits["test"]["images"], splits["test"]["annotations"], categories)
                    }
                }
            
            return {"ok": True, "format": "coco", "data": coco_data}
        
        elif format.lower() == "yolo":
            # Use YOLO export utility
            yolo_data = export_yolo_format(
                images=images_formatted,
                annotations=annotations,
                categories=categories
            )
            
            if split_dataset_flag:
                # Split dataset
                splits = split_dataset(images_formatted, annotations)
                return {
                    "ok": True,
                    "format": "yolo",
                    "data": yolo_data,
                    "splits": {
                        "train": export_yolo_format(splits["train"]["images"], splits["train"]["annotations"], categories),
                        "val": export_yolo_format(splits["val"]["images"], splits["val"]["annotations"], categories),
                        "test": export_yolo_format(splits["test"]["images"], splits["test"]["annotations"], categories)
                    }
                }
            
            return {"ok": True, "format": "yolo", "data": yolo_data}
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format}. Supported: coco, yolo")
    
    except HTTPException:
        raise
    except AttributeError:
        logger.error("Database not available")
        raise HTTPException(status_code=503, detail="Database service unavailable")
    except Exception:
        logger.error("Failed to export annotations")
        raise HTTPException(status_code=500, detail="Failed to export annotations")

