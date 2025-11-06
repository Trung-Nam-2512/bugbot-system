// MongoDB initialization script
// Create database and collections with indexes

db = db.getSiblingDB('iot');

// Users collection
db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ createdAt: -1 });

// Devices collection
db.createCollection('devices');
db.devices.createIndex({ deviceId: 1 }, { unique: true });
db.devices.createIndex({ userId: 1 });
db.devices.createIndex({ status: 1 });
db.devices.createIndex({ lastSeen: -1 });

// Jobs collection (for async processing tasks)
db.createCollection('jobs');
db.jobs.createIndex({ status: 1, createdAt: -1 });
db.jobs.createIndex({ deviceId: 1, createdAt: -1 });
db.jobs.createIndex({ type: 1, status: 1 });

// Activity logs collection
db.createCollection('activity_logs');
db.activity_logs.createIndex({ deviceId: 1, timestamp: -1 });
db.activity_logs.createIndex({ eventType: 1, timestamp: -1 });
db.activity_logs.createIndex({ timestamp: -1 });
// TTL index - auto delete logs older than 30 days
db.activity_logs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

// System configuration
db.createCollection('config');
db.config.createIndex({ key: 1 }, { unique: true });

// Insert default config
db.config.insertOne({
    key: 'system',
    value: {
        version: '2.0.0',
        architecture: 'streaming-first',
        features: ['kafka', 'minio', 'clickhouse', 'mongodb']
    },
    createdAt: new Date(),
    updatedAt: new Date()
});

// Insert sample device for testing
db.devices.insertOne({
    deviceId: 'ESP32_001',
    name: 'ESP32-CAM Test Device',
    type: 'ESP32-CAM',
    status: 'active',
    firmwareVersion: '1.0.0',
    userId: null,
    metadata: {
        location: 'Lab',
        description: 'Test device for development'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSeen: new Date()
});

print('MongoDB initialization completed successfully');

