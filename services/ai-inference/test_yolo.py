#!/usr/bin/env python3
"""
Test YOLO Inference
Test script để verify YOLO model loading và inference
"""

import os
import time
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from inference import InferenceService
from utils.logger import setup_logger

load_dotenv()

logger = setup_logger(__name__)

async def test_model_loading():
    """Test YOLO model loading"""
    print("Testing YOLO Model Loading...")
    print("=" * 50)
    
    try:
        model_path = os.getenv('YOLO_MODEL_PATH', 'models/yolov8n.pt')
        confidence = float(os.getenv('YOLO_CONFIDENCE_THRESHOLD', '0.25'))
        device = os.getenv('YOLO_DEVICE', 'cpu')
        
        print(f"Model path: {model_path}")
        print(f"Confidence threshold: {confidence}")
        print(f"Device: {device}")
        print()
        
        # Initialize service
        inference_service = InferenceService(
            model_path=model_path,
            confidence_threshold=confidence,
            device=device
        )
        
        # Load model
        print("Loading model...")
        start_time = time.time()
        await inference_service.initialize()
        load_time = time.time() - start_time
        
        print(f"[OK] Model loaded successfully in {load_time:.2f}s")
        print(f"[OK] Model initialized: {inference_service.is_initialized()}")
        print(f"[OK] Model object: {inference_service.model is not None}")
        
        return inference_service, True
        
    except Exception as e:
        print(f"[ERROR] Model loading failed: {e}")
        import traceback
        traceback.print_exc()
        return None, False

async def test_inference_with_sample(inference_service, image_path=None):
    """Test inference với sample image"""
    print("\nTesting Inference with Sample Image...")
    print("=" * 50)
    
    if not inference_service:
        print("[ERROR] Inference service not available")
        return False
    
    # Use test image if available
    if not image_path:
        # Try to find test image
        test_image_paths = [
            '../test-image.jpg',
            '../../test-image.jpg',
            'test-image.jpg'
        ]
        
        for path in test_image_paths:
            if os.path.exists(path):
                image_path = path
                break
        
        if not image_path or not os.path.exists(image_path):
            print("[WARN] No test image found, skipping inference test")
            print("   You can test with a real image later")
            return True
    
    try:
        print(f"Using image: {image_path}")
        
        # Run inference
        print("\nRunning inference...")
        start_time = time.time()
        result = await inference_service.detect(image_path)
        inference_time = time.time() - start_time
        
        print(f"\n[OK] Inference completed in {inference_time:.2f}s")
        print(f"[OK] Detections found: {result['count']}")
        
        # Show detections
        if result['detections']:
            print("\nDetections:")
            for i, det in enumerate(result['detections'][:5], 1):  # Show first 5
                print(f"  {i}. {det['class']} (confidence: {det['confidence']:.2f})")
            if len(result['detections']) > 5:
                print(f"  ... and {len(result['detections']) - 5} more")
        else:
            print("  No detections found")
        
        # Performance check
        target_time = 2.0  # seconds
        if inference_time < target_time:
            print(f"[OK] Inference time {inference_time:.2f}s < target {target_time}s")
        else:
            print(f"[WARN] Inference time {inference_time:.2f}s > target {target_time}s")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Inference failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_annotation(inference_service, image_path=None):
    """Test image annotation"""
    print("\nTesting Image Annotation...")
    print("=" * 50)
    
    if not inference_service:
        print("[ERROR] Inference service not available")
        return False
    
    if not image_path:
        print("[WARN] No image provided, skipping annotation test")
        return True
    
    try:
        # Run inference first
        result = await inference_service.detect(image_path)
        
        if not result['detections']:
            print("[WARN] No detections to annotate")
            return True
        
        # Annotate image
        print("Annotating image...")
        start_time = time.time()
        annotated_path = await inference_service.annotate_image(
            image_path,
            result['detections']
        )
        annotation_time = time.time() - start_time
        
        print(f"[OK] Annotation completed in {annotation_time:.2f}s")
        print(f"[OK] Annotated image saved: {annotated_path}")
        
        if os.path.exists(annotated_path):
            file_size = os.path.getsize(annotated_path) / 1024  # KB
            print(f"[OK] File size: {file_size:.2f} KB")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Annotation failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Main test function"""
    print("YOLO Inference Testing")
    print("=" * 50)
    print()
    
    results = []
    
    # Test 1: Model loading
    inference_service, success = await test_model_loading()
    results.append(("Model Loading", success))
    
    if not success:
        print("\n[ERROR] Model loading failed, cannot continue")
        return
    
    # Test 2: Inference
    inference_success = await test_inference_with_sample(inference_service)
    results.append(("Inference", inference_success))
    
    # Test 3: Annotation (optional)
    # annotation_success = await test_annotation(inference_service)
    # results.append(("Annotation", annotation_success))
    
    # Cleanup
    if inference_service:
        await inference_service.cleanup()
    
    # Summary
    print("\n" + "=" * 50)
    print("Test Results:")
    print("=" * 50)
    for name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{name}: {status}")
    
    all_passed = all(r[1] for r in results)
    
    if all_passed:
        print("\n[SUCCESS] All tests passed!")
        return 0
    else:
        print("\n[WARN] Some tests failed")
        return 1

if __name__ == "__main__":
    import asyncio
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

