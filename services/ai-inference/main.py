#!/usr/bin/env python3
"""
AI Inference Service - Main Entry Point
FastAPI service cho AI inference từ Kafka events
"""

import os
import signal
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from dotenv import load_dotenv

from consumer import KafkaConsumerService
from inference import InferenceService
from utils.logger import setup_logger

# Load environment variables
load_dotenv()

# Setup logger
logger = setup_logger(__name__)

# Global services
consumer_service = None
inference_service = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events: startup và shutdown"""
    global consumer_service, inference_service
    
    # Startup
    logger.info("🚀 Starting AI Inference Service...")
    
    try:
        # Initialize inference service
        model_path = os.getenv('YOLO_MODEL_PATH', 'models/yolov8n.pt')
        confidence = float(os.getenv('YOLO_CONFIDENCE_THRESHOLD', '0.25'))
        device = os.getenv('YOLO_DEVICE', 'cpu')
        
        inference_service = InferenceService(
            model_path=model_path,
            confidence_threshold=confidence,
            device=device
        )
        await inference_service.initialize()
        logger.info("✅ Inference service initialized")
        
        # Initialize Kafka consumer (but don't start yet)
        consumer_service = KafkaConsumerService(inference_service)
        logger.info("✅ Kafka consumer initialized")
        
        # Start consumer as background task after FastAPI starts
        import asyncio
        asyncio.create_task(start_consumer_delayed())
        
        logger.info("✅ AI Inference Service started successfully")
        
    except Exception as e:
        logger.error(f"❌ Failed to start service: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down AI Inference Service...")
    
    try:
        if consumer_service and consumer_service.is_running():
            logger.info("Stopping Kafka consumer...")
            await consumer_service.stop()
        if inference_service:
            await inference_service.cleanup()
        logger.info("✅ Service shutdown complete")
    except Exception as e:
        logger.error(f"❌ Error during shutdown: {e}")

async def start_consumer_delayed():
    """Start consumer after FastAPI is ready"""
    import asyncio
    await asyncio.sleep(2)  # Wait for FastAPI HTTP server to start
    logger.info("🚀 Starting Kafka consumer in background...")
    global consumer_service
    if consumer_service:
        try:
            await consumer_service.start()
            logger.info("✅ Kafka consumer started successfully")
        except Exception as e:
            logger.error(f"❌ Failed to start consumer: {e}")

# Create FastAPI app
app = FastAPI(
    title="AI Inference Service",
    description="Microservice cho AI inference (YOLOv8) từ Kafka events",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production: configure specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "ai-inference",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        healthy = True
        details = {}
        
        # Check inference service
        if inference_service:
            details["inference"] = {
                "initialized": inference_service.is_initialized(),
                "model_loaded": inference_service.model is not None
            }
        else:
            healthy = False
            details["inference"] = {"error": "not initialized"}
        
        # Check Kafka consumer
        if consumer_service:
            details["kafka"] = {
                "running": consumer_service.is_running(),
                "consumed": consumer_service.get_stats().get("consumed", 0),
                "errors": consumer_service.get_stats().get("errors", 0)
            }
        else:
            healthy = False
            details["kafka"] = {"error": "not initialized"}
        
        status_code = 200 if healthy else 503
        return {
            "ok": healthy,
            "status": "healthy" if healthy else "unhealthy",
            "details": details
        }
    except Exception as e:
        logger.error(f"Health check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health/liveness")
async def liveness():
    """Kubernetes liveness probe"""
    return {"ok": True, "status": "alive"}

@app.get("/health/readiness")
async def readiness():
    """Kubernetes readiness probe"""
    if consumer_service and inference_service:
        if consumer_service.is_running() and inference_service.is_initialized():
            return {"ok": True, "status": "ready"}
    return {"ok": False, "status": "not ready"}

@app.get("/stats")
async def get_stats():
    """Get service statistics"""
    if not consumer_service:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    stats = consumer_service.get_stats()
    return {
        "ok": True,
        "stats": stats
    }

@app.get("/metrics")
async def get_metrics():
    """Get service metrics (Prometheus format)"""
    if not consumer_service:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    stats = consumer_service.get_stats()
    
    # Format as Prometheus metrics
    metrics = []
    metrics.append(f"# HELP ai_inference_events_consumed Total events consumed from Kafka")
    metrics.append(f"# TYPE ai_inference_events_consumed counter")
    metrics.append(f"ai_inference_events_consumed {stats.get('consumed', 0)}")
    
    metrics.append(f"# HELP ai_inference_events_processed Total events processed successfully")
    metrics.append(f"# TYPE ai_inference_events_processed counter")
    metrics.append(f"ai_inference_events_processed {stats.get('processed', 0)}")
    
    metrics.append(f"# HELP ai_inference_events_errors Total processing errors")
    metrics.append(f"# TYPE ai_inference_events_errors counter")
    metrics.append(f"ai_inference_events_errors {stats.get('errors', 0)}")
    
    metrics.append(f"# HELP ai_inference_detections_total Total objects detected")
    metrics.append(f"# TYPE ai_inference_detections_total counter")
    metrics.append(f"ai_inference_detections_total {stats.get('detections', 0)}")
    
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(content="\n".join(metrics) + "\n")

@app.get("/model/info")
async def get_model_info():
    """Get model information"""
    if not inference_service or not inference_service.is_initialized():
        raise HTTPException(status_code=503, detail="Inference service not initialized")
    
    try:
        model = inference_service.model
        model_info = {
            "model_path": inference_service.model_path,
            "device": inference_service.device,
            "confidence_threshold": inference_service.confidence_threshold,
            "model_type": "YOLOv8",
            "initialized": inference_service.is_initialized()
        }
        
        # Get model metadata if available
        if model and hasattr(model, 'names'):
            model_info["classes"] = len(model.names)
            model_info["class_names"] = list(model.names.values())
        
        return {
            "ok": True,
            "model": model_info
        }
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/inference/run")
async def run_inference(image_url: str = None, image_path: str = None):
    """
    Manual inference endpoint (for testing)
    
    Args:
        image_url: URL to image (MinIO or HTTP)
        image_path: Local path to image
    
    Returns:
        Detection results
    """
    if not inference_service or not inference_service.is_initialized():
        raise HTTPException(status_code=503, detail="Inference service not initialized")
    
    try:
        import tempfile
        import requests
        from minio import Minio
        
        # Determine image source
        if image_path:
            # Use local path
            if not os.path.exists(image_path):
                raise HTTPException(status_code=404, detail=f"Image not found: {image_path}")
            local_path = image_path
        elif image_url:
            # Download from URL or MinIO
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
            local_path = temp_file.name
            temp_file.close()
            
            if image_url.startswith("http://") or image_url.startswith("https://"):
                # HTTP URL
                response = requests.get(image_url, timeout=30)
                response.raise_for_status()
                with open(local_path, "wb") as f:
                    f.write(response.content)
            else:
                # MinIO object path
                minio_endpoint = os.getenv("MINIO_ENDPOINT", "localhost")
                minio_port = int(os.getenv("MINIO_PORT", "9002"))
                minio_access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
                minio_secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
                minio_use_ssl = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
                bucket_raw = os.getenv("MINIO_BUCKET_RAW", "iot-raw")
                
                minio_client = Minio(
                    f"{minio_endpoint}:{minio_port}",
                    access_key=minio_access_key,
                    secret_key=minio_secret_key,
                    secure=minio_use_ssl
                )
                
                # Parse object path
                if image_url.startswith(bucket_raw + "/"):
                    object_path = image_url[len(bucket_raw) + 1:]
                else:
                    object_path = image_url
                
                minio_client.fget_object(bucket_raw, object_path, local_path)
        else:
            raise HTTPException(status_code=400, detail="Either image_url or image_path must be provided")
        
        # Run inference
        import time
        start_time = time.time()
        result = await inference_service.detect(local_path)
        processing_time = time.time() - start_time
        
        # Cleanup temp file if downloaded
        if image_url and os.path.exists(local_path):
            try:
                os.remove(local_path)
            except:
                pass
        
        return {
            "ok": True,
            "detections": result["detections"],
            "count": result["count"],
            "processing_time_ms": int(processing_time * 1000)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running inference: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Global flag for shutdown
shutdown_event = None

def setup_signal_handlers():
    """Setup signal handlers for graceful shutdown"""
    import asyncio
    global shutdown_event
    
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        # Set shutdown event to trigger graceful shutdown
        if shutdown_event:
            shutdown_event.set()
        # Force stop consumer if running
        global consumer_service
        if consumer_service and consumer_service.is_running():
            try:
                # Create event loop if needed
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                
                # Stop consumer asynchronously
                if loop.is_running():
                    asyncio.create_task(consumer_service.stop())
                else:
                    loop.run_until_complete(consumer_service.stop())
            except Exception as e:
                logger.error(f"Error stopping consumer: {e}")
        
        # Give a moment for cleanup, then exit
        import time
        time.sleep(0.5)
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

if __name__ == "__main__":
    # Setup signal handlers
    setup_signal_handlers()
    
    port = int(os.getenv("SERVICE_PORT", "8000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENV", "production") == "development"
    )



