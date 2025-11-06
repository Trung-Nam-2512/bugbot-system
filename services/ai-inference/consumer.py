"""
Kafka Consumer Service
Consumer cho events.raw và publish enriched events
"""

import os
import json
import asyncio
from typing import Dict, Optional
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError
from minio import Minio
from minio.error import S3Error
import tempfile
from datetime import datetime

from inference import InferenceService
from utils.logger import setup_logger

logger = setup_logger(__name__)

class KafkaConsumerService:
    """Kafka consumer service cho AI inference"""
    
    def __init__(self, inference_service: InferenceService):
        self.inference_service = inference_service
        
        # Kafka config
        self.brokers = os.getenv("KAFKA_BROKERS", "localhost:1448").split(",")
        self.topic_raw = os.getenv("KAFKA_TOPIC_RAW", "events.raw")
        self.topic_enriched = os.getenv("KAFKA_TOPIC_ENRICHED", "events.enriched")
        self.consumer_group = os.getenv("KAFKA_CONSUMER_GROUP", "ai-inference-service")
        
        # MinIO config
        self.minio_endpoint = os.getenv("MINIO_ENDPOINT", "localhost")
        self.minio_port = int(os.getenv("MINIO_PORT", "1442"))
        self.minio_access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
        self.minio_secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
        self.minio_use_ssl = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
        self.bucket_raw = os.getenv("MINIO_BUCKET_RAW", "iot-raw")
        self.bucket_annotated = os.getenv("MINIO_BUCKET_ANNOTATED", "iot-annotated")
        
        # Services
        self.consumer = None
        self.producer = None
        self.minio_client = None
        self._running = False
        
        # Stats
        self.stats = {
            "consumed": 0,
            "processed": 0,
            "errors": 0,
            "detections": 0
        }
    
    async def start(self):
        """Start Kafka consumer"""
        try:
            # Initialize MinIO client
            self._init_minio()
            
            # Initialize Kafka producer
            self._init_producer()
            
            # Initialize Kafka consumer
            self._init_consumer()
            
            # Start consuming
            self._running = True
            asyncio.create_task(self._consume_loop())
            
            logger.info("✅ Kafka consumer service started")
            
        except Exception as e:
            logger.error(f"❌ Failed to start consumer service: {e}")
            raise
    
    def _init_minio(self):
        """Initialize MinIO client"""
        try:
            self.minio_client = Minio(
                f"{self.minio_endpoint}:{self.minio_port}",
                access_key=self.minio_access_key,
                secret_key=self.minio_secret_key,
                secure=self.minio_use_ssl
            )
            
            # Ensure buckets exist
            if not self.minio_client.bucket_exists(self.bucket_raw):
                self.minio_client.make_bucket(self.bucket_raw)
            
            if not self.minio_client.bucket_exists(self.bucket_annotated):
                self.minio_client.make_bucket(self.bucket_annotated)
            
            logger.info("✅ MinIO client initialized")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize MinIO: {e}")
            raise
    
    def _init_producer(self):
        """Initialize Kafka producer"""
        try:
            self.producer = KafkaProducer(
                bootstrap_servers=self.brokers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None
            )
            logger.info("✅ Kafka producer initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize producer: {e}")
            raise
    
    def _init_consumer(self):
        """Initialize Kafka consumer"""
        try:
            self.consumer = KafkaConsumer(
                self.topic_raw,
                bootstrap_servers=self.brokers,
                group_id=self.consumer_group,
                auto_offset_reset='latest',
                enable_auto_commit=True,
                value_deserializer=lambda m: json.loads(m.decode('utf-8'))
            )
            logger.info(f"✅ Kafka consumer initialized (topic: {self.topic_raw})")
        except Exception as e:
            logger.error(f"❌ Failed to initialize consumer: {e}")
            raise
    
    async def _consume_loop(self):
        """Main consumption loop"""
        logger.info("Starting consumption loop...")
        
        while self._running:
            try:
                # Poll for messages with shorter timeout to check _running more frequently
                message_pack = self.consumer.poll(timeout_ms=500)
                
                # Check if we should stop
                if not self._running:
                    break
                
                for topic_partition, messages in message_pack.items():
                    for message in messages:
                        # Check again before processing
                        if not self._running:
                            break
                        await self._process_message(message)
                        
            except KeyboardInterrupt:
                logger.info("Keyboard interrupt received, stopping consumer...")
                self._running = False
                break
            except Exception as e:
                logger.error(f"Error in consume loop: {e}")
                self.stats["errors"] += 1
                # Check if we should stop even after error
                if not self._running:
                    break
                await asyncio.sleep(1)
        
        logger.info("Consumer loop stopped")
    
    async def _process_message(self, message):
        """Process single message"""
        try:
            self.stats["consumed"] += 1
            
            event = message.value
            logger.debug(f"Processing event: {event.get('shot_id', 'unknown')}")
            
            # Download image from MinIO
            image_path = await self._download_image(event)
            
            if not image_path:
                logger.warning("Failed to download image, skipping")
                return
            
            # Run inference
            detection_result = await self.inference_service.detect(image_path)
            
            # Annotate image
            annotated_path = await self.inference_service.annotate_image(
                image_path,
                detection_result["detections"]
            )
            
            # Upload annotated image
            annotated_url = await self._upload_annotated_image(
                event,
                annotated_path
            )
            
            # Create enriched event
            enriched_event = {
                **event,
                "detections": detection_result["detections"],
                "detection_count": detection_result["count"],
                "annotated_image_url": annotated_url,
                "processed_at": None,  # Will be set to ISO string
                "inference_model": "yolov8n",
                "inference_version": "1.0.0"
            }
            
            # Publish enriched event
            await self._publish_enriched_event(enriched_event)
            
            self.stats["processed"] += 1
            self.stats["detections"] += detection_result["count"]
            
            # Cleanup temp files
            os.remove(image_path)
            if os.path.exists(annotated_path):
                os.remove(annotated_path)
            
            logger.info(
                f"✅ Processed event: {event.get('shot_id')} - "
                f"{detection_result['count']} detections"
            )
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            self.stats["errors"] += 1
    
    async def _download_image(self, event: Dict) -> Optional[str]:
        """Download image from MinIO"""
        try:
            image_url = event.get("image_url")
            if not image_url:
                logger.warning("No image_url in event")
                return None
            
            # Parse MinIO path từ URL
            # URL format có thể là:
            # - http://localhost:9000/iot-raw/path/to/image.jpg
            # - http://localhost:9002/iot-raw/path/to/image.jpg (external port)
            # - http://minio:9000/iot-raw/path/to/image.jpg?X-Amz-Algorithm=... (pre-signed URL)
            # - MinIO path có thể là full path từ bucket root
            
            # Remove query parameters (pre-signed URL có ?X-Amz-Algorithm=...)
            from urllib.parse import urlparse
            parsed_url = urlparse(image_url)
            clean_url = f"{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}"
            
            # Parse path
            path_parts = clean_url.split("/")
            
            # Try to find bucket in path
            bucket_idx = -1
            for i, part in enumerate(path_parts):
                if part == self.bucket_raw:
                    bucket_idx = i
                    break
            
            if bucket_idx == -1:
                # Try alternative: check if image_url is already a MinIO object path
                # Some events might have direct object paths
                if not image_url.startswith("http"):
                    # Assume it's already an object path
                    object_path = image_url
                else:
                    logger.warning(f"Could not parse image path from URL: {image_url}")
                    return None
            else:
                # Get object path (everything after bucket name)
                object_path = "/".join(path_parts[bucket_idx + 1:])
                # Remove leading slash if present
                if object_path.startswith("/"):
                    object_path = object_path[1:]
            
            # Create temp file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
            temp_path = temp_file.name
            temp_file.close()
            
            # Download from MinIO
            self.minio_client.fget_object(self.bucket_raw, object_path, temp_path)
            
            logger.debug(f"Downloaded image: {object_path} -> {temp_path}")
            return temp_path
            
        except Exception as e:
            logger.error(f"Error downloading image: {e}")
            return None
    
    async def _upload_annotated_image(
        self,
        event: Dict,
        annotated_path: str
    ) -> Optional[str]:
        """Upload annotated image to MinIO"""
        try:
            # Generate object path
            device_id = event.get("device_id", "unknown")
            shot_id = event.get("shot_id", "unknown")
            timestamp = event.get("timestamp", "").replace(":", "-").replace("T", "_")
            
            object_name = f"{device_id}/{timestamp}_{shot_id}_annotated.jpg"
            
            # Upload to MinIO
            self.minio_client.fput_object(
                self.bucket_annotated,
                object_name,
                annotated_path
            )
            
            # Generate URL
            url = f"http://{self.minio_endpoint}:{self.minio_port}/{self.bucket_annotated}/{object_name}"
            
            logger.debug(f"Uploaded annotated image: {object_name}")
            return url
            
        except Exception as e:
            logger.error(f"Error uploading annotated image: {e}")
            return None
    
    async def _publish_enriched_event(self, enriched_event: Dict):
        """Publish enriched event to Kafka"""
        try:
            # Set processed timestamp
            enriched_event["processed_at"] = datetime.utcnow().isoformat() + "Z"
            
            device_id = enriched_event.get("device_id", "unknown")
            
            future = self.producer.send(
                self.topic_enriched,
                key=device_id,
                value=enriched_event
            )
            
            # Wait for send confirmation
            record_metadata = future.get(timeout=10)
            
            logger.debug(
                f"Published enriched event to {self.topic_enriched} "
                f"(partition: {record_metadata.partition}, offset: {record_metadata.offset})"
            )
            
        except Exception as e:
            logger.error(f"Error publishing enriched event: {e}")
            raise
    
    async def stop(self):
        """Stop Kafka consumer"""
        logger.info("Stopping Kafka consumer service...")
        self._running = False
        
        # Wait a bit for current operations to finish
        await asyncio.sleep(0.5)
        
        # Close consumer
        if self.consumer:
            try:
                self.consumer.close()
                logger.info("Kafka consumer closed")
            except Exception as e:
                logger.error(f"Error closing consumer: {e}")
        
        # Close producer
        if self.producer:
            try:
                self.producer.close()
                logger.info("Kafka producer closed")
            except Exception as e:
                logger.error(f"Error closing producer: {e}")
        
        logger.info("✅ Kafka consumer service stopped")
    
    def is_running(self) -> bool:
        """Check if service is running"""
        return self._running
    
    def get_stats(self) -> Dict:
        """Get service statistics"""
        return self.stats.copy()

