const { createClient } = require('@clickhouse/client');
const { logger } = require('./logger');

let clickhouseClient;
let isConnected = false;

/**
 * Initialize ClickHouse client
 */
async function initClickHouse() {
    try {
        clickhouseClient = createClient({
            host: process.env.CLICKHOUSE_HOST || 'http://localhost:1443',
            username: process.env.CLICKHOUSE_USER || 'default',
            password: process.env.CLICKHOUSE_PASSWORD || 'clickhouse123',
            database: process.env.CLICKHOUSE_DATABASE || 'iot',
            request_timeout: 30000,
            max_open_connections: 10,
        });

        // Test connection
        const result = await clickhouseClient.query({
            query: 'SELECT 1 as ping',
            format: 'JSONEachRow',
        });

        const data = await result.json();

        if (data && data.length > 0) {
            isConnected = true;
            logger.info({ host: process.env.CLICKHOUSE_HOST }, '✅ ClickHouse client connected');
            return true;
        }

        throw new Error('ClickHouse ping failed');
    } catch (error) {
        logger.error({ error: error.message }, '❌ Failed to connect to ClickHouse');
        return false;
    }
}

/**
 * Insert event into events_raw table
 * @param {object} event - Event data
 */
async function insertEvent(event) {
    if (!isConnected) {
        throw new Error('ClickHouse client not connected');
    }

    try {
        // Convert timestamps to Date objects và format cho ClickHouse
        const formatTimestamp = (dt) => {
            if (!dt) return null;
            const date = dt instanceof Date ? dt : new Date(dt);
            // Format: YYYY-MM-DD HH:MM:SS.mmm (ClickHouse DateTime64 format)
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            const seconds = String(date.getUTCSeconds()).padStart(2, '0');
            const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
        };

        // Format event với timestamps đúng format
        const timestampStr = formatTimestamp(event.timestamp);
        const receivedAtStr = formatTimestamp(event.received_at || new Date());

        // Dùng query với parameters (reliable hơn JSONEachRow với Date objects)
        const query = `
            INSERT INTO iot.events_raw (
                device_id,
                timestamp,
                shot_id,
                image_url,
                image_size,
                image_md5,
                mime_type,
                firmware_version,
                ip_address,
                extra,
                received_at
            ) VALUES (
                {device_id: String},
                {timestamp: DateTime64(3)},
                {shot_id: String},
                {image_url: String},
                {image_size: UInt64},
                {image_md5: String},
                {mime_type: String},
                {firmware_version: String},
                {ip_address: String},
                {extra: String},
                {received_at: DateTime64(3)}
            )
        `;

        await clickhouseClient.command({
            query,
            query_params: {
                device_id: event.device_id,
                timestamp: timestampStr,
                shot_id: event.shot_id || '',
                image_url: event.image_url,
                image_size: parseInt(event.image_size || 0, 10),
                image_md5: event.image_md5 || '',
                mime_type: event.mime_type || 'image/jpeg',
                firmware_version: event.firmware_version || '',
                ip_address: event.ip_address || '',
                extra: event.extra || '',
                received_at: receivedAtStr,
            },
        });

        logger.debug({ device_id: event.device_id }, 'Event inserted into ClickHouse');
        return true;
    } catch (error) {
        logger.error({ error: error.message, event }, 'Failed to insert event into ClickHouse');
        throw error;
    }
}

/**
 * Insert batch of events
 * @param {Array<object>} events - Array of events
 */
async function insertBatch(events) {
    if (!isConnected) {
        throw new Error('ClickHouse client not connected');
    }

    try {
        await clickhouseClient.insert({
            table: 'iot.events_raw',
            values: events,
            format: 'JSONEachRow',
        });

        logger.debug({ count: events.length }, 'Batch events inserted into ClickHouse');
        return true;
    } catch (error) {
        logger.error({ error: error.message, count: events.length }, 'Failed to insert batch into ClickHouse');
        throw error;
    }
}

/**
 * Query events from ClickHouse
 * @param {string} deviceId - Optional device filter
 * @param {Date} startDate - Start date filter
 * @param {Date} endDate - End date filter
 * @param {number} limit - Max number of results
 */
async function queryEvents(deviceId = null, startDate = null, endDate = null, limit = 100) {
    if (!isConnected) {
        throw new Error('ClickHouse client not connected');
    }

    try {
        let query = 'SELECT * FROM iot.events_raw WHERE 1=1';
        const params = {};

        if (deviceId) {
            query += ' AND device_id = {device_id: String}';
            params.device_id = deviceId;
        }

        if (startDate) {
            query += ' AND timestamp >= {start_date: DateTime64(3)}';
            params.start_date = startDate;
        }

        if (endDate) {
            query += ' AND timestamp <= {end_date: DateTime64(3)}';
            params.end_date = endDate;
        }

        query += ' ORDER BY timestamp DESC';
        query += ` LIMIT ${limit}`;

        const result = await clickhouseClient.query({
            query,
            query_params: params,
            format: 'JSONEachRow',
        });

        const data = await result.json();
        return data;
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to query events from ClickHouse');
        throw error;
    }
}

/**
 * Get statistics for a device
 * @param {string} deviceId
 * @param {number} days - Number of days to look back
 */
async function getDeviceStats(deviceId, days = 7) {
    if (!isConnected) {
        throw new Error('ClickHouse client not connected');
    }

    try {
        // Get overall stats (không limit by days để có total)
        const overallQuery = `
            SELECT
                device_id,
                count() as total_images,
                sum(image_size) as total_size,
                avg(image_size) as avg_size,
                min(timestamp) as first_seen,
                max(timestamp) as last_seen,
                uniq(shot_id) as unique_shots
            FROM iot.events_raw
            WHERE device_id = {device_id: String}
            GROUP BY device_id
        `;

        const overallResult = await clickhouseClient.query({
            query: overallQuery,
            query_params: { device_id: deviceId },
            format: 'JSONEachRow',
        });

        const overallData = await overallResult.json();
        const overall = overallData[0];

        if (!overall) {
            return {
                total_images: 0,
                lastImage: null,
                averageSize: 0,
                last7Days: [],
            };
        }

        // Get last 7 days data
        const formatTimestamp = (dt) => {
            const date = dt instanceof Date ? dt : new Date(dt);
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            const seconds = String(date.getUTCSeconds()).padStart(2, '0');
            const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
        };

        const daysAgo = new Date();
        daysAgo.setUTCDate(daysAgo.getUTCDate() - days);
        daysAgo.setUTCHours(0, 0, 0, 0);

        const dailyQuery = `
            SELECT
                toDate(timestamp) as date,
                count() as count
            FROM iot.events_raw
            WHERE device_id = {device_id: String}
                AND timestamp >= {start_date: DateTime64(3)}
            GROUP BY date
            ORDER BY date DESC
        `;

        const dailyResult = await clickhouseClient.query({
            query: dailyQuery,
            query_params: {
                device_id: deviceId,
                start_date: formatTimestamp(daysAgo),
            },
            format: 'JSONEachRow',
        });

        const dailyData = await dailyResult.json();

        // Format last 7 days
        const last7Days = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setUTCDate(date.getUTCDate() - i);
            date.setUTCHours(0, 0, 0, 0);
            const dateStr = date.toISOString().split('T')[0];

            const dayData = dailyData.find(d => d.date === dateStr);
            last7Days.push({
                date: dateStr,
                count: dayData ? parseInt(dayData.count || 0, 10) : 0,
            });
        }

        return {
            total_images: parseInt(overall.total_images || 0, 10),
            lastImage: overall.last_seen || null,
            averageSize: parseFloat(overall.avg_size || 0),
            last7Days,
        };
    } catch (error) {
        logger.error({ error: error.message, deviceId }, 'Failed to get device stats from ClickHouse');
        throw error;
    }
}

/**
 * Health check for ClickHouse connection
 */
async function isClickHouseHealthy() {
    if (!isConnected) return false;

    try {
        const result = await clickhouseClient.query({
            query: 'SELECT 1 as ping',
            format: 'JSONEachRow',
        });
        const data = await result.json();
        return data && data.length > 0;
    } catch {
        return false;
    }
}

/**
 * Close ClickHouse connection
 */
async function closeClickHouse() {
    if (clickhouseClient) {
        await clickhouseClient.close();
        isConnected = false;
        logger.info('ClickHouse client closed');
    }
}

/**
 * Insert enriched event into events_enriched table
 * @param {object} event - Enriched event data
 */
async function insertEnrichedEvent(event) {
    if (!isConnected) {
        throw new Error('ClickHouse client not connected');
    }

    try {
        // Convert timestamps to Date objects và format cho ClickHouse
        const formatTimestamp = (dt) => {
            if (!dt) return null;
            const date = dt instanceof Date ? dt : new Date(dt);
            // Format: YYYY-MM-DD HH:MM:SS.mmm (ClickHouse DateTime64 format)
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            const seconds = String(date.getUTCSeconds()).padStart(2, '0');
            const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
        };

        // Format event với timestamps đúng format
        const timestampStr = formatTimestamp(event.timestamp);
        const processedAtStr = formatTimestamp(event.processed_at || new Date());
        const receivedAtStr = formatTimestamp(event.received_at || new Date());

        // Dùng query với parameters
        const query = `
            INSERT INTO iot.events_enriched (
                device_id,
                timestamp,
                shot_id,
                image_url,
                annotated_image_url,
                detection_count,
                detections,
                processing_time_ms,
                processed_at,
                inference_model,
                inference_version,
                received_at
            ) VALUES (
                {device_id: String},
                {timestamp: DateTime64(3)},
                {shot_id: String},
                {image_url: String},
                {annotated_image_url: String},
                {detection_count: UInt32},
                {detections: String},
                {processing_time_ms: UInt32},
                {processed_at: DateTime64(3)},
                {inference_model: String},
                {inference_version: String},
                {received_at: DateTime64(3)}
            )
        `;

        await clickhouseClient.command({
            query,
            query_params: {
                device_id: event.device_id,
                timestamp: timestampStr,
                shot_id: event.shot_id || '',
                image_url: event.image_url || '',
                annotated_image_url: event.annotated_image_url || '',
                detection_count: parseInt(event.detection_count || 0, 10),
                detections: event.detections || '[]',
                processing_time_ms: parseInt(event.processing_time_ms || 0, 10),
                processed_at: processedAtStr,
                inference_model: event.inference_model || 'yolov8n',
                inference_version: event.inference_version || '1.0.0',
                received_at: receivedAtStr,
            },
        });

        logger.debug({ device_id: event.device_id, detection_count: event.detection_count }, 'Enriched event inserted to ClickHouse');
    } catch (error) {
        logger.error({ error: error.message, event }, 'Failed to insert enriched event to ClickHouse');
        throw error;
    }
}

/**
 * Query aggregations từ ClickHouse
 * @param {string} windowType - 'hourly' hoặc 'daily'
 * @param {string} deviceId - Optional device filter
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 */
async function queryAggregations(windowType = 'hourly', deviceId = null, startDate = null, endDate = null) {
    if (!isConnected) {
        throw new Error('ClickHouse client not connected');
    }

    try {
        let query;
        const params = {};

        if (windowType === 'hourly') {
            query = 'SELECT * FROM iot.events_hourly WHERE 1=1';
        } else if (windowType === 'daily') {
            query = 'SELECT * FROM iot.device_stats_daily WHERE 1=1';
        } else {
            throw new Error(`Invalid windowType: ${windowType}. Must be 'hourly' or 'daily'`);
        }

        if (deviceId) {
            query += ' AND device_id = {device_id: String}';
            params.device_id = deviceId;
        }

        if (startDate) {
            query += ` AND processing_date >= toDate({start_date: DateTime64(3)})`;
            params.start_date = startDate;
        }

        if (endDate) {
            query += ` AND processing_date <= toDate({end_date: DateTime64(3)})`;
            params.end_date = endDate;
        }

        query += ' ORDER BY processing_date DESC, device_id LIMIT 1000';

        const result = await clickhouseClient.query({
            query,
            query_params: params,
            format: 'JSONEachRow',
        });

        return await result.json();
    } catch (error) {
        logger.error({ error: error.message, windowType, deviceId }, 'Failed to query aggregations');
        throw error;
    }
}

/**
 * Insert alert into ClickHouse
 */
async function insertAlert(alert) {
    if (!isConnected) {
        throw new Error('ClickHouse client not connected');
    }

    try {
        // Format timestamps cho ClickHouse
        const formatTimestamp = (dt) => {
            if (!dt) return null;
            const date = dt instanceof Date ? dt : new Date(dt);
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            const seconds = String(date.getUTCSeconds()).padStart(2, '0');
            const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
        };

        const triggeredAtStr = formatTimestamp(alert.triggered_at || new Date());
        const acknowledgedAtStr = alert.acknowledged_at ? formatTimestamp(alert.acknowledged_at) : null;
        const resolvedAtStr = alert.resolved_at ? formatTimestamp(alert.resolved_at) : null;
        const createdAtStr = formatTimestamp(alert.created_at || new Date());

        const query = `
            INSERT INTO iot.alerts (
                alert_id,
                rule_id,
                rule_name,
                device_id,
                severity,
                message,
                triggered_at,
                acknowledged_at,
                acknowledged_by,
                resolved_at,
                resolved_by,
                status,
                metadata,
                created_at
            ) VALUES (
                {alert_id: String},
                {rule_id: String},
                {rule_name: String},
                {device_id: String},
                {severity: String},
                {message: String},
                {triggered_at: DateTime64(3)},
                {acknowledged_at: Nullable(DateTime64(3))},
                {acknowledged_by: String},
                {resolved_at: Nullable(DateTime64(3))},
                {resolved_by: String},
                {status: String},
                {metadata: String},
                {created_at: DateTime64(3)}
            )
        `;

        await clickhouseClient.command({
            query,
            query_params: {
                alert_id: alert.alert_id,
                rule_id: alert.rule_id || '',
                rule_name: alert.rule_name || '',
                device_id: alert.device_id || '',
                severity: alert.severity || 'info',
                message: alert.message || '',
                triggered_at: triggeredAtStr,
                acknowledged_at: acknowledgedAtStr,
                acknowledged_by: alert.acknowledged_by || '',
                resolved_at: resolvedAtStr,
                resolved_by: alert.resolved_by || '',
                status: alert.status || 'active',
                metadata: alert.metadata || '{}',
                created_at: createdAtStr,
            },
        });

        logger.debug({ alert_id: alert.alert_id, device_id: alert.device_id }, 'Alert inserted to ClickHouse');
    } catch (error) {
        logger.error({ error: error.message, alert }, 'Failed to insert alert to ClickHouse');
        throw error;
    }
}

module.exports = {
    initClickHouse,
    insertEvent,
    insertBatch,
    insertEnrichedEvent,
    queryEvents,
    getDeviceStats,
    queryAggregations,
    insertAlert,
    isClickHouseHealthy,
    closeClickHouse,
    // Export client for advanced queries
    get clickhouseClient() {
        return clickhouseClient;
    },
    // Also export as function for compatibility
    getClickHouseClient() {
        if (!isConnected || !clickhouseClient) {
            throw new Error('ClickHouse client not initialized');
        }
        return clickhouseClient;
    },
};

