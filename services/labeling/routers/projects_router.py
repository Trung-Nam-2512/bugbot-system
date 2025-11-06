"""
Projects Router
FastAPI router cho labeling projects
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional

from controllers.projects_controller import (
    create_project,
    get_projects,
    get_project,
    update_project,
    delete_project,
    ProjectCreate,
    ProjectUpdate,
)

router = APIRouter()

@router.post("")
async def create_project_endpoint(project: ProjectCreate):
    """Create new labeling project"""
    try:
        return await create_project(project)
    except HTTPException:
        raise
    except Exception:
        # Catch any exception that might contain database objects
        from fastapi import HTTPException as FastAPIHTTPException
        raise FastAPIHTTPException(status_code=500, detail="Failed to create project")

@router.get("")
async def get_projects_endpoint(status: Optional[str] = None):
    """Get all labeling projects"""
    # Wrap everything in try-except to catch ALL exceptions before FastAPI serializes them
    try:
        try:
            result = await get_projects(status)
            # If result is JSONResponse, return it directly
            if isinstance(result, JSONResponse):
                return result
            return result
        except NotImplementedError:
            # Catch PyMongo truth value testing error immediately
            # Don't access exception object at all - just return error
            return JSONResponse(
                status_code=500,
                content={"detail": "Database operation error"}
            )
        except HTTPException as e:
            # Return JSONResponse instead of re-raising to avoid FastAPI serialization
            # IMPORTANT: Access e.detail safely - NEVER check truth value
            try:
                if hasattr(e, 'detail'):
                    detail = e.detail
                    # Only use detail if it's a string - don't check truth value
                    if not isinstance(detail, str):
                        detail = "Internal server error"
                else:
                    detail = "Internal server error"
            except Exception:
                detail = "Internal server error"
            return JSONResponse(
                status_code=e.status_code,
                content={"detail": detail}
            )
        except Exception as e:
            # Catch all other exceptions - check by type without accessing exception
            exc_type = type(e).__name__
            if exc_type == "NotImplementedError":
                return JSONResponse(
                    status_code=500,
                    content={"detail": "Database operation error"}
                )
            # Return JSONResponse directly to avoid FastAPI serialization
            return JSONResponse(
                status_code=500,
                content={"detail": "Failed to retrieve projects"}
            )
    except Exception:
        # Final catch-all - if even checking type fails, return generic error
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )

@router.get("/{project_id}")
async def get_project_endpoint(project_id: str):
    """Get project by ID"""
    try:
        result = await get_project(project_id)
        if isinstance(result, JSONResponse):
            return result
        return result
    except HTTPException as e:
        # IMPORTANT: Access e.detail safely - NEVER check truth value
        try:
            if hasattr(e, 'detail') and isinstance(e.detail, str):
                detail = e.detail
            else:
                detail = "Internal server error"
        except Exception:
            detail = "Internal server error"
        return JSONResponse(
            status_code=e.status_code,
            content={"detail": detail}
        )
    except NotImplementedError:
        # Catch PyMongo truth value testing error immediately
        # Don't access exception object at all
        return JSONResponse(
            status_code=500,
            content={"detail": "Database operation error"}
        )
    except Exception as e:
        # Check by type first
        exc_type = type(e).__name__
        if exc_type == "NotImplementedError":
            # Should have been caught above, but just in case
            return JSONResponse(
                status_code=500,
                content={"detail": "Database operation error"}
            )
        return JSONResponse(
            status_code=500,
            content={"detail": "Failed to retrieve project"}
        )

@router.put("/{project_id}")
async def update_project_endpoint(project_id: str, updates: ProjectUpdate):
    """Update project"""
    return await update_project(project_id, updates)

@router.delete("/{project_id}")
async def delete_project_endpoint(project_id: str):
    """Delete project"""
    return await delete_project(project_id)

