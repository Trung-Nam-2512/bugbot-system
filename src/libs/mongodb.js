const { MongoClient } = require('mongodb');
const { logger } = require('./logger');

let mongoClient;
let database;
let isConnected = false;

/**
 * Initialize MongoDB connection
 */
async function initMongoDB() {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://root:mongodb123@localhost:1445';
        const dbName = process.env.MONGO_DATABASE || 'iot';

        mongoClient = new MongoClient(uri, {
            maxPoolSize: 10,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        await mongoClient.connect();
        database = mongoClient.db(dbName);
        isConnected = true;

        logger.info({ database: dbName }, '✅ MongoDB connected');
        return true;
    } catch (error) {
        logger.error({ error: error.message }, '❌ Failed to connect to MongoDB');
        return false;
    }
}

/**
 * Get database instance
 */
function getDB() {
    if (!database) {
        throw new Error('MongoDB not initialized. Call initMongoDB() first.');
    }
    return database;
}

/**
 * Get collection
 * @param {string} collectionName
 */
function getCollection(collectionName) {
    return getDB().collection(collectionName);
}

/**
 * Insert document
 * @param {string} collectionName
 * @param {object} document
 */
async function insertOne(collectionName, document) {
    try {
        const collection = getCollection(collectionName);
        const result = await collection.insertOne({
            ...document,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        return result;
    } catch (error) {
        logger.error({ error: error.message, collection: collectionName }, 'Failed to insert document');
        throw error;
    }
}

/**
 * Insert multiple documents
 * @param {string} collectionName
 * @param {Array<object>} documents
 */
async function insertMany(collectionName, documents) {
    try {
        const collection = getCollection(collectionName);
        const now = new Date();
        const docsWithTimestamps = documents.map(doc => ({
            ...doc,
            createdAt: now,
            updatedAt: now,
        }));
        const result = await collection.insertMany(docsWithTimestamps);
        return result;
    } catch (error) {
        logger.error({ error: error.message, collection: collectionName }, 'Failed to insert documents');
        throw error;
    }
}

/**
 * Find documents
 * @param {string} collectionName
 * @param {object} query
 * @param {object} options
 */
async function find(collectionName, query = {}, options = {}) {
    try {
        const collection = getCollection(collectionName);
        const cursor = collection.find(query, options);
        return await cursor.toArray();
    } catch (error) {
        logger.error({ error: error.message, collection: collectionName }, 'Failed to find documents');
        throw error;
    }
}

/**
 * Find one document
 * @param {string} collectionName
 * @param {object} query
 */
async function findOne(collectionName, query) {
    try {
        const collection = getCollection(collectionName);
        return await collection.findOne(query);
    } catch (error) {
        logger.error({ error: error.message, collection: collectionName }, 'Failed to find document');
        throw error;
    }
}

/**
 * Update document
 * @param {string} collectionName
 * @param {object} query
 * @param {object} update
 */
async function updateOne(collectionName, query, update) {
    try {
        const collection = getCollection(collectionName);
        const result = await collection.updateOne(query, {
            $set: {
                ...update,
                updatedAt: new Date(),
            },
        });
        return result;
    } catch (error) {
        logger.error({ error: error.message, collection: collectionName }, 'Failed to update document');
        throw error;
    }
}

/**
 * Delete document
 * @param {string} collectionName
 * @param {object} query
 */
async function deleteOne(collectionName, query) {
    try {
        const collection = getCollection(collectionName);
        return await collection.deleteOne(query);
    } catch (error) {
        logger.error({ error: error.message, collection: collectionName }, 'Failed to delete document');
        throw error;
    }
}

/**
 * Log activity to MongoDB
 * @param {string} deviceId
 * @param {string} eventType
 * @param {object} metadata
 */
async function logActivity(deviceId, eventType, metadata = {}) {
    try {
        await insertOne('activity_logs', {
            deviceId,
            eventType,
            metadata,
            timestamp: new Date(),
        });
    } catch (error) {
        logger.error({ error: error.message, deviceId, eventType }, 'Failed to log activity');
    }
}

/**
 * Update device last seen
 * @param {string} deviceId
 */
async function updateDeviceLastSeen(deviceId) {
    try {
        const collection = getCollection('devices');
        await collection.updateOne(
            { deviceId },
            {
                $set: { lastSeen: new Date(), updatedAt: new Date() },
                $setOnInsert: { deviceId, createdAt: new Date() },
            },
            { upsert: true }
        );
    } catch (error) {
        logger.error({ error: error.message, deviceId }, 'Failed to update device last seen');
    }
}

/**
 * Health check for MongoDB connection
 */
async function isMongoDBHealthy() {
    if (!isConnected || !mongoClient) return false;
    
    try {
        await mongoClient.db('admin').admin().ping();
        return true;
    } catch {
        return false;
    }
}

/**
 * Close MongoDB connection
 */
async function closeMongoDB() {
    if (mongoClient) {
        await mongoClient.close();
        isConnected = false;
        logger.info('MongoDB connection closed');
    }
}

/**
 * Get MongoDB database instance (alias for getDB)
 */
function getMongoDB() {
    return getDB();
}

module.exports = {
    initMongoDB,
    getDB,
    getMongoDB,
    getCollection,
    insertOne,
    insertMany,
    find,
    findOne,
    updateOne,
    deleteOne,
    logActivity,
    updateDeviceLastSeen,
    isMongoDBHealthy,
    closeMongoDB,
};

