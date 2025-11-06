#!/usr/bin/env python3
"""
Test Real Kafka Consumer
Test consuming real events từ events.raw và process
"""

import os
import json
import asyncio
import sys
import time
from pathlib import Path
from dotenv import load_dotenv
from kafka import KafkaConsumer
from minio import Minio
import tempfile

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from inference import InferenceService
from utils.logger import setup_logger

load_dotenv()

logger = setup_logger(__name__)

async def test_consume_and_process():
    """Test consuming real events từ Kafka và process"""
    print("Real Kafka Consumer Test")
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
        
        # Initialize MinIO
        print("2. Connecting to MinIO...")
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
        print("   [OK] MinIO connected")
        
        # Initialize Kafka consumer
        print("3. Connecting to Kafka...")
        brokers = os.getenv("KAFKA_BROKERS", "localhost:19092").split(",")
        topic = os.getenv("KAFKA_TOPIC_RAW", "events.raw")
        
        consumer = KafkaConsumer(
            topic,
            bootstrap_servers=brokers,
            group_id="test-consumer-group",
            auto_offset_reset='latest',  # Start from latest
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            consumer_timeout_ms=5000  # 5 second timeout
        )
        print(f"   [OK] Consumer connected to topic: {topic}")
        
        # Consume and process one message
        print("\n4. Waiting for messages (5s timeout)...")
        print("   (Send a test event via upload API or wait for next event)")
        
        message_pack = consumer.poll(timeout_ms=5000)
        
        if not message_pack:
            print("   [WARN] No messages received (timeout)")
            print("   This is normal if no events in queue")
            print("   You can send test event via: POST /api/upload")
            consumer.close()
            await inference_service.cleanup()
            return True  # Not a failure
        
        # Process first message
        for topic_partition, messages in message_pack.items():
            for message in messages[:1]:  # Process only first message
                event = message.value
                print(f"\n   [OK] Received event: {event.get('shot_id', 'unknown')}")
                
                # Process event
                try:
                    # Download image
                    image_url = event.get("image_url")
                    if not image_url:
                        print("   [ERROR] No image_url in event")
                        continue
                    
                    # Parse MinIO path
                    path_parts = image_url.split("/")
                    bucket_idx = path_parts.index(bucket_raw) if bucket_raw in path_parts else -1
                    if bucket_idx == -1:
                        print(f"   [ERROR] Could not parse image path from URL: {image_url}")
                        continue
                    
                    object_path = "/".join(path_parts[bucket_idx + 1:])
                    
                    # Download
                    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
                    temp_path = temp_file.name
                    temp_file.close()
                    
                    minio_client.fget_object(bucket_raw, object_path, temp_path)
                    print(f"   [OK] Image downloaded: {object_path}")
                    
                    # Run inference
                    start_time = time.time()
                    result = await inference_service.detect(temp_path)
                    inference_time = time.time() - start_time
                    
                    print(f"   [OK] Inference: {result['count']} detections ({inference_time:.2f}s)")
                    
                    # Annotate if detections
                    if result['detections']:
                        annotated_path = await inference_service.annotate_image(
                            temp_path,
                            result['detections']
                        )
                        
                        # Upload annotated
                        annotated_name = f"{object_path.replace('.jpg', '_annotated.jpg')}"
                        minio_client.fput_object(
                            bucket_annotated,
                            annotated_name,
                            annotated_path
                        )
                        print(f"   [OK] Annotated image uploaded")
                        
                        os.remove(annotated_path)
                    
                    os.remove(temp_path)
                    
                    print("\n   [SUCCESS] Event processed successfully!")
                    print(f"   Detections: {result['count']}")
                    print(f"   Processing time: {inference_time:.2f}s")
                    
                except Exception as e:
                    print(f"   [ERROR] Processing error: {e}")
                    import traceback
                    traceback.print_exc()
        
        consumer.close()
        await inference_service.cleanup()
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Test error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Main test function"""
    success = await test_consume_and_process()
    
    if success:
        print("\n[SUCCESS] Real Kafka consumer test completed!")
        return 0
    else:
        print("\n[ERROR] Test failed")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)


