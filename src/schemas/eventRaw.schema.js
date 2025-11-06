const { z } = require('zod');

/**
 * Schema for raw event that will be published to Kafka
 */
const EventRawSchema = z.object({
    event_id: z.string().uuid().optional(),
    device_id: z.string().min(1).max(100),
    timestamp: z.date().or(z.string().datetime()).or(z.number()),
    shot_id: z.string().max(100).default(''),
    image_url: z.string().url(),
    image_size: z.number().int().positive(),
    image_md5: z.string().length(32),
    mime_type: z.string().default('image/jpeg'),
    firmware_version: z.string().max(50).default('unknown'),
    ip_address: z.string().ip().or(z.string()).default(''),
    extra: z.string().or(z.object({}).passthrough()).default('{}'),
    received_at: z.date().or(z.string().datetime()).optional(),
});

/**
 * Schema for upload request body
 */
const UploadRequestSchema = z.object({
    deviceId: z.string().min(1, 'deviceId is required'),
    ts: z.number().or(z.string()).transform((val) => {
        if (typeof val === 'string') {
            const num = Number(val);
            if (isNaN(num)) {
                throw new Error('Invalid timestamp');
            }
            return num;
        }
        return val;
    }),
    extra: z.string().optional().default(''),
});

/**
 * Schema for device metadata
 */
const DeviceMetadataSchema = z.object({
    deviceId: z.string(),
    name: z.string().optional(),
    type: z.string().default('ESP32-CAM'),
    firmwareVersion: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
});

/**
 * Validate and parse event data
 * @param {object} data
 * @returns {object} Validated data
 */
function validateEventRaw(data) {
    return EventRawSchema.parse(data);
}

/**
 * Safe validation that returns error instead of throwing
 * @param {object} data
 * @returns {{ success: boolean, data?: object, error?: object }}
 */
function safeValidateEventRaw(data) {
    const result = EventRawSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error.format() };
}

/**
 * Validate upload request
 * @param {object} data
 * @returns {object} Validated data
 */
function validateUploadRequest(data) {
    return UploadRequestSchema.parse(data);
}

/**
 * Safe validation for upload request
 * @param {object} data
 * @returns {{ success: boolean, data?: object, error?: object }}
 */
function safeValidateUploadRequest(data) {
    const result = UploadRequestSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error.format() };
}

module.exports = {
    EventRawSchema,
    UploadRequestSchema,
    DeviceMetadataSchema,
    validateEventRaw,
    safeValidateEventRaw,
    validateUploadRequest,
    safeValidateUploadRequest,
};

