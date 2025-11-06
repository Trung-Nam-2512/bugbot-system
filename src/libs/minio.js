const Minio = require('minio');
const { logger } = require('./logger');
const crypto = require('crypto');

let minioClient;
let isConnected = false;

const BUCKET_NAME = process.env.MINIO_BUCKET || 'iot-raw';

/**
 * Initialize MinIO client
 */
async function initMinIO() {
    try {
        minioClient = new Minio.Client({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT) || 1442,
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
            secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
        });

        // Check if bucket exists, create if not
        const exists = await minioClient.bucketExists(BUCKET_NAME);
        if (!exists) {
            await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
            logger.info({ bucket: BUCKET_NAME }, 'MinIO bucket created');
        }

        isConnected = true;
        logger.info({ endpoint: process.env.MINIO_ENDPOINT, bucket: BUCKET_NAME }, '✅ MinIO client initialized');
        return true;
    } catch (error) {
        logger.error({ error: error.message }, '❌ Failed to initialize MinIO');
        return false;
    }
}

/**
 * Generate object key path for image
 * Format: raw/yyyy/mm/dd/deviceId/timestamp_shotId.jpg
 * @param {string} deviceId
 * @param {Date} timestamp
 * @param {string} shotId
 */
function generateObjectKey(deviceId, timestamp, shotId = 'na') {
    const date = new Date(timestamp);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    
    const ts = Date.now();
    const shortShot = shotId ? shotId.slice(-6) : 'na';
    
    return `raw/${yyyy}/${mm}/${dd}/${deviceId}/${ts}_${shortShot}.jpg`;
}

/**
 * Upload image buffer to MinIO
 * @param {Buffer} imageBuffer - Image data
 * @param {string} deviceId - Device identifier
 * @param {Date} timestamp - Image timestamp
 * @param {string} shotId - Shot identifier
 * @param {string} mimeType - MIME type (default: image/jpeg)
 * @returns {Promise<{objectKey: string, url: string, md5: string, size: number}>}
 */
async function uploadImage(imageBuffer, deviceId, timestamp, shotId = 'na', mimeType = 'image/jpeg') {
    if (!isConnected) {
        throw new Error('MinIO client not initialized');
    }

    try {
        const objectKey = generateObjectKey(deviceId, timestamp, shotId);
        const md5 = crypto.createHash('md5').update(imageBuffer).digest('hex');
        
        const metadata = {
            'Content-Type': mimeType,
            'X-Device-Id': deviceId,
            'X-Shot-Id': shotId,
            'X-MD5': md5,
            'X-Upload-Time': new Date().toISOString(),
        };

        await minioClient.putObject(
            BUCKET_NAME,
            objectKey,
            imageBuffer,
            imageBuffer.length,
            metadata
        );

        // Generate public URL
        const url = await getObjectUrl(objectKey);

        logger.debug({ objectKey, size: imageBuffer.length, md5 }, 'Image uploaded to MinIO');

        return {
            objectKey,
            url,
            md5,
            size: imageBuffer.length,
        };
    } catch (error) {
        logger.error({ error: error.message, deviceId }, 'Failed to upload image to MinIO');
        throw error;
    }
}

/**
 * Get presigned URL for object (7 days expiry)
 * @param {string} objectKey
 * @returns {Promise<string>}
 */
async function getObjectUrl(objectKey, expirySeconds = 7 * 24 * 60 * 60) {
    try {
        const url = await minioClient.presignedGetObject(BUCKET_NAME, objectKey, expirySeconds);
        return url;
    } catch (error) {
        logger.error({ error: error.message, objectKey }, 'Failed to generate presigned URL');
        // Return a direct URL as fallback
        const endpoint = process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_ENDPOINT || 'localhost';
        const port = process.env.MINIO_PORT || '1442';
        const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
        return `${protocol}://${endpoint}:${port}/${BUCKET_NAME}/${objectKey}`;
    }
}

/**
 * Delete object from MinIO
 * @param {string} objectKey
 */
async function deleteObject(objectKey) {
    try {
        await minioClient.removeObject(BUCKET_NAME, objectKey);
        logger.debug({ objectKey }, 'Object deleted from MinIO');
        return true;
    } catch (error) {
        logger.error({ error: error.message, objectKey }, 'Failed to delete object from MinIO');
        return false;
    }
}

/**
 * Health check for MinIO connection
 */
async function isMinIOHealthy() {
    if (!isConnected) return false;
    
    try {
        await minioClient.bucketExists(BUCKET_NAME);
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    initMinIO,
    uploadImage,
    getObjectUrl,
    deleteObject,
    isMinIOHealthy,
    BUCKET_NAME,
};

