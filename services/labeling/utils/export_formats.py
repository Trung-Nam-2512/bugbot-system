"""
Export utilities for annotation formats
Supports COCO and YOLO formats
"""

from typing import List, Dict, Any
from datetime import datetime
import json

def export_coco_format(
    images: List[Dict],
    annotations: List[Dict],
    categories: List[str],
    info: Dict = None
) -> Dict:
    """
    Export annotations in COCO format
    
    Args:
        images: List of image metadata
        annotations: List of annotation data
        categories: List of category names
    
    Returns:
        COCO format dictionary
    """
    # Default info
    if info is None:
        info = {
            "description": "IoT Camera Dataset",
            "version": "1.0",
            "year": datetime.now().year,
            "contributor": "IoT Labeling Service",
            "date_created": datetime.now().isoformat()
        }
    
    # Build categories
    coco_categories = []
    for idx, cat_name in enumerate(categories):
        coco_categories.append({
            "id": idx + 1,  # COCO uses 1-based indexing
            "name": cat_name,
            "supercategory": "none"
        })
    
    # Build images
    coco_images = []
    image_id_map = {}  # Map image URL to COCO image ID
    for idx, img in enumerate(images):
        coco_img_id = idx + 1
        image_id_map[img.get("imageUrl", img.get("id", ""))] = coco_img_id
        
        coco_images.append({
            "id": coco_img_id,
            "width": img.get("width", 0),
            "height": img.get("height", 0),
            "file_name": img.get("imageUrl", "").split("/")[-1] if img.get("imageUrl") else f"image_{idx}.jpg",
            "license": 1,
            "flickr_url": img.get("imageUrl", ""),
            "coco_url": img.get("imageUrl", ""),
            "date_captured": img.get("createdAt", datetime.now().isoformat())
        })
    
    # Build annotations
    coco_annotations = []
    for idx, ann in enumerate(annotations):
        image_url = ann.get("imageUrl", ann.get("imageId", ""))
        coco_img_id = image_id_map.get(image_url, idx + 1)
        
        # Parse bounding box
        bbox = ann.get("bbox", [])
        if not bbox or len(bbox) != 4:
            continue
        
        # COCO format: [x, y, width, height] (top-left corner + size)
        # If bbox is in [x1, y1, x2, y2] format, convert it
        if len(bbox) == 4:
            x1, y1, x2, y2 = bbox
            x = x1
            y = y1
            width = x2 - x1
            height = y2 - y1
        else:
            x, y, width, height = bbox[:4]
        
        # Get category ID
        category_name = ann.get("class", ann.get("category", ""))
        category_id = None
        for cat in coco_categories:
            if cat["name"] == category_name:
                category_id = cat["id"]
                break
        
        if category_id is None:
            continue
        
        coco_annotations.append({
            "id": idx + 1,
            "image_id": coco_img_id,
            "category_id": category_id,
            "bbox": [x, y, width, height],
            "area": width * height,
            "iscrowd": 0,
            "segmentation": []
        })
    
    # Build COCO format
    coco_format = {
        "info": info,
        "licenses": [
            {
                "id": 1,
                "name": "Unknown",
                "url": ""
            }
        ],
        "categories": coco_categories,
        "images": coco_images,
        "annotations": coco_annotations
    }
    
    return coco_format


def export_yolo_format(
    images: List[Dict],
    annotations: List[Dict],
    categories: List[str],
    output_dir: str = None
) -> Dict[str, Any]:
    """
    Export annotations in YOLO format
    
    Args:
        images: List of image metadata
        annotations: List of annotation data
        categories: List of category names
        output_dir: Optional directory to save YOLO format files
    
    Returns:
        Dictionary with YOLO format data and file paths
    """
    # Build category map
    category_map = {cat: idx for idx, cat in enumerate(categories)}
    
    # Group annotations by image
    image_annotations = {}
    for ann in annotations:
        image_id = ann.get("imageId", ann.get("imageUrl", ""))
        if image_id not in image_annotations:
            image_annotations[image_id] = []
        image_annotations[image_id].append(ann)
    
    # Build YOLO format
    yolo_data = {
        "images": [],
        "labels": {}
    }
    
    for img in images:
        image_id = img.get("imageUrl", img.get("id", ""))
        width = img.get("width", 640)
        height = img.get("height", 480)
        
        yolo_data["images"].append({
            "id": image_id,
            "width": width,
            "height": height,
            "path": img.get("imageUrl", "")
        })
        
        # Build label file content
        label_lines = []
        if image_id in image_annotations:
            for ann in image_annotations[image_id]:
                bbox = ann.get("bbox", [])
                if not bbox or len(bbox) != 4:
                    continue
                
                # YOLO format: [x_center, y_center, width, height] normalized (0-1)
                x1, y1, x2, y2 = bbox[:4]
                x_center = (x1 + x2) / 2.0 / width
                y_center = (y1 + y2) / 2.0 / height
                w = (x2 - x1) / width
                h = (y2 - y1) / height
                
                # Get category ID
                category_name = ann.get("class", ann.get("category", ""))
                category_id = category_map.get(category_name, 0)
                
                label_lines.append(f"{category_id} {x_center:.6f} {y_center:.6f} {w:.6f} {h:.6f}")
        
        yolo_data["labels"][image_id] = "\n".join(label_lines)
    
    return yolo_data


def split_dataset(
    images: List[Dict],
    annotations: List[Dict],
    train_ratio: float = 0.7,
    val_ratio: float = 0.2,
    test_ratio: float = 0.1
) -> Dict[str, Dict]:
    """
    Split dataset into train/val/test sets
    
    Args:
        images: List of image metadata
        annotations: List of annotation data
        train_ratio: Ratio for training set
        val_ratio: Ratio for validation set
        test_ratio: Ratio for test set
    
    Returns:
        Dictionary with train/val/test splits
    """
    # Validate ratios
    if abs(train_ratio + val_ratio + test_ratio - 1.0) > 0.01:
        raise ValueError("Ratios must sum to 1.0")
    
    # Shuffle (simple implementation)
    import random
    combined = list(zip(images, [a for a in annotations if a.get("imageId")]))
    random.shuffle(combined)
    
    total = len(combined)
    train_end = int(total * train_ratio)
    val_end = train_end + int(total * val_ratio)
    
    train_data = combined[:train_end]
    val_data = combined[train_end:val_end]
    test_data = combined[val_end:]
    
    # Separate images and annotations
    splits = {
        "train": {
            "images": [img for img, _ in train_data],
            "annotations": [ann for _, ann in train_data]
        },
        "val": {
            "images": [img for img, _ in val_data],
            "annotations": [ann for _, ann in val_data]
        },
        "test": {
            "images": [img for img, _ in test_data],
            "annotations": [ann for _, ann in test_data]
        }
    }
    
    return splits


