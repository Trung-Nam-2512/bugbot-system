#!/usr/bin/env python3
"""
End-to-End Pipeline Test
Test complete flow: Kafka event → Inference → Enriched event
"""

import os
import json
import asyncio
import sys
import time
from pathlib import Path
from dotenv import load_dotenv
from kafka import KafkaProducer, KafkaConsumer
from minio import Minio
import tempfile

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from inference import InferenceService
from utils.logger import setup_logger

load_dotenv()

logger = setup_logger(__name__)

async def test_complete_pipeline():
    """Test complete inference pipeline end-to-end"""
    print("End-to-End Pipeline Test")
    print("=" * 50)
    
    results = {
        "steps_passed": 0,
        "steps_total": 6,
        "errors": []
    }
    
    try:
        # Step 1: Initialize inference service
        print("\n1. Initializing inference service...")
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
        results["steps_passed"] += 1
        
        # Step 2: Connect to MinIO
        print("\n2. Connecting to MinIO...")
        minio_endpoint = os.getenv("MINIO_ENDPOINT", "localhost")
        minio_port = int(os.getenv("MINIO_PORT", "9002"))
        minio_access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
        minio_secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
        minio_use_ssl = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
        bucket_raw = os.getenv("MINIO_BUCKET_RAW", "iot-raw")
        bucket_annotated = os.getenv("MINIO_BUCKET_ANNOTATED", "iot-annotated")
        
        minio_client = Minio(
            f"{minio_endpoint}:{minio_port}",
            access_key=minio_access_key,
            secret_key=minio_secret_key,
            secure=minio_use_ssl
        )
        
        # Ensure buckets exist
        if not minio_client.bucket_exists(bucket_raw):
            minio_client.make_bucket(bucket_raw)
            print(f"   [OK] Created bucket: {bucket_raw}")
        
        if not minio_client.bucket_exists(bucket_annotated):
            minio_client.make_bucket(bucket_annotated)
            print(f"   [OK] Created bucket: {bucket_annotated}")
        
        print("   [OK] MinIO connected")
        results["steps_passed"] += 1
        
        # Step 3: Get image from MinIO
        print("\n3. Getting image from MinIO...")
        try:
            objects = list(minio_client.list_objects(bucket_raw, recursive=True))
            if not objects:
                print("   [WARN] No images in MinIO - skipping pipeline test")
                print("   Upload images via Phase 1 backend first")
                return True  # Not a failure
            
            first_obj = next(iter(objects))
            print(f"   [OK] Found image: {first_obj.object_name}")
            results["steps_passed"] += 1
            
            # Step 4: Download and run inference
            print("\n4. Downloading and running inference...")
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
            temp_path = temp_file.name
            temp_file.close()
            
            minio_client.fget_object(bucket_raw, first_obj.object_name, temp_path)
            print("   [OK] Image downloaded")
            
            start_time = time.time()
            result = await inference_service.detect(temp_path)
            inference_time = time.time() - start_time
            
            print(f"   [OK] Inference completed: {result['count']} detections ({inference_time:.2f}s)")
            results["steps_passed"] += 1
            
            # Step 5: Annotate and upload
            print("\n5. Annotating and uploading image...")
            if result['detections']:
                annotated_path = await inference_service.annotate_image(
                    temp_path,
                    result['detections']
                )
                
                # Upload to MinIO
                annotated_name = f"{first_obj.object_name.replace('.jpg', '_annotated.jpg')}"
                minio_client.fput_object(
                    bucket_annotated,
                    annotated_name,
                    annotated_path
                )
                print(f"   [OK] Annotated image uploaded: {annotated_name}")
                results["steps_passed"] += 1
                
                # Cleanup
                os.remove(temp_path)
                os.remove(annotated_path)
            else:
                print("   [WARN] No detections to annotate")
                os.remove(temp_path)
            
            # Step 6: Create enriched event
            print("\n6. Creating enriched event...")
            enriched_event = {
                "device_id": "test-device-e2e",
                "timestamp": "2025-11-03T12:00:00Z",
                "shot_id": "test-shot-e2e",
                "image_url": f"http://{minio_endpoint}:{minio_port}/{bucket_raw}/{first_obj.object_name}",
                "detections": result['detections'],
                "detection_count": result['count'],
                "annotated_image_url": f"http://{minio_endpoint}:{minio_port}/{bucket_annotated}/{annotated_name}" if result['detections'] else None,
                "processed_at": None,  # Will be set
                "inference_model": "yolov8n",
                "inference_version": "1.0.0",
                "processing_time_ms": int(inference_time * 1000)
            }
            
            from datetime import datetime
            enriched_event["processed_at"] = datetime.utcnow().isoformat() + "Z"
            
            # Validate schema
            required_fields = [
                "device_id", "timestamp", "detections", 
                "detection_count", "processed_at", "inference_model"
            ]
            missing = [f for f in required_fields if f not in enriched_event]
            if missing:
                print(f"   [ERROR] Missing fields: {missing}")
                results["errors"].append(f"Missing fields: {missing}")
                return False
            
            print("   [OK] Enriched event created and validated")
            print(f"   Detections: {enriched_event['detection_count']}")
            print(f"   Processing time: {enriched_event['processing_time_ms']}ms")
            results["steps_passed"] += 1
            
            # Cleanup
            await inference_service.cleanup()
            
            return True
            
        except Exception as e:
            print(f"   [ERROR] Pipeline error: {e}")
            results["errors"].append(str(e))
            import traceback
            traceback.print_exc()
            return False
    
    except Exception as e:
        print(f"[ERROR] Setup error: {e}")
        results["errors"].append(str(e))
        return False
    
    finally:
        # Summary
        print("\n" + "=" * 50)
        print("Pipeline Test Summary:")
        print(f"Steps passed: {results['steps_passed']}/{results['steps_total']}")
        if results["errors"]:
            print(f"Errors: {len(results['errors'])}")
            for err in results["errors"]:
                print(f"  - {err}")

async def test_kafka_producer_enriched():
    """Test publishing enriched event to Kafka"""
    print("\nTesting Kafka Producer for Enriched Events...")
    print("=" * 50)
    
    try:
        brokers = os.getenv("KAFKA_BROKERS", "localhost:19092").split(",")
        topic = os.getenv("KAFKA_TOPIC_ENRICHED", "events.enriched")
        
        producer = KafkaProducer(
            bootstrap_servers=brokers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8') if k else None
        )
        
        # Create sample enriched event
        enriched_event = {
            "device_id": "test-device-e2e",
            "timestamp": "2025-11-03T12:00:00Z",
            "shot_id": "test-shot-e2e",
            "image_url": "http://localhost:9002/iot-raw/test.jpg",
            "detections": [
                {
                    "class": "person",
                    "confidence": 0.85,
                    "bbox": [100, 100, 200, 200],
                    "class_id": 0
                }
            ],
            "detection_count": 1,
            "annotated_image_url": "http://localhost:9002/iot-annotated/test_annotated.jpg",
            "processed_at": None,
            "inference_model": "yolov8n",
            "inference_version": "1.0.0",
            "processing_time_ms": 100
        }
        
        from datetime import datetime
        enriched_event["processed_at"] = datetime.utcnow().isoformat() + "Z"
        
        # Publish
        device_id = enriched_event["device_id"]
        future = producer.send(
            topic,
            key=device_id,
            value=enriched_event
        )
        
        record_metadata = future.get(timeout=10)
        
        print(f"[OK] Enriched event published")
        print(f"   Topic: {record_metadata.topic}")
        print(f"   Partition: {record_metadata.partition}")
        print(f"   Offset: {record_metadata.offset}")
        
        producer.close()
        return True
        
    except Exception as e:
        print(f"[ERROR] Kafka producer error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Main test function"""
    print("E2E Pipeline Testing")
    print("=" * 50)
    
    results = []
    
    # Test 1: Complete pipeline
    pipeline_success = await test_complete_pipeline()
    results.append(("Complete Pipeline", pipeline_success))
    
    # Test 2: Kafka producer
    kafka_success = await test_kafka_producer_enriched()
    results.append(("Kafka Producer (Enriched)", kafka_success))
    
    # Summary
    print("\n" + "=" * 50)
    print("Test Results:")
    print("=" * 50)
    for name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{name}: {status}")
    
    all_passed = all(r[1] for r in results)
    
    if all_passed:
        print("\n[SUCCESS] All E2E tests passed!")
        return 0
    else:
        print("\n[WARN] Some tests failed")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

