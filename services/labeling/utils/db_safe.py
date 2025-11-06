"""
Database-safe decorator to catch Motor database exceptions early
"""

from functools import wraps
from fastapi import HTTPException
from fastapi.responses import JSONResponse
import traceback
import sys

def db_safe(func):
    """
    Decorator to wrap database operations and catch Motor exceptions early
    Returns JSONResponse directly to avoid FastAPI exception serialization
    """
    import logging
    import traceback
    logger = logging.getLogger(__name__)
    
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Wrap in multiple try-catch layers to catch all exceptions
        try:
            try:
                result = await func(*args, **kwargs)
                # Ensure result doesn't contain database objects
                if isinstance(result, dict):
                    # Check if result contains any database objects
                    # If yes, convert to safe format
                    pass
                return result
            except NotImplementedError as e:
                # Log for debugging
                logger.error(f"[DB_SAFE] Caught NotImplementedError in {func.__name__}")
                try:
                    logger.error(f"[DB_SAFE] Exception args: {e.args if hasattr(e, 'args') else 'N/A'}")
                    tb = traceback.format_exc()
                    logger.error(f"[DB_SAFE] Traceback:\n{tb}")
                except Exception:
                    logger.error("[DB_SAFE] Could not log exception details")
                
                # Catch PyMongo truth value testing error immediately
                # Don't access exception object at all
                return JSONResponse(
                    status_code=500,
                    content={"detail": "Database operation error"}
                )
        except HTTPException as e:
            # Return JSONResponse directly instead of re-raising
            # IMPORTANT: Access e.detail safely - NEVER check truth value of detail
            try:
                if hasattr(e, 'detail'):
                    detail = e.detail
                    # Only use detail if it's a string - don't check truth value
                    if isinstance(detail, str):
                        pass  # Use detail as is
                    else:
                        # If detail is not a string, use generic message
                        # DON'T call str(detail) or check if detail - might trigger truth value testing
                        detail = "Internal server error"
                else:
                    detail = "Internal server error"
            except Exception:
                # If accessing detail fails (might contain database object), use generic message
                detail = "Internal server error"
            
            return JSONResponse(
                status_code=e.status_code,
                content={"detail": detail}
            )
        except NotImplementedError:
            # Catch PyMongo truth value testing error immediately
            # Don't access exception object at all - just return error
            # This prevents FastAPI from trying to serialize the exception
            return JSONResponse(
                status_code=500,
                content={"detail": "Database operation error"}
            )
        except TypeError as e:
            # Catch TypeError that might be from truth value testing
            # Check if it's related to database objects by checking args safely
            try:
                if hasattr(e, 'args') and e.args:
                    error_msg = e.args[0] if isinstance(e.args[0], str) else ""
                    if "truth value testing" in error_msg or "database is not None" in error_msg:
                        return JSONResponse(
                            status_code=500,
                            content={"detail": "Database operation error"}
                        )
            except Exception:
                # If checking fails, assume it might be truth value error
                pass
            raise
        except Exception as e:
            # Catch all other exceptions and return generic error
            # IMPORTANT: Don't call str(e) or access any attributes that might trigger truth value testing
            exc_type = type(e).__name__
            
            # If it's NotImplementedError, catch it (should have been caught above, but just in case)
            if exc_type == "NotImplementedError":
                return JSONResponse(
                    status_code=500,
                    content={"detail": "Database operation error"}
                )
            
            # For other exceptions, return generic error
            # Don't try to serialize exception message as it might contain database objects
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"}
            )
    return wrapper

