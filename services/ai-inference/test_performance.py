#!/usr/bin/env python3
"""
Performance Test
Test với multiple images để measure throughput
"""

import os
import sys
import asyncio
import time
import requests
from pathlib import Path
from dotenv import load_dotenv
from kafka import KafkaProducer
import json

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from inference import InferenceService
from utils.logger import setup_logger

load_dotenv()

logger = setup_logger(__name__)

async def test_performance(num_images=10):
    """Test performance với multiple images"""
    print(f"Performance Test: {num_images} images")
    print("=" * 50)
    
    try:
        # Initialize inference service
        print("1. Initializing inference service...")
        model_path = os.getenv('YOLO_MODEL_PATH', 'models/yolov8n.pt')
        confidence = float(os.getenv('YOLO_CONFIDENCE_THRESHOLD', '0.25'))
        device = os.getenv('YOLO_DEVICE', 'cpu')
        
        inference_service = InferenceService(
            model_path=model_path,
            confidence_threshold=confidence,
            device=device
        )
        await inference_service.initialize()
        print("   [OK] Inference service initialized")
        
        # Find test image
        test_image_paths = [
            "test-image.jpg",
            "../test-image.jpg",
            "../../test-image.jpg",
            "services/ai-inference/test-image.jpg"
        ]
        
        image_path = None
        for path in test_image_paths:
            if os.path.exists(path):
                image_path = path
                break
        
        if not image_path:
            print("   [SKIP] No test image found - skipping performance test")
            print("   Note: Performance test requires a test image")
            return True  # Not a failure, just skip
        
        # Test inference with multiple images
        print(f"\n2. Running inference with {num_images} images...")
        
        times = []
        detections = []
        
        start_total = time.time()
        
        for i in range(num_images):
            start = time.time()
            result = await inference_service.detect(image_path)
            elapsed = time.time() - start
            
            times.append(elapsed)
            detections.append(result["count"])
            
            print(f"   Image {i+1}/{num_images}: {elapsed:.2f}s, {result['count']} detections")
        
        total_time = time.time() - start_total
        
        # Calculate statistics
        avg_time = sum(times) / len(times)
        min_time = min(times)
        max_time = max(times)
        throughput = num_images / total_time
        
        print("\n3. Performance Statistics:")
        print("=" * 50)
        print(f"Total images: {num_images}")
        print(f"Total time: {total_time:.2f}s")
        print(f"Average time/image: {avg_time:.2f}s")
        print(f"Min time: {min_time:.2f}s")
        print(f"Max time: {max_time:.2f}s")
        print(f"Throughput: {throughput:.2f} images/second")
        print(f"Total detections: {sum(detections)}")
        
        # Memory usage (rough estimate)
        import psutil
        process = psutil.Process()
        memory_mb = process.memory_info().rss / 1024 / 1024
        print(f"Memory usage: {memory_mb:.2f} MB")
        
        # Cleanup
        await inference_service.cleanup()
        
        # Target check
        target_time = 2.0  # seconds per image
        if avg_time <= target_time:
            print(f"\n[SUCCESS] Performance target met (< {target_time}s/image)")
            return True
        else:
            print(f"\n[WARN] Performance target not met (>{target_time}s/image)")
            return False
        
    except Exception as e:
        print(f"[ERROR] Performance test error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Main test function"""
    num_images = int(os.getenv("PERF_TEST_IMAGES", "10"))
    
    success = await test_performance(num_images)
    
    if success:
        return 0
    else:
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

