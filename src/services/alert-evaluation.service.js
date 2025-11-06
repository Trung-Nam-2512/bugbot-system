/**
 * Alert Evaluation Service
 * Đánh giá enriched events và trigger alerts khi điều kiện thỏa mãn
 */

const alertRulesService = require('./alert-rules.service');
const { logger } = require('../libs/logger');

/**
 * Evaluate detection data against alert rules
 * @param {Object} detectionData - Detection data từ enriched event
 * @param {Object} detectionData.device_id - Device ID
 * @param {Object} detectionData.detection_count - Number of detections
 * @param {Object} detectionData.detections - Array of detection objects
 * @param {Object} detectionData.timestamp - Event timestamp
 * @returns {Array} Array of triggered alerts
 */
async function evaluateDetectionData(detectionData) {
    try {
        const { device_id, detection_count = 0, detections = [], timestamp } = detectionData;

        if (!device_id) {
            logger.warn('Missing device_id in detection data');
            return [];
        }

        // Get enabled rules (device-specific or global)
        const rules = await alertRulesService.getEnabledRules();
        
        if (rules.length === 0) {
            return [];
        }

        const triggeredAlerts = [];

        for (const rule of rules) {
            // Check if rule applies to this device
            if (rule.conditions.deviceId && rule.conditions.deviceId !== device_id) {
                continue;
            }

            // Evaluate rule conditions
            const shouldTrigger = evaluateRule(rule, {
                device_id,
                detection_count,
                detections,
                timestamp,
            });

            if (shouldTrigger) {
                // Check cooldown period
                const inCooldown = await checkCooldown(rule, device_id, timestamp);
                if (!inCooldown) {
                    triggeredAlerts.push({
                        ruleId: rule._id.toString(),
                        ruleName: rule.name,
                        deviceId: device_id,
                        severity: rule.severity,
                        message: generateAlertMessage(rule, detectionData),
                        metadata: {
                            detection_count,
                            detections_count: detections.length,
                            conditions: rule.conditions,
                        },
                        triggeredAt: timestamp || new Date(),
                    });
                }
            }
        }

        if (triggeredAlerts.length > 0) {
            logger.info(
                { device_id, alertCount: triggeredAlerts.length },
                'Alerts triggered for device'
            );
        }

        return triggeredAlerts;
    } catch (error) {
        logger.error({ error: error.message, detectionData }, 'Failed to evaluate detection data');
        throw error;
    }
}

/**
 * Evaluate single rule against detection data
 */
function evaluateRule(rule, data) {
    const { conditions } = rule;
    const { detection_count, detections } = data;

    switch (conditions.type) {
        case 'detection_count':
            return compareValue(detection_count, conditions.operator, conditions.value);

        case 'confidence':
            if (!detections || detections.length === 0) {
                return false;
            }
            // Check if any detection has confidence >= threshold
            const maxConfidence = Math.max(...detections.map(d => d.confidence || 0));
            return compareValue(maxConfidence, conditions.operator, conditions.value);

        case 'species':
            if (!detections || detections.length === 0) {
                return false;
            }
            const detectedSpecies = detections.map(d => d.class?.toLowerCase() || '');
            const targetSpecies = Array.isArray(conditions.species)
                ? conditions.species.map(s => s.toLowerCase())
                : [conditions.value.toLowerCase()];
            
            if (conditions.operator === 'in' || conditions.operator === '==') {
                return targetSpecies.some(s => detectedSpecies.includes(s));
            } else if (conditions.operator === 'not_in' || conditions.operator === '!=') {
                return !targetSpecies.some(s => detectedSpecies.includes(s));
            }
            return false;

        default:
            logger.warn({ type: conditions.type }, 'Unknown condition type');
            return false;
    }
}

/**
 * Compare value với operator
 */
function compareValue(value, operator, threshold) {
    switch (operator) {
        case '>':
            return value > threshold;
        case '<':
            return value < threshold;
        case '>=':
            return value >= threshold;
        case '<=':
            return value <= threshold;
        case '==':
            return value === threshold;
        case '!=':
            return value !== threshold;
        default:
            logger.warn({ operator }, 'Unknown operator');
            return false;
    }
}

/**
 * Check cooldown period to prevent duplicate alerts
 */
async function checkCooldown(rule, deviceId, currentTime) {
    try {
        const { getDB } = require('../libs/mongodb');
        const db = getDB();
        if (!db) {
            return false; // No cooldown check if MongoDB unavailable
        }

        const cooldownPeriod = rule.cooldownPeriod || 300; // Default 5 minutes
        const cooldownStart = new Date(currentTime.getTime() - cooldownPeriod * 1000);

        // Check if similar alert was triggered recently
        const recentAlert = await db.collection('alert_history').findOne({
            ruleId: rule._id,
            deviceId: deviceId,
            triggeredAt: { $gte: cooldownStart },
            status: { $in: ['active', 'acknowledged'] },
        });

        return !!recentAlert;
    } catch (error) {
        logger.warn({ error: error.message }, 'Cooldown check failed, allowing alert');
        return false; // Allow alert if check fails
    }
}

/**
 * Generate alert message from rule and detection data
 */
function generateAlertMessage(rule, detectionData) {
    const { detection_count, detections } = detectionData;
    const { conditions } = rule;

    switch (conditions.type) {
        case 'detection_count':
            return `Alert: ${detection_count} objects detected (threshold: ${conditions.operator} ${conditions.value})`;

        case 'confidence':
            const maxConf = Math.max(...(detections || []).map(d => d.confidence || 0));
            return `Alert: High confidence detection (${(maxConf * 100).toFixed(1)}%, threshold: ${conditions.operator} ${conditions.value})`;

        case 'species':
            const species = (detections || []).map(d => d.class).filter(Boolean).join(', ');
            return `Alert: Species detected: ${species}`;

        default:
            return `Alert triggered: ${rule.name}`;
    }
}

module.exports = {
    evaluateDetectionData,
    evaluateRule,
};

