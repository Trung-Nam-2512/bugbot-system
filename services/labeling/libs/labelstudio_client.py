"""
Label Studio Client
Integration với Label Studio API
"""

import os
import requests
import logging
from typing import Dict, List, Optional, Any
from urllib.parse import urljoin

# Import requests.exceptions for error handling
from requests.exceptions import HTTPError

logger = logging.getLogger(__name__)

# Label Studio client state
labelstudio_client = None
is_connected = False
base_url = None
api_token = None
access_token = None  # Short-lived access token from refresh

# Export for use in controllers
def get_is_connected():
    """Get Label Studio connection status"""
    return is_connected

def init_labelstudio():
    """Initialize Label Studio client"""
    global labelstudio_client, is_connected, base_url, api_token, access_token
    
    try:
        # Load from .env file if python-dotenv is available
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass
        
        base_url = os.getenv("LABELSTUDIO_URL", "http://localhost:8080")
        api_token = os.getenv("LABELSTUDIO_API_TOKEN", "")
        
        if not api_token:
            logger.warning("Label Studio API token not configured. Some features may not work.")
            is_connected = False
            return False
        
        # Check if token is JWT (Personal Access Token) or Legacy Token
        # JWT tokens start with "eyJ" (base64 encoded JSON)
        is_jwt = api_token.startswith("eyJ")
        
        if is_jwt:
            # Personal Access Token (JWT refresh token) - need to get access token
            logger.info("Detected JWT token (Personal Access Token), getting access token...")
            try:
                response = requests.post(
                    urljoin(base_url, "/api/token/refresh"),
                    json={"refresh": api_token},
                    headers={"Content-Type": "application/json"},
                    timeout=5
                )
                
                if response.status_code == 200:
                    token_data = response.json()
                    access_token = token_data.get("access")
                    if access_token:
                        logger.info("Successfully obtained access token from Personal Access Token")
                        # Keep original PAT for refresh, use access_token for API calls
                        # Store access_token globally for use in _make_request
                    else:
                        logger.warning("No access token in response")
                        access_token = None
                else:
                    logger.warning(f"Failed to refresh token: {response.status_code}")
            except Exception as e:
                logger.warning(f"Failed to refresh JWT token: {e}. Trying direct use...")
                # Try using JWT directly as Bearer token
                pass
        
        # Test connection with token
        # Use access_token if available (from JWT refresh), otherwise use api_token
        token_to_use = access_token if access_token else api_token
        auth_format = "Bearer" if access_token else "Token"
        
        connected = False
        
        try:
            headers = {
                "Authorization": f"{auth_format} {token_to_use}",
                "Content-Type": "application/json"
            }
            
            # Test with /api/projects (requires auth)
            response = requests.get(
                urljoin(base_url, "/api/projects"),
                headers=headers,
                timeout=5
            )
            
            if response.status_code == 200:
                connected = True
                logger.info(f"Label Studio connected: {base_url} (using {auth_format} format)")
        except Exception as e:
            logger.debug(f"Auth test failed: {e}")
        
        if not connected:
            # Try health endpoint (may not require auth)
            try:
                response = requests.get(urljoin(base_url, "/api/health"), timeout=5)
                if response.status_code == 200:
                    logger.warning("Label Studio health check passed but token authentication failed")
                    logger.warning("Please verify your Personal Access Token in Label Studio")
                    logger.warning("Token should be from: Avatar -> Account & Settings -> Access Token")
                    is_connected = True  # Allow connection but will fail on actual API calls
                    return True
            except:
                pass
            
            logger.error("Label Studio connection test failed. Please check your token.")
            is_connected = False
            return False
        else:
            is_connected = True
            return True
            
    except Exception as e:
        logger.error(f"Failed to connect to Label Studio: {e}")
        is_connected = False
        return False

def get_labelstudio_client():
    """Get Label Studio client instance"""
    if not is_connected:
        raise ValueError("Label Studio not connected")
    return {"base_url": base_url, "api_token": api_token}

def _refresh_access_token_if_needed():
    """Refresh access token if it's a JWT PAT and token is expired or missing"""
    global access_token, api_token, base_url
    
    if not api_token or not api_token.startswith("eyJ"):
        return  # Not a JWT token, skip refresh
    
    # If access_token is None or might be expired, try to refresh
    if not access_token:
        try:
            response = requests.post(
                urljoin(base_url, "/api/token/refresh"),
                json={"refresh": api_token},
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            
            if response.status_code == 200:
                token_data = response.json()
                access_token = token_data.get("access")
                if access_token:
                    logger.debug("Refreshed access token")
        except Exception as e:
            logger.warning(f"Failed to refresh access token: {e}")

def _make_request(method: str, endpoint: str, data: Optional[Dict] = None, params: Optional[Dict] = None) -> Dict:
    """Make HTTP request to Label Studio API"""
    if not is_connected:
        # Try to initialize if not connected
        init_labelstudio()
        if not is_connected:
            raise ValueError("Label Studio not connected")
    
    # Refresh token if needed (for JWT PATs)
    _refresh_access_token_if_needed()
    
    url = urljoin(base_url, endpoint)
    
    # Label Studio supports both "Token" (legacy) and "Bearer" (JWT access token) formats
    # If we have access_token (from JWT refresh), use Bearer, otherwise use Token
    global access_token, api_token
    if access_token:
        auth_header = f"Bearer {access_token}"
    else:
        auth_header = f"Token {api_token}"
    
    headers = {
        "Authorization": auth_header,
        "Content-Type": "application/json"
    }
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data, params=params, timeout=30)
        elif method.upper() == "PATCH":
            response = requests.patch(url, headers=headers, json=data, params=params, timeout=30)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=headers, params=params, timeout=30)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        # Check status code manually for better error handling
        if response.status_code >= 400:
            error_detail = ""
            try:
                error_json = response.json()
                error_detail = error_json.get("detail", error_json.get("message", str(error_json)))
            except:
                error_detail = response.text[:200] if response.text else f"HTTP {response.status_code}"
            
            logger.error(f"Label Studio API error {response.status_code}: {error_detail}")
            http_error = HTTPError(f"Label Studio API error {response.status_code}: {error_detail}", response=response)
            http_error.response = response
            raise http_error
        
        return response.json() if response.content else {}
        
    except HTTPError:
        raise
    except requests.exceptions.RequestException as e:
        logger.error(f"Label Studio API request failed: {e}")
        raise

def create_project(title: str, description: str = "", label_config: str = None) -> Dict:
    """
    Create a new project in Label Studio
    
    Args:
        title: Project title
        description: Project description
        label_config: Label Studio labeling configuration (XML format)
    
    Returns:
        Project data from Label Studio
    """
    if label_config is None:
        # Default object detection config
        label_config = """<View>
  <Image name="image" value="$image"/>
  <RectangleLabels name="label" toName="image">
    <Label value="object" background="red"/>
  </RectangleLabels>
</View>"""
    
    data = {
        "title": title,
        "description": description,
        "label_config": label_config
    }
    
    return _make_request("POST", "/api/projects", data=data)

def get_project(project_id: int) -> Dict:
    """Get project details from Label Studio"""
    return _make_request("GET", f"/api/projects/{project_id}")

def list_projects() -> List[Dict]:
    """List all projects in Label Studio"""
    response = _make_request("GET", "/api/projects")
    return response.get("results", [])

def import_tasks(project_id: int, tasks: List[Dict]) -> Dict:
    """
    Import tasks (images) to Label Studio project
    
    Args:
        project_id: Label Studio project ID
        tasks: List of task data, each with 'data' field containing image URL
    
    Returns:
        Import result
    """
    # Label Studio API v2.0+ uses /api/tasks endpoint with project in data
    # Try multiple methods for compatibility
    results = []
    errors = []
    
    for task in tasks:
        # Method 1: Try /api/tasks with project_id in body
        try:
            task_with_project = {
                **task,
                "project": project_id
            }
            result = _make_request("POST", "/api/tasks", data=task_with_project)
            results.append(result)
            continue
        except HTTPError as e:
            if e.response.status_code != 404:
                errors.append(f"Task import failed (method 1): {e}")
        
        # Method 2: Try /api/projects/{id}/tasks
        try:
            result = _make_request("POST", f"/api/projects/{project_id}/tasks", data=task)
            results.append(result)
            continue
        except HTTPError as e:
            if e.response.status_code != 404:
                errors.append(f"Task import failed (method 2): {e}")
        
        # Method 3: Try /api/projects/{id}/import (batch)
        try:
            # This might work for batch import
            result = _make_request("POST", f"/api/projects/{project_id}/import", data=[task])
            if isinstance(result, list):
                results.extend(result)
            else:
                results.append(result)
            continue
        except HTTPError as e:
            errors.append(f"Task import failed (method 3): {e}")
    
    if results:
        logger.info(f"Imported {len(results)}/{len(tasks)} tasks to Label Studio")
        return {"imported": len(results), "total": len(tasks), "results": results}
    else:
        error_msg = f"Failed to import any tasks. Errors: {errors[:3]}"
        logger.error(error_msg)
        raise Exception(error_msg)

def export_annotations(project_id: int, format: str = "JSON") -> List[Dict]:
    """
    Export annotations from Label Studio project
    
    Args:
        project_id: Label Studio project ID
        format: Export format (JSON, COCO, YOLO, etc.)
    
    Returns:
        List of annotations
    """
    params = {"export_type": format}
    response = _make_request("GET", f"/api/projects/{project_id}/export", params=params)
    
    # Label Studio export returns text, need to parse if JSON
    if format == "JSON":
        import json
        if isinstance(response, str):
            return json.loads(response)
        return response
    return response

def get_project_tasks(project_id: int, page: int = 1, page_size: int = 100) -> Dict:
    """Get tasks from Label Studio project"""
    params = {"page": page, "page_size": page_size}
    return _make_request("GET", f"/api/projects/{project_id}/tasks", params=params)

def sync_project_to_labelstudio(
    internal_project_id: str,
    project_name: str,
    project_description: str,
    images: List[Dict],
    class_names: List[str]
) -> Dict:
    """
    Sync internal project to Label Studio
    
    Args:
        internal_project_id: Internal MongoDB project ID
        project_name: Project name
        project_description: Project description
        images: List of image data with 'imageUrl' field
        class_names: List of class names for labeling
    
    Returns:
        Sync result with Label Studio project ID
    """
    try:
        # Create label config from class names
        label_options = "\n".join([f'    <Label value="{name}" background="red"/>' for name in class_names])
        label_config = f"""<View>
  <Image name="image" value="$image"/>
  <RectangleLabels name="label" toName="image">
{label_options}
  </RectangleLabels>
</View>"""
        
        # Create project in Label Studio
        ls_project = create_project(
            title=project_name,
            description=project_description,
            label_config=label_config
        )
        
        ls_project_id = ls_project.get("id")
        
        # Import tasks (images)
        tasks = []
        for img in images:
            tasks.append({
                "data": {
                    "image": img.get("imageUrl", "")
                }
            })
        
        if tasks:
            try:
                import_result = import_tasks(ls_project_id, tasks)
                logger.info(f"Imported {import_result.get('imported', 0)} tasks to Label Studio project {ls_project_id}")
            except Exception as import_error:
                logger.warning(f"Failed to import tasks to Label Studio: {import_error}")
                # Continue even if import fails - project was created successfully
                logger.warning("Project created but task import failed. You can import tasks manually later.")
        
        return {
            "ok": True,
            "labelStudioProjectId": ls_project_id,
            "internalProjectId": internal_project_id,
            "message": "Project synced to Label Studio successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to sync project to Label Studio: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise

def sync_annotations_from_labelstudio(
    project_id: int,
    internal_project_id: str
) -> List[Dict]:
    """
    Sync annotations from Label Studio back to internal system
    
    Args:
        project_id: Label Studio project ID
        internal_project_id: Internal MongoDB project ID
    
    Returns:
        List of synced annotations
    """
    try:
        # Export annotations from Label Studio
        annotations = export_annotations(project_id, format="JSON")
        
        # Transform to internal format
        synced_annotations = []
        for ann in annotations:
            # Parse Label Studio annotation format
            # Label Studio format: {"result": [{"value": {"x": 0, "y": 0, "width": 100, "height": 100, "rectanglelabels": ["class"]}}]}
            result = ann.get("result", [])
            for r in result:
                value = r.get("value", {})
                bbox = [
                    value.get("x", 0),
                    value.get("y", 0),
                    value.get("x", 0) + value.get("width", 0),
                    value.get("y", 0) + value.get("height", 0)
                ]
                labels = value.get("rectanglelabels", [])
                class_name = labels[0] if labels else "object"
                
                synced_annotations.append({
                    "imageId": ann.get("task", {}).get("id"),
                    "imageUrl": ann.get("task", {}).get("data", {}).get("image", ""),
                    "bbox": bbox,
                    "class": class_name,
                    "status": "submitted",
                    "source": "labelstudio"
                })
        
        return synced_annotations
        
    except Exception as e:
        logger.error(f"Failed to sync annotations from Label Studio: {e}")
        raise

