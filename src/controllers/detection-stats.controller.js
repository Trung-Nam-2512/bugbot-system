/**
 * Detection Statistics Controller
 * 
 * Controller cho detection statistics endpoints từ enriched events
 * Phase 3: Dashboard & Alert System
 */

const { logger } = require('../libs/logger');
const {
    getOverallDetectionStats,
    getSpeciesDistribution,
    getConfidenceDistribution,
    getDetectionTimeline,
} = require('../services/detection-stats.service');
const cache = require('../libs/cache');

/**
 * Get overall detection statistics
 * GET /api/stats/detections
 */
async function getDetectionsStats(req, res, next) {
    try {
        // Check cache first (30 seconds)
        const cacheKey = 'stats:detections:overall';
        const cached = cache.get(cacheKey);

        if (cached) {
            logger.debug('Detection stats served from cache');
            return res.json({
                ok: true,
                ...cached,
                cached: true,
            });
        }

        const stats = await getOverallDetectionStats();

        // Cache result (30 seconds)
        cache.set(cacheKey, stats, 30 * 1000);

        res.json({
            ok: true,
            ...stats,
            cached: false,
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Error getting detection stats');
        next(error);
    }
}

/**
 * Get species distribution
 * GET /api/stats/species?deviceId=optional
 */
async function getSpeciesStats(req, res, next) {
    try {
        const { deviceId } = req.query;

        // Check cache first (30 seconds)
        const cacheKey = `stats:detections:species:${deviceId || 'all'}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            logger.debug({ deviceId }, 'Species stats served from cache');
            return res.json({
                ok: true,
                ...cached,
                cached: true,
            });
        }

        const result = await getSpeciesDistribution(deviceId || null);

        // Cache result (30 seconds)
        cache.set(cacheKey, result, 30 * 1000);

        res.json({
            ok: true,
            ...result,
            cached: false,
        });
    } catch (error) {
        logger.error({ error: error.message, deviceId: req.query.deviceId }, 'Error getting species stats');
        next(error);
    }
}

/**
 * Get confidence distribution
 * GET /api/stats/confidence?deviceId=optional
 */
async function getConfidenceStats(req, res, next) {
    try {
        const { deviceId } = req.query;

        // Check cache first (30 seconds)
        const cacheKey = `stats:detections:confidence:${deviceId || 'all'}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            logger.debug({ deviceId }, 'Confidence stats served from cache');
            return res.json({
                ok: true,
                ...cached,
                cached: true,
            });
        }

        const result = await getConfidenceDistribution(deviceId || null);

        // Cache result (30 seconds)
        cache.set(cacheKey, result, 30 * 1000);

        res.json({
            ok: true,
            ...result,
            cached: false,
        });
    } catch (error) {
        logger.error({ error: error.message, deviceId: req.query.deviceId }, 'Error getting confidence stats');
        next(error);
    }
}

/**
 * Get detection timeline
 * GET /api/stats/detections/timeline?period=day|week|month&deviceId=optional
 */
async function getDetectionsTimeline(req, res, next) {
    try {
        const { period = 'day', deviceId } = req.query;

        // Validate period
        if (!['day', 'week', 'month'].includes(period)) {
            return res.status(400).json({
                ok: false,
                error: 'invalid_period',
                message: 'Period must be: day, week, or month',
            });
        }

        // Check cache first (30 seconds)
        const cacheKey = `stats:detections:timeline:${period}:${deviceId || 'all'}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            logger.debug({ period, deviceId }, 'Timeline stats served from cache');
            return res.json({
                ok: true,
                ...cached,
                cached: true,
            });
        }

        const result = await getDetectionTimeline(period, deviceId || null);

        // Cache result (30 seconds)
        cache.set(cacheKey, result, 30 * 1000);

        res.json({
            ok: true,
            ...result,
            cached: false,
        });
    } catch (error) {
        logger.error({ error: error.message, period: req.query.period, deviceId: req.query.deviceId }, 'Error getting timeline stats');
        next(error);
    }
}

module.exports = {
    getDetectionsStats,
    getSpeciesStats,
    getConfidenceStats,
    getDetectionsTimeline,
};


