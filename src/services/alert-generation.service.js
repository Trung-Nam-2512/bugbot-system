/**
 * Alert Generation Service
 * Tạo alerts và lưu vào database, trigger notifications
 */

const { getDB } = require('../libs/mongodb');
const { insertAlert } = require('../libs/clickhouse');
const { logger } = require('../libs/logger');
const notificationService = require('./notification.service');

/**
 * Generate and store alert
 */
async function generateAlert(alertData) {
    try {
        const {
            ruleId,
            ruleName,
            deviceId,
            severity,
            message,
            metadata = {},
            triggeredAt,
        } = alertData;

        // Generate unique alert ID
        const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Store in MongoDB (for quick access)
        const db = getDB();
        if (db) {
            const { ObjectId } = require('mongodb');
            
            const alertDoc = {
                alertId,
                ruleId: new ObjectId(ruleId),
                ruleName,
                deviceId,
                severity,
                message,
                metadata,
                status: 'active',
                triggeredAt: triggeredAt || new Date(),
                acknowledgedAt: null,
                acknowledgedBy: null,
                resolvedAt: null,
                resolvedBy: null,
            };

            await db.collection('alert_history').insertOne(alertDoc);
            logger.debug({ alertId, ruleName }, 'Alert stored in MongoDB');
        }

        // Store in ClickHouse (for analytics)
        try {
            await insertAlert({
                alert_id: alertId,
                rule_id: ruleId,
                rule_name: ruleName,
                device_id: deviceId,
                severity,
                message,
                triggered_at: triggeredAt || new Date(),
                acknowledged_at: null,
                acknowledged_by: '',
                resolved_at: null,
                resolved_by: '',
                status: 'active',
                metadata: JSON.stringify(metadata),
            });
            logger.debug({ alertId }, 'Alert stored in ClickHouse');
        } catch (error) {
            logger.warn({ error: error.message, alertId }, 'Failed to store alert in ClickHouse');
            // Continue even if ClickHouse fails
        }

        // Trigger notifications
        await triggerNotifications(alertData);

        logger.info(
            {
                alertId,
                ruleName,
                deviceId,
                severity,
            },
            'Alert generated successfully'
        );

        return {
            alertId,
            ...alertData,
            status: 'active',
        };
    } catch (error) {
        logger.error({ error: error.message, alertData }, 'Failed to generate alert');
        throw error;
    }
}

/**
 * Trigger notifications for alert
 */
async function triggerNotifications(alertData) {
    try {
        // Get notification channels from rule
        const alertRulesService = require('./alert-rules.service');
        const rule = await alertRulesService.getRuleById(alertData.ruleId);

        if (!rule || !rule.notificationChannels || rule.notificationChannels.length === 0) {
            logger.debug('No notification channels configured for rule');
            return;
        }

        // Send notifications through each channel
        for (const channel of rule.notificationChannels) {
            try {
                switch (channel.type) {
                    case 'email':
                        await notificationService.sendEmail(channel.config, alertData);
                        break;
                    case 'webhook':
                        await notificationService.sendWebhook(channel.config, alertData);
                        break;
                    case 'in_app':
                        await notificationService.sendInApp(alertData);
                        break;
                    default:
                        logger.warn({ type: channel.type }, 'Unknown notification channel type');
                }
            } catch (error) {
                logger.error(
                    { error: error.message, channel: channel.type },
                    'Failed to send notification'
                );
                // Continue with other channels
            }
        }
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to trigger notifications');
        // Don't throw - alert should still be created
    }
}

/**
 * Acknowledge alert
 */
async function acknowledgeAlert(alertId, acknowledgedBy) {
    try {
        const db = getDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const now = new Date();
        
        const result = await db.collection('alert_history').updateOne(
            { alertId },
            {
                $set: {
                    status: 'acknowledged',
                    acknowledgedAt: now,
                    acknowledgedBy,
                },
            }
        );

        if (result.matchedCount === 0) {
            return null;
        }

        logger.info({ alertId, acknowledgedBy }, 'Alert acknowledged');
        return true;
    } catch (error) {
        logger.error({ error: error.message, alertId }, 'Failed to acknowledge alert');
        throw error;
    }
}

/**
 * Resolve alert
 */
async function resolveAlert(alertId, resolvedBy) {
    try {
        const db = getDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const now = new Date();
        
        const result = await db.collection('alert_history').updateOne(
            { alertId },
            {
                $set: {
                    status: 'resolved',
                    resolvedAt: now,
                    resolvedBy,
                },
            }
        );

        if (result.matchedCount === 0) {
            return null;
        }

        logger.info({ alertId, resolvedBy }, 'Alert resolved');
        return true;
    } catch (error) {
        logger.error({ error: error.message, alertId }, 'Failed to resolve alert');
        throw error;
    }
}

module.exports = {
    generateAlert,
    acknowledgeAlert,
    resolveAlert,
};

