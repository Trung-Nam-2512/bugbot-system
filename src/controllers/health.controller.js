const { isKafkaHealthy } = require('../libs/kafka');
const { isMinIOHealthy } = require('../libs/minio');
const { isClickHouseHealthy } = require('../libs/clickhouse');
const { isMongoDBHealthy } = require('../libs/mongodb');
const { logger } = require('../libs/logger');
const { isStreamProcessorHealthy, getStreamProcessorStats } = require('../services/stream-processor.service');
const mqtt = require('../services/mqtt.service');

/**
 * Health check endpoint
 * GET /api/health
 */
async function healthCheck(req, res) {
    const startTime = Date.now();
    
    try {
        // Check all services in parallel
        const [kafka, minio, clickhouse, mongodb] = await Promise.all([
            isKafkaHealthy(),
            isMinIOHealthy(),
            isClickHouseHealthy(),
            isMongoDBHealthy(),
        ]);

        const mqttEnabled = process.env.MQTT_ENABLED === 'true';
        const mqttConnected = mqttEnabled ? mqtt.isConnected() : true;

        const services = {
            kafka: { healthy: kafka, status: kafka ? 'connected' : 'disconnected' },
            minio: { healthy: minio, status: minio ? 'connected' : 'disconnected' },
            clickhouse: { healthy: clickhouse, status: clickhouse ? 'connected' : 'disconnected' },
            mongodb: { healthy: mongodb, status: mongodb ? 'connected' : 'disconnected' },
            mqtt: { healthy: mqttConnected, status: mqttEnabled ? (mqttConnected ? 'connected' : 'disconnected') : 'disabled' },
        };

        const allHealthy = kafka && minio && clickhouse && mongodb && mqttConnected;
        const responseTime = Date.now() - startTime;

        const response = {
            ok: allHealthy,
            status: allHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            responseTime,
            services,
            architecture: 'streaming-first',
            version: '2.0.0',
        };

        // Return 503 if not all services are healthy
        const statusCode = allHealthy ? 200 : 503;
        
        if (!allHealthy) {
            logger.warn({ services }, 'Health check failed - some services unhealthy');
        }

        return res.status(statusCode).json(response);
    } catch (error) {
        logger.error({ error: error.message }, 'Health check error');
        return res.status(503).json({
            ok: false,
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
}

/**
 * Liveness probe - simple check
 * GET /api/health/live
 */
function livenessProbe(req, res) {
    res.json({
        ok: true,
        status: 'alive',
        timestamp: new Date().toISOString(),
    });
}

/**
 * Readiness probe - check if ready to accept traffic
 * GET /api/health/ready
 */
async function readinessProbe(req, res) {
    try {
        const [kafka, mongodb] = await Promise.all([
            isKafkaHealthy(),
            isMongoDBHealthy(),
        ]);

        const ready = kafka && mongodb;

        if (ready) {
            return res.json({
                ok: true,
                status: 'ready',
                timestamp: new Date().toISOString(),
            });
        } else {
            return res.status(503).json({
                ok: false,
                status: 'not_ready',
                services: { kafka, mongodb },
                timestamp: new Date().toISOString(),
            });
        }
    } catch (error) {
        return res.status(503).json({
            ok: false,
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
}

/**
 * Stream processor stats endpoint
 * GET /api/health/stream-processor
 */
async function streamProcessorStats(req, res) {
    try {
        const stats = getStreamProcessorStats();
        const healthy = isStreamProcessorHealthy();

        return res.status(healthy ? 200 : 503).json({
            ok: healthy,
            stats: stats || {},
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Stream processor stats error');
        return res.status(500).json({
            ok: false,
            error: 'internal_server_error',
            message: error.message,
        });
    }
}

module.exports = {
    healthCheck,
    livenessProbe,
    readinessProbe,
    streamProcessorStats,
};

