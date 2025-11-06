const { processUpload } = require('../services/upload.service');
const { safeValidateUploadRequest } = require('../schemas/eventRaw.schema');
const { logger } = require('../libs/logger');

/**
 * Controller for handling image upload from ESP32-CAM devices
 * POST /api/upload
 */
async function uploadImage(req, res, next) {
    try {
        const file = req.file; // multer memoryStorage -> buffer/size/mimetype
        
        // Validate request body
        const validation = safeValidateUploadRequest(req.body);
        if (!validation.success) {
            return res.status(400).json({
                ok: false,
                error: 'validation_error',
                details: validation.error,
            });
        }

        const { deviceId, ts, extra } = validation.data;
        const shotId = req.get('x-shot-id') || '';
        const signature = req.get('x-signature') || '';
        const firmwareVersion = req.get('x-firmware-version') || 'unknown';

        // Validate file
        if (!file || !file.buffer || !file.size) {
            return res.status(400).json({
                ok: false,
                error: 'missing_file',
                message: 'Image file is required',
            });
        }

        // Get client IP
        const xf = req.headers['x-forwarded-for'];
        const ipAddress = typeof xf === 'string' && xf.length
            ? xf.split(',')[0].trim()
            : (req.socket && req.socket.remoteAddress) || '';

        // Process upload with streaming architecture
        const result = await processUpload({
            fileBuffer: file.buffer,
            deviceId,
            ts,
            shotId,
            signature,
            extraRaw: extra,
            mimetype: file.mimetype || 'image/jpeg',
            ipAddress,
            firmwareVersion,
        });

        // Handle duplicate or stale images
        if (result.duplicate) {
            return res.status(204).end(); // No content - duplicate
        }

        if (result.stale) {
            return res.status(204).end(); // No content - stale
        }

        // Return success response
        return res.json(result);
    } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'Upload controller error');
        next(error);
    }
}

module.exports = {
    uploadImage,
};

