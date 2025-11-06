"""
Unit tests for controllers
Tests for projects, images, and annotations controllers
"""

import pytest
import os
import sys
from unittest.mock import Mock, patch, MagicMock
from bson import ObjectId
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from controllers.projects_controller import (
    create_project,
    get_projects,
    get_project,
    update_project,
    delete_project,
    ProjectCreate
)
from controllers.images_controller import (
    add_images_to_project,
    get_project_images,
    get_image
)
from controllers.annotations_controller import (
    create_annotation,
    get_annotation,
    update_annotation,
    get_project_annotations
)

class TestProjectsController:
    """Test projects controller"""
    
    @pytest.mark.asyncio
    @patch('controllers.projects_controller.get_database')
    async def test_create_project_success(self, mock_db):
        """Test successful project creation"""
        mock_db_instance = MagicMock()
        mock_db_instance.labeling_projects.find_one.return_value = None
        mock_db_instance.labeling_projects.insert_one.return_value = MagicMock(
            inserted_id=ObjectId("507f1f77bcf86cd799439011")
        )
        mock_db.return_value = mock_db_instance
        
        project_data = ProjectCreate(
            name="Test Project",
            description="Test Description",
            annotationType="object_detection",
            classNames=["insect", "bird"]
        )
        
        result = await create_project(project_data)
        
        assert result["ok"] is True
        assert "project" in result
        assert result["project"]["name"] == "Test Project"
    
    @pytest.mark.asyncio
    @patch('controllers.projects_controller.get_database')
    async def test_create_project_duplicate_name(self, mock_db):
        """Test creating project with duplicate name"""
        mock_db_instance = MagicMock()
        mock_db_instance.labeling_projects.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439012"),
            "name": "Test Project"
        }
        mock_db.return_value = mock_db_instance
        
        project_data = ProjectCreate(
            name="Test Project",
            description="Test",
            annotationType="object_detection",
            classNames=["insect"]
        )
        
        result = await create_project(project_data)
        
        # Should return JSONResponse with 400 status
        assert hasattr(result, 'status_code') or result.get("detail") == "Project name already exists"
    
    @pytest.mark.asyncio
    @patch('controllers.projects_controller.get_database')
    async def test_get_projects(self, mock_db):
        """Test getting list of projects"""
        mock_db_instance = MagicMock()
        mock_projects = [
            {
                "_id": ObjectId("507f1f77bcf86cd799439011"),
                "name": "Project 1",
                "status": "active"
            },
            {
                "_id": ObjectId("507f1f77bcf86cd799439012"),
                "name": "Project 2",
                "status": "active"
            }
        ]
        mock_db_instance.labeling_projects.find.return_value = mock_projects
        mock_db.return_value = mock_db_instance
        
        result = await get_projects()
        
        # Result might be JSONResponse or dict
        if hasattr(result, 'status_code'):
            # It's a JSONResponse, check content
            assert result.status_code == 200
        else:
            assert result["ok"] is True
            assert "projects" in result or "count" in result

class TestImagesController:
    """Test images controller"""
    
    @pytest.mark.asyncio
    @patch('controllers.images_controller.get_database')
    async def test_add_images_to_project(self, mock_db):
        """Test adding images to project"""
        mock_db_instance = MagicMock()
        mock_db_instance.labeling_projects.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "name": "Test Project"
        }
        mock_db_instance.project_images.insert_many.return_value = MagicMock(
            inserted_ids=[ObjectId("507f1f77bcf86cd799439021"), ObjectId("507f1f77bcf86cd799439022")]
        )
        mock_db.return_value = mock_db_instance
        
        images_data = {
            "images": [
                {
                    "imageUrl": "http://example.com/image1.jpg",
                    "width": 640,
                    "height": 480
                },
                {
                    "imageUrl": "http://example.com/image2.jpg",
                    "width": 640,
                    "height": 480
                }
            ]
        }
        
        result = await add_images_to_project(
            "507f1f77bcf86cd799439011",
            images_data["images"]
        )
        
        assert result["ok"] is True
        assert "images" in result

class TestAnnotationsController:
    """Test annotations controller"""
    
    @pytest.mark.asyncio
    @patch('controllers.annotations_controller.get_database')
    async def test_create_annotation(self, mock_db):
        """Test creating annotation"""
        mock_db_instance = MagicMock()
        mock_db_instance.project_images.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439021"),
            "imageUrl": "http://example.com/image1.jpg",
            "projectId": ObjectId("507f1f77bcf86cd799439011")
        }
        mock_db_instance.annotations.insert_one.return_value = MagicMock(
            inserted_id=ObjectId("507f1f77bcf86cd799439031")
        )
        mock_db.return_value = mock_db_instance
        
        annotation_data = {
            "imageId": "507f1f77bcf86cd799439021",
            "annotationData": {
                "bbox": [10, 20, 100, 150],
                "class": "insect"
            }
        }
        
        result = await create_annotation(
            "507f1f77bcf86cd799439011",
            annotation_data
        )
        
        assert result["ok"] is True
        assert "annotation" in result

if __name__ == "__main__":
    pytest.main([__file__, "-v"])

