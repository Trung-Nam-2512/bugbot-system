"""
End-to-end workflow tests
Tests complete workflow from project creation to annotation export
"""

import pytest
import os
import sys
import requests
import time

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.getenv("LABELING_SERVICE_URL", "http://localhost:8001")

class TestE2EWorkflow:
    """End-to-end workflow tests"""
    
    @pytest.fixture
    def test_project_id(self):
        """Create a test project and return its ID"""
        project_data = {
            "name": f"E2E Test Project {int(time.time())}",
            "description": "E2E test project",
            "annotationType": "object_detection",
            "classNames": ["insect", "bird", "animal"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json=project_data,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            project_id = data.get("project", {}).get("_id") or data.get("project", {}).get("id")
            yield project_id
            
            # Cleanup: delete project
            try:
                requests.delete(f"{BASE_URL}/api/projects/{project_id}", timeout=5)
            except:
                pass
        else:
            pytest.skip(f"Failed to create test project: {response.status_code}")
    
    @pytest.mark.e2e
    def test_create_project_workflow(self):
        """Test creating a project"""
        project_data = {
            "name": f"E2E Create Test {int(time.time())}",
            "description": "Test project creation",
            "annotationType": "object_detection",
            "classNames": ["insect"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json=project_data,
            timeout=10
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("ok") is True or "project" in data
        
        # Cleanup
        if "project" in data:
            project_id = data["project"].get("_id") or data["project"].get("id")
            if project_id:
                try:
                    requests.delete(f"{BASE_URL}/api/projects/{project_id}", timeout=5)
                except:
                    pass
    
    @pytest.mark.e2e
    def test_add_images_workflow(self, test_project_id):
        """Test adding images to project"""
        images_data = {
            "images": [
                {
                    "imageUrl": "http://example.com/test1.jpg",
                    "width": 640,
                    "height": 480
                },
                {
                    "imageUrl": "http://example.com/test2.jpg",
                    "width": 800,
                    "height": 600
                }
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{test_project_id}/images",
            json=images_data,
            timeout=10
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("ok") is True or "images" in data
    
    @pytest.mark.e2e
    def test_create_annotation_workflow(self, test_project_id):
        """Test creating annotation"""
        # First, add an image
        images_data = {
            "images": [{
                "imageUrl": "http://example.com/annotate_test.jpg",
                "width": 640,
                "height": 480
            }]
        }
        
        img_response = requests.post(
            f"{BASE_URL}/api/projects/{test_project_id}/images",
            json=images_data,
            timeout=10
        )
        
        if img_response.status_code not in [200, 201]:
            pytest.skip("Failed to add image for annotation test")
        
        img_data = img_response.json()
        images = img_data.get("images", [])
        if not images:
            pytest.skip("No images added")
        
        image_id = images[0].get("_id") or images[0].get("id")
        
        # Create annotation
        annotation_data = {
            "imageId": image_id,
            "annotationData": {
                "bbox": [10, 20, 100, 150],
                "class": "insect",
                "category": "insect"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{test_project_id}/annotations",
            json=annotation_data,
            timeout=10
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("ok") is True or "annotation" in data
    
    @pytest.mark.e2e
    def test_export_annotations_workflow(self, test_project_id):
        """Test exporting annotations"""
        # First, create annotation
        images_data = {
            "images": [{
                "imageUrl": "http://example.com/export_test.jpg",
                "width": 640,
                "height": 480
            }]
        }
        
        img_response = requests.post(
            f"{BASE_URL}/api/projects/{test_project_id}/images",
            json=images_data,
            timeout=10
        )
        
        if img_response.status_code in [200, 201]:
            img_data = img_response.json()
            images = img_data.get("images", [])
            if images:
                image_id = images[0].get("_id") or images[0].get("id")
                
                annotation_data = {
                    "imageId": image_id,
                    "annotationData": {
                        "bbox": [10, 20, 100, 150],
                        "class": "insect"
                    },
                    "status": "approved"
                }
                
                requests.post(
                    f"{BASE_URL}/api/projects/{test_project_id}/annotations",
                    json=annotation_data,
                    timeout=10
                )
        
        # Export annotations
        response = requests.get(
            f"{BASE_URL}/api/projects/{test_project_id}/export",
            params={"format": "coco"},
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("ok") is True
        assert data.get("format") == "coco"
        assert "data" in data
    
    @pytest.mark.e2e
    @pytest.mark.skipif(
        not os.getenv("LABELSTUDIO_API_TOKEN"),
        reason="Label Studio not configured"
    )
    def test_labelstudio_sync_workflow(self, test_project_id):
        """Test Label Studio sync workflow"""
        # Sync project to Label Studio
        response = requests.post(
            f"{BASE_URL}/api/labelstudio/projects/{test_project_id}/sync",
            params={"sync_images": True},
            timeout=30
        )
        
        # Should work if Label Studio is configured, or return 503 if not
        assert response.status_code in [200, 503], f"Expected 200 or 503, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("ok") is True
            
            # Check status
            status_response = requests.get(
                f"{BASE_URL}/api/labelstudio/projects/{test_project_id}/status",
                timeout=10
            )
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                assert status_data.get("ok") is True

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-m", "e2e"])

