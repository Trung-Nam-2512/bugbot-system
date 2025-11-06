/**
 * Dashboard Controller
 * API endpoints cho dashboard display (alerts, stats, real-time data)
 */

const { logger } = require('../libs/logger');
const alertRulesService = require('../services/alert-rules.service');
const { getMongoDB } = require('../libs/mongodb');
const { getClickHouseClient, isClickHouseHealthy } = require('../libs/clickhouse');
const cache = require('../libs/cache');

const CACHE_TTL = 30; // 30 seconds

/**
 * GET /api/dashboard/overview - Get dashboard overview
 * Returns: alerts summary, recent alerts, active rules, stats
 */
async function getDashboardOverview(req, res, next) {
    try {
        const cacheKey = 'dashboardOverview';
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json({ ok: true, ...cached, cached: true });
        }

        const db = getMongoDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        // Get active alerts count
        const activeAlertsCount = await db.collection('alert_history')
            .countDocuments({ status: 'active' });

        // Get recent alerts (last 10)
        const recentAlerts = await db.collection('alert_history')
            .find({ status: 'active' })
            .sort({ triggeredAt: -1 })
            .limit(10)
            .toArray();

        // Get active rules count
        const activeRules = await alertRulesService.getAllRules({ enabled: true });
        const activeRulesCount = activeRules.length;

        // Get unread notifications count
        const unreadNotifications = await db.collection('in_app_notifications')
            .countDocuments({ read: false });

        // Get alerts by severity
        const alertsBySeverity = await db.collection('alert_history')
            .aggregate([
                {
                    $match: { status: 'active' },
                },
                {
                    $group: {
                        _id: '$severity',
                        count: { $sum: 1 },
                    },
                },
            ])
            .toArray();

        const severityBreakdown = alertsBySeverity.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, { info: 0, warning: 0, critical: 0 });

        const overview = {
            alerts: {
                active: activeAlertsCount,
                recent: recentAlerts,
                bySeverity: severityBreakdown,
            },
            rules: {
                active: activeRulesCount,
            },
            notifications: {
                unread: unreadNotifications,
            },
            timestamp: new Date().toISOString(),
        };

        cache.set(cacheKey, overview, CACHE_TTL);
        return res.json({ ok: true, ...overview, cached: false });
    } catch (error) {
        logger.error({ error: error.message }, 'Error in getDashboardOverview');
        next(error);
    }
}

/**
 * GET /api/dashboard/alerts/recent - Get recent alerts for dashboard
 */
async function getRecentAlerts(req, res, next) {
    try {
        const { limit = 10, severity, deviceId } = req.query;
        const cacheKey = `recentAlerts_${limit}_${severity || 'all'}_${deviceId || 'all'}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json({ ok: true, ...cached, cached: true });
        }

        const db = getMongoDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const query = { status: 'active' };
        if (severity) {
            query.severity = severity;
        }
        if (deviceId) {
            query.deviceId = deviceId;
        }

        const alerts = await db.collection('alert_history')
            .find(query)
            .sort({ triggeredAt: -1 })
            .limit(parseInt(limit, 10))
            .toArray();

        const result = {
            alerts,
            count: alerts.length,
            timestamp: new Date().toISOString(),
        };

        cache.set(cacheKey, result, CACHE_TTL / 2); // Shorter cache for recent alerts
        return res.json({ ok: true, ...result, cached: false });
    } catch (error) {
        logger.error({ error: error.message }, 'Error in getRecentAlerts');
        next(error);
    }
}

/**
 * GET /api/dashboard/alerts/summary - Get alerts summary for dashboard
 */
async function getAlertsSummary(req, res, next) {
    try {
        const cacheKey = 'alertsSummary';
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json({ ok: true, ...cached, cached: true });
        }

        const db = getMongoDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        // Get counts by status
        const [active, acknowledged, resolved] = await Promise.all([
            db.collection('alert_history').countDocuments({ status: 'active' }),
            db.collection('alert_history').countDocuments({ status: 'acknowledged' }),
            db.collection('alert_history').countDocuments({ status: 'resolved' }),
        ]);

        // Get counts by severity
        const severityCounts = await db.collection('alert_history')
            .aggregate([
                {
                    $match: { status: 'active' },
                },
                {
                    $group: {
                        _id: '$severity',
                        count: { $sum: 1 },
                    },
                },
            ])
            .toArray();

        const bySeverity = severityCounts.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, { info: 0, warning: 0, critical: 0 });

        // Get alerts by device (top 5)
        const topDevices = await db.collection('alert_history')
            .aggregate([
                {
                    $match: { status: 'active' },
                },
                {
                    $group: {
                        _id: '$deviceId',
                        count: { $sum: 1 },
                    },
                },
                {
                    $sort: { count: -1 },
                },
                {
                    $limit: 5,
                },
            ])
            .toArray();

        const summary = {
            byStatus: {
                active,
                acknowledged,
                resolved,
                total: active + acknowledged + resolved,
            },
            bySeverity,
            topDevices: topDevices.map(item => ({
                deviceId: item._id,
                alertCount: item.count,
            })),
            timestamp: new Date().toISOString(),
        };

        cache.set(cacheKey, summary, CACHE_TTL);
        return res.json({ ok: true, ...summary, cached: false });
    } catch (error) {
        logger.error({ error: error.message }, 'Error in getAlertsSummary');
        next(error);
    }
}

/**
 * GET /api/dashboard/rules/active - Get active alert rules for dashboard
 */
async function getActiveRules(req, res, next) {
    try {
        const rules = await alertRulesService.getAllRules({ enabled: true });
        return res.json({
            ok: true,
            rules,
            count: rules.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Error in getActiveRules');
        next(error);
    }
}

/**
 * GET /api/dashboard/stats - Get dashboard statistics
 * Combines alerts stats với detection stats
 */
async function getDashboardStats(req, res, next) {
    try {
        const cacheKey = 'dashboardStats';
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json({ ok: true, ...cached, cached: true });
        }

        const db = getMongoDB();
        const clickhouse = getClickHouseClient();
        const isClickHouseReady = await isClickHouseHealthy();

        const stats = {
            alerts: {},
            detections: {},
            timestamp: new Date().toISOString(),
        };

        // Alerts stats
        if (db) {
            const [activeAlerts, totalAlerts] = await Promise.all([
                db.collection('alert_history').countDocuments({ status: 'active' }),
                db.collection('alert_history').countDocuments({}),
            ]);

            stats.alerts = {
                active: activeAlerts,
                total: totalAlerts,
            };
        }

        // Detection stats (from ClickHouse)
        if (clickhouse && isClickHouseReady) {
            try {
                // Get total detections
                const detectionsResult = await clickhouse.query({
                    query: `
                        SELECT 
                            COUNT(*) as total,
                            SUM(detection_count) as total_detections,
                            AVG(detection_count) as avg_detections
                        FROM iot.events_enriched
                        WHERE detection_count > 0
                    `,
                    format: 'JSONEachRow',
                });

                const detectionsData = await detectionsResult.json();
                if (detectionsData.length > 0) {
                    stats.detections = {
                        totalImages: parseInt(detectionsData[0].total || 0, 10),
                        totalDetections: parseInt(detectionsData[0].total_detections || 0, 10),
                        avgDetections: parseFloat(detectionsData[0].avg_detections || 0),
                    };
                }
            } catch (error) {
                logger.warn({ error: error.message }, 'Failed to get detection stats');
            }
        }

        cache.set(cacheKey, stats, CACHE_TTL);
        return res.json({ ok: true, ...stats, cached: false });
    } catch (error) {
        logger.error({ error: error.message }, 'Error in getDashboardStats');
        next(error);
    }
}

module.exports = {
    getDashboardOverview,
    getRecentAlerts,
    getAlertsSummary,
    getActiveRules,
    getDashboardStats,
};


