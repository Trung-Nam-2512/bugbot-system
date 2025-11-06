"""
Inference Service
YOLOv8 inference logic cho insect detection
"""

import os
from typing import List, Dict, Optional, Tuple
import numpy as np
from PIL import Image
import cv2

# Fix for PyTorch 2.8+ weights_only issue
# Patch torch.load BEFORE importing YOLO
import torch
_original_torch_load = torch.load

def _patched_torch_load(*args, **kwargs):
    """Patch torch.load to use weights_only=False for YOLO models"""
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_torch_load(*args, **kwargs)

torch.load = _patched_torch_load

# Now import YOLO (will use patched torch.load)
from ultralytics import YOLO
from utils.logger import setup_logger

logger = setup_logger(__name__)

class InferenceService:
    """Service xử lý AI inference với YOLOv8"""
    
    def __init__(
        self,
        model_path: str = "models/yolov8n.pt",
        confidence_threshold: float = 0.25,
        device: str = "cpu"
    ):
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.device = device
        self.model = None
        self._initialized = False
    
    async def initialize(self):
        """Initialize YOLO model"""
        try:
            logger.info(f"Loading YOLO model from: {self.model_path}")
            
            # Check if model file exists
            if not os.path.exists(self.model_path):
                logger.warning(f"Model file not found: {self.model_path}, downloading...")
                # YOLO will auto-download if not found
            
            # Load model (torch.load already patched at module level)
            self.model = YOLO(self.model_path)
            self.model.to(self.device)
            
            self._initialized = True
            logger.info(f"✅ YOLO model loaded successfully (device: {self.device})")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize inference service: {e}")
            raise
    
    def is_initialized(self) -> bool:
        """Check if service is initialized"""
        return self._initialized and self.model is not None
    
    async def detect(self, image_path: str) -> Dict:
        """
        Detect objects trong image
        
        Args:
            image_path: Path to image file
            
        Returns:
            Dict với detections:
            {
                "detections": [
                    {
                        "class": str,
                        "confidence": float,
                        "bbox": [x1, y1, x2, y2]
                    }
                ],
                "count": int,
                "annotated_image_url": str (optional)
            }
        """
        if not self.is_initialized():
            raise RuntimeError("Inference service not initialized")
        
        try:
            logger.debug(f"Processing image: {image_path}")
            
            # Run inference
            results = self.model(
                image_path,
                conf=self.confidence_threshold,
                device=self.device
            )
            
            # Parse results
            detections = []
            result = results[0]  # First result
            
            if result.boxes is not None:
                for box in result.boxes:
                    # Get class name
                    class_id = int(box.cls[0])
                    class_name = result.names[class_id]
                    
                    # Get confidence
                    confidence = float(box.conf[0])
                    
                    # Get bounding box
                    bbox = box.xyxy[0].cpu().numpy().tolist()
                    
                    detections.append({
                        "class": class_name,
                        "confidence": confidence,
                        "bbox": bbox,
                        "class_id": class_id
                    })
            
            logger.info(f"Detected {len(detections)} objects in {image_path}")
            
            return {
                "detections": detections,
                "count": len(detections),
                "image_path": image_path
            }
            
        except Exception as e:
            logger.error(f"Error during inference: {e}")
            raise
    
    async def annotate_image(
        self,
        image_path: str,
        detections: List[Dict],
        output_path: Optional[str] = None
    ) -> str:
        """
        Annotate image với bounding boxes
        
        Args:
            image_path: Path to original image
            detections: List of detections
            output_path: Output path (optional)
            
        Returns:
            Path to annotated image
        """
        try:
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Could not load image: {image_path}")
            
            # Draw bounding boxes
            for det in detections:
                bbox = det["bbox"]
                class_name = det["class"]
                confidence = det["confidence"]
                
                x1, y1, x2, y2 = map(int, bbox)
                
                # Draw rectangle
                cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 0), 2)
                
                # Draw label
                label = f"{class_name} {confidence:.2f}"
                cv2.putText(
                    image,
                    label,
                    (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 255, 0),
                    2
                )
            
            # Save annotated image
            if output_path is None:
                base, ext = os.path.splitext(image_path)
                output_path = f"{base}_annotated{ext}"
            
            cv2.imwrite(output_path, image)
            logger.debug(f"Annotated image saved: {output_path}")
            
            return output_path
            
        except Exception as e:
            logger.error(f"Error annotating image: {e}")
            raise
    
    async def cleanup(self):
        """Cleanup resources"""
        self.model = None
        self._initialized = False
        logger.info("Inference service cleaned up")



