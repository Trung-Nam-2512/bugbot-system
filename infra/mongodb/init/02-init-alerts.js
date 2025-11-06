// MongoDB initialization script for Alert System
// Run this on MongoDB startup

db = db.getSiblingDB('iot');

// Create Alert Rules Collection
db.createCollection('alert_rules', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['name', 'enabled', 'conditions', 'severity'],
            properties: {
                name: {
                    bsonType: 'string',
                    description: 'Alert rule name'
                },
                enabled: {
                    bsonType: 'bool',
                    description: 'Whether rule is enabled'
                },
                conditions: {
                    bsonType: 'object',
                    required: ['type', 'operator', 'value'],
                    properties: {
                        type: {
                            bsonType: 'string',
                            enum: ['detection_count', 'confidence', 'species', 'device_offline'],
                            description: 'Condition type'
                        },
                        operator: {
                            bsonType: 'string',
                            enum: ['>', '<', '>=', '<=', '==', '!=', 'in', 'not_in'],
                            description: 'Comparison operator'
                        },
                        value: {
                            bsonType: ['string', 'number', 'array'],
                            description: 'Threshold value'
                        },
                        deviceId: {
                            bsonType: ['string', 'null'],
                            description: 'Optional device filter'
                        },
                        species: {
                            bsonType: ['string', 'array', 'null'],
                            description: 'Optional species filter'
                        }
                    }
                },
                severity: {
                    bsonType: 'string',
                    enum: ['info', 'warning', 'critical'],
                    description: 'Alert severity level'
                },
                notificationChannels: {
                    bsonType: 'array',
                    items: {
                        bsonType: 'object',
                        properties: {
                            type: {
                                bsonType: 'string',
                                enum: ['email', 'webhook', 'in_app'],
                                description: 'Notification channel type'
                            },
                            config: {
                                bsonType: 'object',
                                description: 'Channel-specific configuration'
                            }
                        }
                    },
                    description: 'Notification channels'
                },
                cooldownPeriod: {
                    bsonType: 'int',
                    description: 'Cooldown period in seconds (prevent duplicate alerts)'
                },
                createdAt: {
                    bsonType: 'date',
                    description: 'Creation timestamp'
                },
                updatedAt: {
                    bsonType: 'date',
                    description: 'Last update timestamp'
                }
            }
        }
    }
});

// Create indexes for alert_rules
db.alert_rules.createIndex({ name: 1 }, { unique: true });
db.alert_rules.createIndex({ enabled: 1 });
db.alert_rules.createIndex({ 'conditions.deviceId': 1 });

// Create Alert History Collection (for tracking)
db.createCollection('alert_history', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['alertId', 'ruleId', 'severity', 'status', 'triggeredAt'],
            properties: {
                alertId: {
                    bsonType: 'string',
                    description: 'Unique alert ID'
                },
                ruleId: {
                    bsonType: 'objectId',
                    description: 'Reference to alert_rules'
                },
                ruleName: {
                    bsonType: 'string',
                    description: 'Rule name (denormalized)'
                },
                deviceId: {
                    bsonType: 'string',
                    description: 'Device that triggered alert'
                },
                severity: {
                    bsonType: 'string',
                    enum: ['info', 'warning', 'critical'],
                    description: 'Alert severity'
                },
                message: {
                    bsonType: 'string',
                    description: 'Alert message'
                },
                metadata: {
                    bsonType: 'object',
                    description: 'Additional alert metadata'
                },
                status: {
                    bsonType: 'string',
                    enum: ['active', 'acknowledged', 'resolved'],
                    description: 'Alert status'
                },
                triggeredAt: {
                    bsonType: 'date',
                    description: 'When alert was triggered'
                },
                acknowledgedAt: {
                    bsonType: ['date', 'null'],
                    description: 'When alert was acknowledged'
                },
                acknowledgedBy: {
                    bsonType: ['string', 'null'],
                    description: 'Who acknowledged the alert'
                },
                resolvedAt: {
                    bsonType: ['date', 'null'],
                    description: 'When alert was resolved'
                },
                resolvedBy: {
                    bsonType: ['string', 'null'],
                    description: 'Who resolved the alert'
                }
            }
        }
    }
});

// Create indexes for alert_history
db.alert_history.createIndex({ alertId: 1 }, { unique: true });
db.alert_history.createIndex({ ruleId: 1 });
db.alert_history.createIndex({ deviceId: 1 });
db.alert_history.createIndex({ status: 1 });
db.alert_history.createIndex({ triggeredAt: -1 });
db.alert_history.createIndex({ severity: 1, status: 1 });

// Create Notification Channels Collection
db.createCollection('notification_channels', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['name', 'type', 'enabled', 'config'],
            properties: {
                name: {
                    bsonType: 'string',
                    description: 'Channel name'
                },
                type: {
                    bsonType: 'string',
                    enum: ['email', 'webhook', 'in_app'],
                    description: 'Channel type'
                },
                enabled: {
                    bsonType: 'bool',
                    description: 'Whether channel is enabled'
                },
                config: {
                    bsonType: 'object',
                    description: 'Channel-specific configuration'
                },
                createdAt: {
                    bsonType: 'date',
                    description: 'Creation timestamp'
                },
                updatedAt: {
                    bsonType: 'date',
                    description: 'Last update timestamp'
                }
            }
        }
    }
});

// Create indexes for notification_channels
db.notification_channels.createIndex({ name: 1 }, { unique: true });
db.notification_channels.createIndex({ type: 1 });
db.notification_channels.createIndex({ enabled: 1 });

print('✅ Alert System collections created successfully');
print('   - alert_rules');
print('   - alert_history');
print('   - notification_channels');


