const express = require('express');
const multer = require('multer');
const { uploadImage } = require('../controllers/upload.controller');

const router = express.Router();

// Use memoryStorage -> receive file in req.file.buffer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 8 * 1024 * 1024, // 8MB max
    },
    fileFilter: (req, file, cb) => {
        // Accept all file types for now
        cb(null, true);
    }
});

/**
 * POST /api/upload
 * Upload image from ESP32-CAM device
 * 
 * Expected form-data:
 * - file: image file (required)
 * - deviceId: device identifier (required)
 * - ts: timestamp (required)
 * - extra: JSON string with additional metadata (optional)
 * 
 * Expected headers:
 * - x-shot-id: unique shot identifier (optional)
 * - x-signature: HMAC signature for verification (optional)
 * - x-firmware-version: firmware version (optional)
 */
router.post('/', upload.single('file'), uploadImage);

module.exports = router;

