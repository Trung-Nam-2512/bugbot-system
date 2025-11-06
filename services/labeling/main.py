"""
Labeling Service
FastAPI service cho labeling project management
Phase 4: Labeling & Training
"""

import os
import sys
import signal
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

from utils.logger import setup_logger

# Load environment variables
load_dotenv()

logger = setup_logger(__name__)

# Configuration
class Settings(BaseSettings):
    service_name: str = "labeling-service"
    service_port: int = 8001
    env: str = "development"
    mongo_uri: str = "mongodb://root:mongodb123@localhost:27017"
    mongo_database: str = "iot"
    minio_endpoint: str = "localhost"
    minio_port: int = 9002
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin123"
    minio_use_ssl: bool = False
    # Label Studio configuration (optional)
    labelstudio_url: str = "http://localhost:8080"
    labelstudio_api_token: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields from .env file

settings = Settings()

# Service state
service_initialized = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Service lifespan management"""
    global service_initialized
    
    # Startup
    logger.info("Starting Labeling Service...")
    
    try:
        # Initialize MongoDB
        from libs.mongodb import init_mongodb
        init_mongodb()
        
        # Initialize MinIO
        from libs.minio_client import init_minio
        init_minio()
        
        # Initialize Label Studio (optional, won't fail if not configured)
        from libs.labelstudio_client import init_labelstudio
        init_labelstudio()
        
        service_initialized = True
        logger.info("Labeling Service started successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize service: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Labeling Service...")
    try:
        from libs.mongodb import close_mongodb
        close_mongodb()
    except Exception:
        # Ignore errors during shutdown
        pass
    
    service_initialized = False
    logger.info("Labeling Service shutdown complete")

# Create FastAPI app with lifespan
# Disable response validation to avoid Pydantic checking database objects
app = FastAPI(
    title="Labeling Service",
    description="Labeling project management service",
    version="1.0.0",
    lifespan=lifespan,
    # Disable strict validation that might trigger truth value testing
    response_model=None  # Let routes handle their own response models
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware to catch ALL exceptions before FastAPI serializes them
# This is the FIRST line of defense - catch exceptions before they reach FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse
import sys

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    """Middleware to catch ALL exceptions before FastAPI processes them"""
    # Wrap everything in try-except to catch ANY exception
    import traceback
    try:
        try:
            response = await call_next(request)
            return response
        except NotImplementedError as e:
            # Log the exception for debugging
            logger.error(f"[MIDDLEWARE] Caught NotImplementedError: {type(e).__name__}")
            logger.error(f"[MIDDLEWARE] Exception args: {e.args if hasattr(e, 'args') else 'N/A'}")
            # Try to get traceback safely
            try:
                tb = traceback.format_exc()
                logger.error(f"[MIDDLEWARE] Traceback:\n{tb}")
            except Exception:
                logger.error("[MIDDLEWARE] Could not format traceback")
            
            # Catch PyMongo truth value testing error immediately
            # Don't access exception object at all
            return JSONResponse(
                status_code=500,
                content={"detail": "Database operation error"}
            )
        except Exception as e:
            # Log the exception for debugging
            logger.error(f"[MIDDLEWARE] Caught Exception: {type(e).__name__}")
            try:
                logger.error(f"[MIDDLEWARE] Exception args: {e.args if hasattr(e, 'args') else 'N/A'}")
            except Exception:
                logger.error("[MIDDLEWARE] Could not access exception args")
            
            # Try to get traceback safely
            try:
                tb = traceback.format_exc()
                logger.error(f"[MIDDLEWARE] Traceback:\n{tb}")
            except Exception as ex:
                logger.error(f"[MIDDLEWARE] Could not format traceback: {type(ex).__name__}")
            
            # Try to check type without accessing exception
            try:
                # Use sys.exc_info() to get exception type without accessing exception object
                exc_type = sys.exc_info()[0]
                if exc_type is not None:
                    exc_type_name = exc_type.__name__
                    logger.error(f"[MIDDLEWARE] Exception type name: {exc_type_name}")
                    if exc_type_name == "NotImplementedError":
                        return JSONResponse(
                            status_code=500,
                            content={"detail": "Database operation error"}
                        )
            except Exception as ex:
                # If even checking type fails, return generic error
                logger.error(f"[MIDDLEWARE] Could not check exception type: {type(ex).__name__}")
                pass
            
            # For all other exceptions, return generic error
            # NEVER try to serialize exception or access its attributes
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"}
            )
    except Exception as e:
        # Final catch-all - if even the outer try fails, return generic error
        logger.error(f"[MIDDLEWARE] Outer catch-all caught: {type(e).__name__}")
        try:
            tb = traceback.format_exc()
            logger.error(f"[MIDDLEWARE] Outer traceback:\n{tb}")
        except Exception:
            pass
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )

# Explicit handler for NotImplementedError to log and return safe response
from fastapi.responses import JSONResponse
@app.exception_handler(NotImplementedError)
async def handle_not_implemented_error(request, exc):
    import traceback
    try:
        logger.error("[EXC] NotImplementedError caught by app handler")
        try:
            tb = traceback.format_exc()
            logger.error(f"[EXC] Traceback\n{tb}")
        except Exception:
            logger.error("[EXC] Could not format traceback")
    except Exception:
        pass
    return JSONResponse(status_code=500, content={"detail": "Database operation error"})

# Health checks
@app.get("/health")
async def health_check():
    """Basic health check"""
    return {
        "ok": True,
        "service": "labeling-service",
        "status": "healthy" if service_initialized else "initializing",
    }

@app.get("/health/liveness")
async def liveness_probe():
    """Liveness probe"""
    return {"ok": True, "status": "alive"}

@app.get("/health/readiness")
async def readiness_probe():
    """Readiness probe"""
    if not service_initialized:
        raise HTTPException(status_code=503, detail="Service not ready")
    return {"ok": True, "status": "ready"}

# Root endpoint
@app.get("/")
async def root():
    return {
        "service": "labeling-service",
        "version": "1.0.0",
        "status": "running",
    }

# Import and register routes
from routers.projects_router import router as projects_router
from routers.images_router import router as images_router
from routers.annotations_router import router as annotations_router
from routers.labelstudio_router import router as labelstudio_router

app.include_router(projects_router, prefix="/api/projects", tags=["Projects"])
app.include_router(images_router, prefix="/api", tags=["Images"])
app.include_router(annotations_router, prefix="/api", tags=["Annotations"])
app.include_router(labelstudio_router, tags=["Label Studio"])

# Signal handlers for graceful shutdown
def setup_signal_handlers():
    """Setup signal handlers for graceful shutdown"""
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

if __name__ == "__main__":
    # Setup signal handlers
    setup_signal_handlers()
    
    import uvicorn
    import logging
    
    # Setup detailed logging for debugging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('labeling_service.log')
        ]
    )
    
    port = int(os.getenv("SERVICE_PORT", "8001"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENV", "production") == "development",
        log_level="debug"
    )

