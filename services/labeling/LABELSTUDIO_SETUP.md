# Label Studio Integration Setup Guide

## Overview

Labeling Service integrates with Label Studio for annotation workflow. This guide explains how to set up and use the integration.

## Prerequisites

1. **Label Studio Installation**
   - Install Label Studio: <https://labelstud.io/guide/install.html>
   - **Note:** Port 8080 is used by Redpanda Console. Use port 8082 instead:
   - Docker: `docker run -it -p 8082:8080 heartexlabs/label-studio:latest`
   - Access Label Studio at: <http://localhost:8082>

2. **Get API Token**
   - Login to Label Studio
   - Go to Account & Settings → Access Token
   - Copy your API token

## Configuration

Set environment variables:

```bash
# Label Studio URL (use port 8082 to avoid conflict with Redpanda Console on 8080)
export LABELSTUDIO_URL="http://localhost:8082"

# Label Studio API Token
export LABELSTUDIO_API_TOKEN="your_api_token_here"
```

Or add to `.env` file:

```env
LABELSTUDIO_URL=http://localhost:8082
LABELSTUDIO_API_TOKEN=your_api_token_here
```

**Note:** Port 8080 is already used by Redpanda Console (Kafka management UI). Use port 8082 for Label Studio.

## API Endpoints

### 1. Sync Project to Label Studio

```bash
POST /api/labelstudio/projects/{project_id}/sync?sync_images=true
```

**Request:**

- `project_id`: Internal MongoDB project ID
- `sync_images`: Whether to sync images (default: true)

**Response:**

```json
{
  "ok": true,
  "result": {
    "labelStudioProjectId": 1,
    "internalProjectId": "507f1f77bcf86cd799439011",
    "message": "Project synced to Label Studio successfully"
  }
}
```

### 2. Sync Annotations from Label Studio

```bash
POST /api/labelstudio/projects/{project_id}/sync-annotations
```

**Request:**

- `project_id`: Internal MongoDB project ID

**Response:**

```json
{
  "ok": true,
  "syncedCount": 5,
  "totalAnnotations": 5,
  "message": "Synced 5 annotations from Label Studio"
}
```

### 3. Get Label Studio Project Status

```bash
GET /api/labelstudio/projects/{project_id}/status
```

**Response:**

```json
{
  "ok": true,
  "synced": true,
  "labelStudioProjectId": 1,
  "connected": true,
  "labelStudioProject": {
    "id": 1,
    "title": "Test Project",
    "description": "Test"
  }
}
```

### 4. List Label Studio Projects

```bash
GET /api/labelstudio/projects
```

**Response:**

```json
{
  "ok": true,
  "projects": [
    {
      "id": 1,
      "title": "Project 1",
      "description": "Description"
    }
  ]
}
```

## Workflow

### Step 1: Create Project in Labeling Service

```bash
curl -X POST http://localhost:8001/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Project",
    "description": "Test project",
    "annotationType": "object_detection",
    "classNames": ["insect", "bird"]
  }'
```

### Step 2: Add Images to Project

```bash
curl -X POST http://localhost:8001/api/projects/{project_id}/images \
  -H "Content-Type: application/json" \
  -d '{
    "images": [
      {
        "imageUrl": "http://example.com/image1.jpg",
        "width": 640,
        "height": 480
      }
    ]
  }'
```

### Step 3: Sync Project to Label Studio

```bash
curl -X POST "http://localhost:8001/api/labelstudio/projects/{project_id}/sync?sync_images=true"
```

This will:

- Create a project in Label Studio
- Import all images from the project
- Configure labeling interface based on class names

### Step 4: Label in Label Studio

1. Open Label Studio: <http://localhost:8080>
2. Find your project
3. Label images with bounding boxes
4. Submit annotations

### Step 5: Sync Annotations Back

```bash
curl -X POST "http://localhost:8001/api/labelstudio/projects/{project_id}/sync-annotations"
```

This will:

- Export annotations from Label Studio
- Transform to internal format
- Save to MongoDB

### Step 6: Export Annotations

```bash
curl "http://localhost:8001/api/projects/{project_id}/export?format=coco"
```

## Label Configuration

Label Studio uses XML configuration for labeling interface. The integration automatically generates configuration based on project class names.

**Default Configuration:**

```xml
<View>
  <Image name="image" value="$image"/>
  <RectangleLabels name="label" toName="image">
    <Label value="insect" background="red"/>
    <Label value="bird" background="blue"/>
  </RectangleLabels>
</View>
```

## Troubleshooting

### Label Studio Not Connected

**Error:** `Label Studio not connected`

**Solution:**

1. Check `LABELSTUDIO_URL` is correct
2. Check `LABELSTUDIO_API_TOKEN` is valid
3. Verify Label Studio is running
4. Test connection: `curl http://localhost:8080/api/health`

### Project Sync Fails

**Error:** `Failed to sync project`

**Solution:**

1. Check project exists in MongoDB
2. Verify images have valid URLs
3. Check Label Studio API token permissions
4. Review logs for detailed error

### Annotations Not Syncing

**Error:** `Failed to sync annotations`

**Solution:**

1. Verify project is synced to Label Studio
2. Check annotations exist in Label Studio
3. Verify Label Studio export format
4. Review annotation transformation logic

## Testing

Run integration tests:

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run Label Studio integration tests
pytest tests/test_labelstudio_integration.py -v

# Run E2E tests (requires running services)
pytest tests/test_e2e_workflow.py -m e2e -v
```

## Notes

- Label Studio integration is optional - service works without it
- If Label Studio is not configured, sync endpoints return 503
- Annotations synced from Label Studio are marked with `source: "labelstudio"`
- Label Studio project ID is stored in project document as `labelStudioProjectId`
