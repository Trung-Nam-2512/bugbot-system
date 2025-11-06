#!/usr/bin/env python3
"""
Test Kafka Connection
Simple script để test Kafka consumer và producer
"""

import os
import json
from kafka import KafkaConsumer, KafkaProducer
from dotenv import load_dotenv

load_dotenv()

def test_kafka_consumer():
    """Test Kafka consumer"""
    print("Testing Kafka Consumer...")
    
    brokers = os.getenv("KAFKA_BROKERS", "localhost:19092").split(",")
    topic = os.getenv("KAFKA_TOPIC_RAW", "events.raw")
    
    try:
        consumer = KafkaConsumer(
            topic,
            bootstrap_servers=brokers,
            group_id="test-group",
            auto_offset_reset='latest',
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )
        
        print(f"[OK] Consumer connected to topic: {topic}")
        
        # Poll for messages (non-blocking)
        message_pack = consumer.poll(timeout_ms=1000)
        
        if message_pack:
            print(f"[OK] Messages available: {len(message_pack)} partitions")
        else:
            print("[WARN] No messages (may be normal if no events)")
        
        consumer.close()
        return True
        
    except Exception as e:
        print(f"[ERROR] Consumer error: {e}")
        return False

def test_kafka_producer():
    """Test Kafka producer"""
    print("\nTesting Kafka Producer...")
    
    brokers = os.getenv("KAFKA_BROKERS", "localhost:19092").split(",")
    topic = os.getenv("KAFKA_TOPIC_ENRICHED", "events.enriched")
    
    try:
        producer = KafkaProducer(
            bootstrap_servers=brokers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        
        # Send test message
        test_event = {
            "test": True,
            "message": "Kafka producer test"
        }
        
        future = producer.send(topic, value=test_event)
        record_metadata = future.get(timeout=10)
        
        print(f"[OK] Producer connected and sent message")
        print(f"   Topic: {record_metadata.topic}")
        print(f"   Partition: {record_metadata.partition}")
        print(f"   Offset: {record_metadata.offset}")
        
        producer.close()
        return True
        
    except Exception as e:
        print(f"[ERROR] Producer error: {e}")
        return False

def test_minio():
    """Test MinIO connection"""
    print("\nTesting MinIO Connection...")
    
    try:
        from minio import Minio
        from minio.error import S3Error
        
        endpoint = os.getenv("MINIO_ENDPOINT", "localhost")
        port = int(os.getenv("MINIO_PORT", "9000"))
        access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
        secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
        use_ssl = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
        
        client = Minio(
            f"{endpoint}:{port}",
            access_key=access_key,
            secret_key=secret_key,
            secure=use_ssl
        )
        
        # List buckets
        buckets = client.list_buckets()
        print(f"[OK] MinIO connected")
        print(f"   Buckets: {[b.name for b in buckets]}")
        
        # Check required buckets
        bucket_raw = os.getenv("MINIO_BUCKET_RAW", "iot-raw")
        bucket_annotated = os.getenv("MINIO_BUCKET_ANNOTATED", "iot-annotated")
        
        if client.bucket_exists(bucket_raw):
            print(f"[OK] Bucket '{bucket_raw}' exists")
        else:
            print(f"[WARN] Bucket '{bucket_raw}' does not exist")
        
        if client.bucket_exists(bucket_annotated):
            print(f"[OK] Bucket '{bucket_annotated}' exists")
        else:
            print(f"[WARN] Bucket '{bucket_annotated}' does not exist (will be created)")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] MinIO error: {e}")
        return False

if __name__ == "__main__":
    print("Kafka & MinIO Connection Test\n")
    
    results = []
    
    results.append(("Kafka Consumer", test_kafka_consumer()))
    results.append(("Kafka Producer", test_kafka_producer()))
    results.append(("MinIO", test_minio()))
    
    print("\nTest Results:")
    print("=" * 40)
    for name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{name}: {status}")
    
    all_passed = all(r[1] for r in results)
    
    if all_passed:
        print("\n[SUCCESS] All tests passed!")
        exit(0)
    else:
        print("\n[WARN] Some tests failed")
        exit(1)
