"""
Test Label Studio Integration
Comprehensive tests for Label Studio synchronization
"""

import pytest
import os
import sys
from unittest.mock import Mock, patch, MagicMock
from bson import ObjectId

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from libs.labelstudio_client import (
    init_labelstudio,
    create_project,
    sync_project_to_labelstudio,
    sync_annotations_from_labelstudio,
    is_connected
)
from controllers.labelstudio_controller import (
    sync_project_to_labelstudio_endpoint,
    sync_annotations_from_labelstudio_endpoint,
    get_labelstudio_project_status
)

class TestLabelStudioClient:
    """Test Label Studio client functions"""
    
    def test_init_labelstudio_no_token(self):
        """Test initialization without API token"""
        with patch.dict(os.environ, {"LABELSTUDIO_URL": "http://localhost:8080", "LABELSTUDIO_API_TOKEN": ""}):
            result = init_labelstudio()
            assert result is False
    
    @patch('libs.labelstudio_client.requests.get')
    def test_init_labelstudio_success(self, mock_get):
        """Test successful initialization"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response
        
        with patch.dict(os.environ, {
            "LABELSTUDIO_URL": "http://localhost:8080",
            "LABELSTUDIO_API_TOKEN": "test_token"
        }):
            result = init_labelstudio()
            assert result is True
            assert is_connected is True
    
    @patch('libs.labelstudio_client._make_request')
    def test_create_project(self, mock_request):
        """Test creating a project in Label Studio"""
        mock_request.return_value = {"id": 1, "title": "Test Project"}
        
        result = create_project("Test Project", "Test Description")
        
        assert result["id"] == 1
        assert result["title"] == "Test Project"
        mock_request.assert_called_once()
    
    @patch('libs.labelstudio_client.create_project')
    @patch('libs.labelstudio_client.import_tasks')
    def test_sync_project_to_labelstudio(self, mock_import, mock_create):
        """Test syncing project to Label Studio"""
        mock_create.return_value = {"id": 1}
        mock_import.return_value = {"imported": 5}
        
        result = sync_project_to_labelstudio(
            internal_project_id="507f1f77bcf86cd799439011",
            project_name="Test Project",
            project_description="Test",
            images=[
                {"imageUrl": "http://example.com/image1.jpg"},
                {"imageUrl": "http://example.com/image2.jpg"}
            ],
            class_names=["insect", "bird"]
        )
        
        assert result["ok"] is True
        assert result["labelStudioProjectId"] == 1
        mock_create.assert_called_once()
        mock_import.assert_called_once()

class TestLabelStudioController:
    """Test Label Studio controller functions"""
    
    @pytest.mark.asyncio
    @patch('controllers.labelstudio_controller.get_database')
    @patch('controllers.labelstudio_controller.sync_project_to_labelstudio')
    @patch('controllers.labelstudio_controller.ls_is_connected', True)
    async def test_sync_project_endpoint_success(self, mock_sync, mock_db):
        """Test successful project sync"""
        # Mock database
        mock_db_instance = MagicMock()
        mock_project = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "name": "Test Project",
            "description": "Test",
            "classNames": ["insect"]
        }
        mock_db_instance.labeling_projects.find_one.return_value = mock_project
        mock_db_instance.project_images.find.return_value = []
        mock_db_instance.labeling_projects.update_one.return_value = None
        mock_db.return_value = mock_db_instance
        
        # Mock sync function
        mock_sync.return_value = {
            "ok": True,
            "labelStudioProjectId": 1,
            "internalProjectId": "507f1f77bcf86cd799439011"
        }
        
        result = await sync_project_to_labelstudio_endpoint(
            "507f1f77bcf86cd799439011",
            sync_images=True
        )
        
        assert result["ok"] is True
        assert "result" in result
    
    @pytest.mark.asyncio
    @patch('controllers.labelstudio_controller.ls_is_connected', False)
    async def test_sync_project_endpoint_not_connected(self):
        """Test sync when Label Studio is not connected"""
        result = await sync_project_to_labelstudio_endpoint(
            "507f1f77bcf86cd799439011"
        )
        
        assert isinstance(result, type(Mock(status_code=503))) or result.status_code == 503
    
    @pytest.mark.asyncio
    @patch('controllers.labelstudio_controller.get_database')
    @patch('controllers.labelstudio_controller.sync_annotations_from_labelstudio')
    @patch('controllers.labelstudio_controller.ls_is_connected', True)
    async def test_sync_annotations_endpoint_success(self, mock_sync, mock_db):
        """Test successful annotation sync"""
        # Mock database
        mock_db_instance = MagicMock()
        mock_project = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "labelStudioProjectId": 1
        }
        mock_db_instance.labeling_projects.find_one.return_value = mock_project
        mock_db_instance.annotations.find_one.return_value = None
        mock_db_instance.annotations.insert_one.return_value = None
        mock_db.return_value = mock_db_instance
        
        # Mock sync function
        mock_sync.return_value = [
            {
                "imageId": "1",
                "imageUrl": "http://example.com/image1.jpg",
                "bbox": [10, 20, 100, 150],
                "class": "insect",
                "status": "submitted"
            }
        ]
        
        result = await sync_annotations_from_labelstudio_endpoint(
            "507f1f77bcf86cd799439011"
        )
        
        assert result["ok"] is True
        assert result["syncedCount"] > 0

class TestLabelStudioIntegrationE2E:
    """End-to-end integration tests (require Label Studio running)"""
    
    @pytest.mark.integration
    def test_labelstudio_connection(self):
        """Test Label Studio connection (requires running instance)"""
        # Skip if Label Studio not configured
        if not os.getenv("LABELSTUDIO_API_TOKEN"):
            pytest.skip("Label Studio not configured")
        
        result = init_labelstudio()
        assert result is True
    
    @pytest.mark.integration
    def test_create_project_in_labelstudio(self):
        """Test creating project in Label Studio (requires running instance)"""
        if not os.getenv("LABELSTUDIO_API_TOKEN"):
            pytest.skip("Label Studio not configured")
        
        init_labelstudio()
        if not is_connected:
            pytest.skip("Label Studio not connected")
        
        result = create_project(
            "Test Project",
            "Test Description",
            label_config=None
        )
        
        assert "id" in result
        assert result["title"] == "Test Project"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])

