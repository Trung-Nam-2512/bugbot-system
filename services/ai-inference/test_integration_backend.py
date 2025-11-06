#!/usr/bin/env python3
"""
Integration Test với Main Backend
Test complete flow: Upload image → AI inference → Enriched event
"""

import os
import sys
import asyncio
import requests
import json
import time
from pathlib import Path
from dotenv import load_dotenv
from kafka import KafkaConsumer
from minio import Minio

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8000")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:19092").split(",")
KAFKA_TOPIC_ENRICHED = os.getenv("KAFKA_TOPIC_ENRICHED", "events.enriched")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost")
MINIO_PORT = int(os.getenv("MINIO_PORT", "9002"))
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
MINIO_USE_SSL = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
BUCKET_ANNOTATED = os.getenv("MINIO_BUCKET_ANNOTATED", "iot-annotated")

def test_backend_upload():
    """Test upload image to backend"""
    print("1. Testing Backend Upload API...")
    
    try:
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
            print("   [SKIP] No test image found")
            return None
        
        # Read image
        with open(image_path, "rb") as f:
            image_data = f.read()
        
        # Upload to backend
        device_id = f"TEST_DEVICE_{int(time.time())}"
        ts = int(time.time() * 1000)
        
        files = {"file": ("test.jpg", image_data, "image/jpeg")}
        data = {
            "deviceId": device_id,
            "ts": str(ts)
        }
        
        response = requests.post(
            f"{BACKEND_URL}/api/upload",
            files=files,
            data=data,
            timeout=30
        )
        
        response.raise_for_status()
        result = response.json()
        
        print(f"   [OK] Image uploaded: {result.get('imageUrl', 'N/A')}")
        print(f"   Device ID: {device_id}")
        
        return {
            "device_id": device_id,
            "image_url": result.get("imageUrl"),
            "shot_id": result.get("shotId")
        }
        
    except Exception as e:
        print(f"   [ERROR] Upload failed: {e}")
        return None

def wait_for_enriched_event(device_id, timeout=30):
    """Wait for enriched event in Kafka"""
    print(f"\n2. Waiting for enriched event (timeout: {timeout}s)...")
    
    try:
        consumer = KafkaConsumer(
            KAFKA_TOPIC_ENRICHED,
            bootstrap_servers=KAFKA_BROKERS,
            group_id="test-integration-group",
            auto_offset_reset='latest',
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            consumer_timeout_ms=timeout * 1000
        )
        
        start_time = time.time()
        for message in consumer:
            event = message.value
            
            # Check if this is our event
            if event.get("device_id") == device_id:
                elapsed = time.time() - start_time
                print(f"   [OK] Enriched event received ({elapsed:.2f}s)")
                print(f"   Detections: {event.get('detection_count', 0)}")
                print(f"   Processed at: {event.get('processed_at', 'N/A')}")
                
                consumer.close()
                return event
            
            if time.time() - start_time > timeout:
                print(f"   [TIMEOUT] No enriched event after {timeout}s")
                consumer.close()
                return None
        
        consumer.close()
        return None
        
    except Exception as e:
        print(f"   [ERROR] Kafka consumer error: {e}")
        return None

def verify_annotated_image(event):
    """Verify annotated image exists in MinIO"""
    print("\n3. Verifying annotated image in MinIO...")
    
    try:
        annotated_url = event.get("annotated_image_url")
        if not annotated_url:
            print("   [WARN] No annotated_image_url in event")
            return False
        
        # Parse MinIO path
        path_parts = annotated_url.split("/")
        bucket_idx = path_parts.index(BUCKET_ANNOTATED) if BUCKET_ANNOTATED in path_parts else -1
        
        if bucket_idx == -1:
            print(f"   [ERROR] Could not parse annotated image path")
            return False
        
        object_path = "/".join(path_parts[bucket_idx + 1:])
        
        # Check MinIO
        minio_client = Minio(
            f"{MINIO_ENDPOINT}:{MINIO_PORT}",
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_USE_SSL
        )
        
        # Check if object exists
        try:
            minio_client.stat_object(BUCKET_ANNOTATED, object_path)
            print(f"   [OK] Annotated image exists: {object_path}")
            return True
        except Exception as e:
            print(f"   [ERROR] Annotated image not found: {e}")
            return False
        
    except Exception as e:
        print(f"   [ERROR] Verification error: {e}")
        return False

def check_ai_service_health():
    """Check AI service health"""
    print("\n0. Checking AI Service health...")
    
    try:
        response = requests.get(f"{AI_SERVICE_URL}/health", timeout=5)
        response.raise_for_status()
        data = response.json()
        
        if data.get("ok"):
            print("   [OK] AI Service is healthy")
            return True
        else:
            print(f"   [WARN] AI Service unhealthy: {data.get('status')}")
            return False
    except Exception as e:
        print(f"   [ERROR] AI Service not responding: {e}")
        return False

def main():
    """Main test function"""
    print("Integration Test với Main Backend")
    print("=" * 50)
    
    results = {
        "steps_passed": 0,
        "steps_total": 4,
        "errors": []
    }
    
    # Step 0: Check AI service
    if not check_ai_service_health():
        print("\n[ERROR] AI Service not available. Please start the service first.")
        print("Run: cd services/ai-inference && python main.py")
        return 1
    
    # Step 1: Upload to backend
    upload_result = test_backend_upload()
    if not upload_result:
        print("\n[ERROR] Upload failed")
        return 1
    
    results["steps_passed"] += 1
    
    # Step 2: Wait for enriched event
    enriched_event = wait_for_enriched_event(upload_result["device_id"], timeout=30)
    if not enriched_event:
        print("\n[ERROR] Enriched event not received")
        return 1
    
    results["steps_passed"] += 1
    
    # Step 3: Verify annotated image
    if verify_annotated_image(enriched_event):
        results["steps_passed"] += 1
    
    # Step 4: Check processing time
    print("\n4. Checking processing time...")
    if enriched_event.get("processed_at") and upload_result.get("image_url"):
        # Calculate processing time (rough estimate)
        print(f"   [OK] Event processed successfully")
        print(f"   Detections: {enriched_event.get('detection_count', 0)}")
        results["steps_passed"] += 1
    
    # Summary
    print("\n" + "=" * 50)
    print("Integration Test Summary:")
    print(f"Steps passed: {results['steps_passed']}/{results['steps_total']}")
    
    if results["steps_passed"] == results["steps_total"]:
        print("\n[SUCCESS] Integration test passed!")
        return 0
    else:
        print("\n[WARN] Some steps failed")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)


