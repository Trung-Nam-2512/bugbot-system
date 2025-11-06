// MongoDB initialization script for Labeling Service
// Run this on MongoDB startup

db = db.getSiblingDB('iot');

// Create Labeling Projects Collection
db.createCollection('labeling_projects', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['name', 'status', 'createdAt'],
            properties: {
                name: {
                    bsonType: 'string',
                    description: 'Project name'
                },
                description: {
                    bsonType: 'string',
                    description: 'Project description'
                },
                status: {
                    bsonType: 'string',
                    enum: ['draft', 'active', 'completed', 'archived'],
                    description: 'Project status'
                },
                annotationType: {
                    bsonType: 'string',
                    enum: ['object_detection', 'classification', 'segmentation'],
                    description: 'Annotation type'
                },
                classNames: {
                    bsonType: 'array',
                    items: {
                        bsonType: 'string'
                    },
                    description: 'List of class names'
                },
                totalImages: {
                    bsonType: 'int',
                    description: 'Total images in project'
                },
                annotatedImages: {
                    bsonType: 'int',
                    description: 'Number of annotated images'
                },
                reviewedImages: {
                    bsonType: 'int',
                    description: 'Number of reviewed images'
                },
                createdAt: {
                    bsonType: 'date',
                    description: 'Creation timestamp'
                },
                updatedAt: {
                    bsonType: 'date',
                    description: 'Last update timestamp'
                },
                createdBy: {
                    bsonType: 'string',
                    description: 'User who created project'
                }
            }
        }
    }
});

// Create indexes for labeling_projects
db.labeling_projects.createIndex({ name: 1 }, { unique: true });
db.labeling_projects.createIndex({ status: 1 });
db.labeling_projects.createIndex({ createdAt: -1 });

// Create Project Images Collection
db.createCollection('project_images', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['projectId', 'imageId', 'imageUrl', 'status'],
            properties: {
                projectId: {
                    bsonType: 'objectId',
                    description: 'Reference to labeling_projects'
                },
                imageId: {
                    bsonType: 'string',
                    description: 'Image identifier'
                },
                imageUrl: {
                    bsonType: 'string',
                    description: 'Image URL in MinIO'
                },
                deviceId: {
                    bsonType: 'string',
                    description: 'Device ID'
                },
                status: {
                    bsonType: 'string',
                    enum: ['pending', 'annotating', 'reviewing', 'completed', 'rejected'],
                    description: 'Annotation status'
                },
                assignedTo: {
                    bsonType: 'string',
                    description: 'User assigned to annotate'
                },
                reviewedBy: {
                    bsonType: 'string',
                    description: 'User who reviewed'
                },
                createdAt: {
                    bsonType: 'date',
                    description: 'Creation timestamp'
                },
                updatedAt: {
                    bsonType: 'date',
                    description: 'Last update timestamp'
                }
            }
        }
    }
});

// Create indexes for project_images
db.project_images.createIndex({ projectId: 1, imageId: 1 }, { unique: true });
db.project_images.createIndex({ projectId: 1, status: 1 });
db.project_images.createIndex({ status: 1 });

// Create Annotations Collection
db.createCollection('annotations', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['projectId', 'imageId', 'annotationData', 'createdAt'],
            properties: {
                projectId: {
                    bsonType: 'objectId',
                    description: 'Reference to labeling_projects'
                },
                imageId: {
                    bsonType: 'string',
                    description: 'Image identifier'
                },
                annotationData: {
                    bsonType: 'object',
                    description: 'Annotation data (format depends on annotationType)'
                },
                annotationFormat: {
                    bsonType: 'string',
                    enum: ['coco', 'yolo', 'pascal_voc', 'custom'],
                    description: 'Annotation format'
                },
                status: {
                    bsonType: 'string',
                    enum: ['draft', 'submitted', 'approved', 'rejected'],
                    description: 'Annotation status'
                },
                annotatedBy: {
                    bsonType: 'string',
                    description: 'User who annotated'
                },
                reviewedBy: {
                    bsonType: 'string',
                    description: 'User who reviewed'
                },
                createdAt: {
                    bsonType: 'date',
                    description: 'Creation timestamp'
                },
                updatedAt: {
                    bsonType: 'date',
                    description: 'Last update timestamp'
                }
            }
        }
    }
});

// Create indexes for annotations
db.annotations.createIndex({ projectId: 1, imageId: 1 }, { unique: true });
db.annotations.createIndex({ projectId: 1, status: 1 });
db.annotations.createIndex({ status: 1 });

print('✅ Labeling Service collections created successfully');
print('   - labeling_projects');
print('   - project_images');
print('   - annotations');


