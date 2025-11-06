/**
 * Alerts Controller
 * API endpoints cho alert management
 */

const { logger } = require('../libs/logger');
const alertRulesService = require('../services/alert-rules.service');
const alertGenerationService = require('../services/alert-generation.service');
const { getMongoDB } = require('../libs/mongodb');
const cache = require('../libs/cache');

const CACHE_TTL = 30; // 30 seconds

/**
 * GET /api/alerts/rules - Get all alert rules
 */
async function getAlertRules(req, res, next) {
    try {
        const { enabled, deviceId } = req.query;
        const filters = {};
        if (enabled !== undefined) {
            filters.enabled = enabled === 'true';
        }
        if (deviceId) {
            filters.deviceId = deviceId;
        }

        const rules = await alertRulesService.getAllRules(filters);
        return res.json({
            ok: true,
            rules,
            count: rules.length,
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Error in getAlertRules');
        next(error);
    }
}

/**
 * GET /api/alerts/rules/:id - Get alert rule by ID
 */
async function getAlertRule(req, res, next) {
    try {
        const { id } = req.params;
        const rule = await alertRulesService.getRuleById(id);
        
        if (!rule) {
            return res.status(404).json({
                ok: false,
                error: 'not_found',
                message: 'Alert rule not found',
            });
        }

        return res.json({
            ok: true,
            rule,
        });
    } catch (error) {
        logger.error({ error: error.message, id: req.params.id }, 'Error in getAlertRule');
        next(error);
    }
}

/**
 * POST /api/alerts/rules - Create new alert rule
 */
async function createAlertRule(req, res, next) {
    try {
        const ruleData = req.body;
        
        // Validate required fields
        if (!ruleData.name || !ruleData.conditions || !ruleData.severity) {
            return res.status(400).json({
                ok: false,
                error: 'validation_error',
                message: 'Missing required fields: name, conditions, severity',
            });
        }

        const rule = await alertRulesService.createRule(ruleData);
        
        // Clear cache
        try {
            cache.delete('alertRules');
        } catch (e) {
            // Cache clear failed, continue anyway
        }
        
        return res.status(201).json({
            ok: true,
            rule,
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Error in createAlertRule');
        next(error);
    }
}

/**
 * PUT /api/alerts/rules/:id - Update alert rule
 */
async function updateAlertRule(req, res, next) {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const rule = await alertRulesService.updateRule(id, updates);
        
        if (!rule) {
            return res.status(404).json({
                ok: false,
                error: 'not_found',
                message: 'Alert rule not found',
            });
        }

        // Clear cache
        try {
            cache.delete('alertRules');
        } catch (e) {
            // Cache clear failed, continue anyway
        }
        
        return res.json({
            ok: true,
            rule,
        });
    } catch (error) {
        logger.error({ error: error.message, id: req.params.id }, 'Error in updateAlertRule');
        next(error);
    }
}

/**
 * DELETE /api/alerts/rules/:id - Delete alert rule
 */
async function deleteAlertRule(req, res, next) {
    try {
        const { id } = req.params;
        const deleted = await alertRulesService.deleteRule(id);
        
        if (!deleted) {
            return res.status(404).json({
                ok: false,
                error: 'not_found',
                message: 'Alert rule not found',
            });
        }

        // Clear cache
        try {
            cache.delete('alertRules');
        } catch (e) {
            // Cache clear failed, continue anyway
        }
        
        return res.json({
            ok: true,
            message: 'Alert rule deleted',
        });
    } catch (error) {
        logger.error({ error: error.message, id: req.params.id }, 'Error in deleteAlertRule');
        next(error);
    }
}

/**
 * GET /api/alerts - Get alert history
 */
async function getAlerts(req, res, next) {
    try {
        const db = getMongoDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const {
            page = 1,
            limit = 20,
            status,
            severity,
            deviceId,
            ruleId,
        } = req.query;

        const query = {};
        if (status) {
            query.status = status;
        }
        if (severity) {
            query.severity = severity;
        }
        if (deviceId) {
            query.deviceId = deviceId;
        }
        if (ruleId) {
            const { ObjectId } = require('mongodb');
            query.ruleId = new ObjectId(ruleId);
        }

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        
        const [alerts, total] = await Promise.all([
            db.collection('alert_history')
                .find(query)
                .sort({ triggeredAt: -1 })
                .skip(skip)
                .limit(parseInt(limit, 10))
                .toArray(),
            db.collection('alert_history').countDocuments(query),
        ]);

        return res.json({
            ok: true,
            alerts,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total,
                totalPages: Math.ceil(total / parseInt(limit, 10)),
            },
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Error in getAlerts');
        next(error);
    }
}

/**
 * GET /api/alerts/:id - Get alert by ID
 */
async function getAlert(req, res, next) {
    try {
        const db = getMongoDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const { id } = req.params;
        const alert = await db.collection('alert_history').findOne({ alertId: id });
        
        if (!alert) {
            return res.status(404).json({
                ok: false,
                error: 'not_found',
                message: 'Alert not found',
            });
        }

        return res.json({
            ok: true,
            alert,
        });
    } catch (error) {
        logger.error({ error: error.message, id: req.params.id }, 'Error in getAlert');
        next(error);
    }
}

/**
 * POST /api/alerts/:id/acknowledge - Acknowledge alert
 */
async function acknowledgeAlert(req, res, next) {
    try {
        const { id } = req.params;
        const { acknowledgedBy = 'system' } = req.body;
        
        const result = await alertGenerationService.acknowledgeAlert(id, acknowledgedBy);
        
        if (!result) {
            return res.status(404).json({
                ok: false,
                error: 'not_found',
                message: 'Alert not found',
            });
        }

        return res.json({
            ok: true,
            message: 'Alert acknowledged',
        });
    } catch (error) {
        logger.error({ error: error.message, id: req.params.id }, 'Error in acknowledgeAlert');
        next(error);
    }
}

/**
 * POST /api/alerts/:id/resolve - Resolve alert
 */
async function resolveAlert(req, res, next) {
    try {
        const { id } = req.params;
        const { resolvedBy = 'system' } = req.body;
        
        const result = await alertGenerationService.resolveAlert(id, resolvedBy);
        
        if (!result) {
            return res.status(404).json({
                ok: false,
                error: 'not_found',
                message: 'Alert not found',
            });
        }

        return res.json({
            ok: true,
            message: 'Alert resolved',
        });
    } catch (error) {
        logger.error({ error: error.message, id: req.params.id }, 'Error in resolveAlert');
        next(error);
    }
}

/**
 * GET /api/alerts/stats - Get alert statistics
 */
async function getAlertStats(req, res, next) {
    try {
        const cacheKey = 'alertStats';
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json({ ok: true, ...cached, cached: true });
        }

        const db = getMongoDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const [total, active, acknowledged, resolved, bySeverity] = await Promise.all([
            db.collection('alert_history').countDocuments({}),
            db.collection('alert_history').countDocuments({ status: 'active' }),
            db.collection('alert_history').countDocuments({ status: 'acknowledged' }),
            db.collection('alert_history').countDocuments({ status: 'resolved' }),
            db.collection('alert_history').aggregate([
                {
                    $group: {
                        _id: '$severity',
                        count: { $sum: 1 },
                    },
                },
            ]).toArray(),
        ]);

        const stats = {
            total,
            active,
            acknowledged,
            resolved,
            bySeverity: bySeverity.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
        };

        cache.set(cacheKey, stats, CACHE_TTL);
        return res.json({ ok: true, ...stats, cached: false });
    } catch (error) {
        logger.error({ error: error.message }, 'Error in getAlertStats');
        next(error);
    }
}

module.exports = {
    getAlertRules,
    getAlertRule,
    createAlertRule,
    updateAlertRule,
    deleteAlertRule,
    getAlerts,
    getAlert,
    acknowledgeAlert,
    resolveAlert,
    getAlertStats,
};

