/**
 * Alert Rules Service
 * Quản lý alert rules từ MongoDB
 */

const { getDB } = require('../libs/mongodb');
const { logger } = require('../libs/logger');

/**
 * Get all alert rules
 */
async function getAllRules(filters = {}) {
    try {
        const db = getDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const query = {};
        
        if (filters.enabled !== undefined) {
            query.enabled = filters.enabled === true || filters.enabled === 'true';
        }

        if (filters.deviceId) {
            query['conditions.deviceId'] = filters.deviceId;
        }

        const rules = await db.collection('alert_rules').find(query).toArray();
        
        logger.debug({ count: rules.length }, 'Retrieved alert rules');
        return rules;
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to get alert rules');
        throw error;
    }
}

/**
 * Get alert rule by ID
 */
async function getRuleById(ruleId) {
    try {
        const db = getDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const { ObjectId } = require('mongodb');
        const rule = await db.collection('alert_rules').findOne({ 
            _id: new ObjectId(ruleId) 
        });

        if (!rule) {
            return null;
        }

        return rule;
    } catch (error) {
        logger.error({ error: error.message, ruleId }, 'Failed to get alert rule');
        throw error;
    }
}

/**
 * Create new alert rule
 */
async function createRule(ruleData) {
    try {
        const db = getDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        // Validate required fields
        if (!ruleData.name || !ruleData.conditions || !ruleData.severity) {
            throw new Error('Missing required fields: name, conditions, severity');
        }

        const rule = {
            name: ruleData.name,
            enabled: ruleData.enabled !== false, // Default to true
            conditions: ruleData.conditions,
            severity: ruleData.severity,
            notificationChannels: ruleData.notificationChannels || [],
            cooldownPeriod: ruleData.cooldownPeriod || 300, // Default 5 minutes
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection('alert_rules').insertOne(rule);
        
        logger.info({ ruleId: result.insertedId, name: rule.name }, 'Alert rule created');
        return { ...rule, _id: result.insertedId };
    } catch (error) {
        logger.error({ error: error.message, ruleData }, 'Failed to create alert rule');
        throw error;
    }
}

/**
 * Update alert rule
 */
async function updateRule(ruleId, updates) {
    try {
        const db = getDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const { ObjectId } = require('mongodb');
        
        updates.updatedAt = new Date();
        
        const result = await db.collection('alert_rules').updateOne(
            { _id: new ObjectId(ruleId) },
            { $set: updates }
        );

        if (result.matchedCount === 0) {
            return null;
        }

        logger.info({ ruleId }, 'Alert rule updated');
        return await getRuleById(ruleId);
    } catch (error) {
        logger.error({ error: error.message, ruleId }, 'Failed to update alert rule');
        throw error;
    }
}

/**
 * Delete alert rule
 */
async function deleteRule(ruleId) {
    try {
        const db = getDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const { ObjectId } = require('mongodb');
        
        const result = await db.collection('alert_rules').deleteOne({ 
            _id: new ObjectId(ruleId) 
        });

        if (result.deletedCount === 0) {
            return false;
        }

        logger.info({ ruleId }, 'Alert rule deleted');
        return true;
    } catch (error) {
        logger.error({ error: error.message, ruleId }, 'Failed to delete alert rule');
        throw error;
    }
}

/**
 * Get enabled rules for evaluation
 */
async function getEnabledRules(deviceId = null) {
    try {
        const filters = { enabled: true };
        if (deviceId) {
            filters.deviceId = deviceId;
        }
        return await getAllRules(filters);
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to get enabled rules');
        throw error;
    }
}

module.exports = {
    getAllRules,
    getRuleById,
    createRule,
    updateRule,
    deleteRule,
    getEnabledRules,
};

