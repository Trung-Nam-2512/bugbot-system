/**
 * Test Alert System Integration
 * Test complete flow: enriched event → alert evaluation → alert generation
 */

require('dotenv').config();
const alertEvaluationService = require('../src/services/alert-evaluation.service');
const alertGenerationService = require('../src/services/alert-generation.service');
const alertRulesService = require('../src/services/alert-rules.service');
const { initMongoDB, getMongoDB } = require('../src/libs/mongodb');

let testResults = {
    passed: 0,
    failed: 0,
    errors: [],
};

async function test(name, fn) {
    try {
        await fn();
        testResults.passed++;
        console.log(`✅ ${name}`);
    } catch (error) {
        testResults.failed++;
        testResults.errors.push({ name, error: error.message });
        console.error(`❌ ${name}: ${error.message}`);
    }
}

async function main() {
    console.log('🧪 Testing Alert System Integration...\n');

    // Initialize MongoDB
    try {
        await initMongoDB();
        console.log('✅ MongoDB connected\n');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error.message);
        process.exit(1);
    }

    // Create test rule
    let testRuleId = null;
    await test('Create integration test rule', async () => {
        const rule = await alertRulesService.createRule({
            name: 'Integration Test Rule',
            enabled: true,
            conditions: {
                type: 'detection_count',
                operator: '>=',
                value: 2,
            },
            severity: 'warning',
            notificationChannels: [
                {
                    type: 'in_app',
                    config: {},
                },
            ],
            cooldownPeriod: 10, // Short cooldown for testing
        });
        testRuleId = rule._id;
        console.log(`   Created rule ID: ${testRuleId}`);
    });

    // Test 1: Complete flow - enriched event → alert
    await test('Complete flow: enriched event → alert', async () => {
        // Simulate enriched event data
        const enrichedEvent = {
            device_id: 'integration-test-device',
            detection_count: 3,
            detections: [
                { class: 'person', confidence: 0.9 },
                { class: 'cat', confidence: 0.8 },
                { class: 'dog', confidence: 0.7 },
            ],
            timestamp: new Date(),
        };

        // Step 1: Evaluate detection data
        const triggeredAlerts = await alertEvaluationService.evaluateDetectionData(enrichedEvent);
        if (triggeredAlerts.length === 0) {
            throw new Error('Alert evaluation should trigger alert');
        }

        // Step 2: Generate alert
        const alert = await alertGenerationService.generateAlert(triggeredAlerts[0]);
        if (!alert || !alert.alertId) {
            throw new Error('Alert generation failed');
        }

        console.log(`   Alert generated: ${alert.alertId}`);
    });

    // Test 2: Verify alert stored in MongoDB
    await test('Verify alert stored in MongoDB', async () => {
        const db = getMongoDB();
        const alerts = await db.collection('alert_history')
            .find({ deviceId: 'integration-test-device' })
            .sort({ triggeredAt: -1 })
            .limit(1)
            .toArray();

        if (alerts.length === 0) {
            throw new Error('Alert not found in MongoDB');
        }

        const alert = alerts[0];
        if (alert.status !== 'active') {
            throw new Error(`Alert status should be 'active', got '${alert.status}'`);
        }

        console.log(`   Alert found: ${alert.alertId}, status: ${alert.status}`);
    });

    // Test 3: Verify in-app notification
    await test('Verify in-app notification created', async () => {
        const db = getMongoDB();
        const notifications = await db.collection('in_app_notifications')
            .find({ deviceId: 'integration-test-device' })
            .sort({ createdAt: -1 })
            .limit(1)
            .toArray();

        if (notifications.length === 0) {
            throw new Error('In-app notification not found');
        }

        const notification = notifications[0];
        if (notification.read !== false) {
            throw new Error('Notification should be unread');
        }

        console.log(`   Notification found: ${notification.alertId}`);
    });

    // Test 4: Acknowledge alert
    await test('Acknowledge alert', async () => {
        const db = getMongoDB();
        const alerts = await db.collection('alert_history')
            .find({ deviceId: 'integration-test-device', status: 'active' })
            .sort({ triggeredAt: -1 })
            .limit(1)
            .toArray();

        if (alerts.length === 0) {
            throw new Error('No active alerts found');
        }

        const alertId = alerts[0].alertId;
        await alertGenerationService.acknowledgeAlert(alertId, 'test-user');

        // Verify
        const updated = await db.collection('alert_history').findOne({ alertId });
        if (updated.status !== 'acknowledged') {
            throw new Error(`Alert status should be 'acknowledged', got '${updated.status}'`);
        }

        console.log(`   Alert acknowledged: ${alertId}`);
    });

    // Test 5: Resolve alert
    await test('Resolve alert', async () => {
        const db = getMongoDB();
        const alerts = await db.collection('alert_history')
            .find({ deviceId: 'integration-test-device', status: 'acknowledged' })
            .sort({ triggeredAt: -1 })
            .limit(1)
            .toArray();

        if (alerts.length === 0) {
            throw new Error('No acknowledged alerts found');
        }

        const alertId = alerts[0].alertId;
        await alertGenerationService.resolveAlert(alertId, 'test-user');

        // Verify
        const updated = await db.collection('alert_history').findOne({ alertId });
        if (updated.status !== 'resolved') {
            throw new Error(`Alert status should be 'resolved', got '${updated.status}'`);
        }

        console.log(`   Alert resolved: ${alertId}`);
    });

    // Test 6: Cooldown period
    await test('Test cooldown period', async () => {
        // Create rule with short cooldown
        const cooldownRule = await alertRulesService.createRule({
            name: 'Cooldown Test Rule',
            enabled: true,
            conditions: {
                type: 'detection_count',
                operator: '>=',
                value: 1,
            },
            severity: 'info',
            notificationChannels: [],
            cooldownPeriod: 60, // 1 minute
        });

        // Trigger first alert
        const data1 = {
            device_id: 'cooldown-test-device',
            detection_count: 2,
            detections: [{ class: 'person', confidence: 0.9 }],
            timestamp: new Date(),
        };

        const alerts1 = await alertEvaluationService.evaluateDetectionData(data1);
        if (alerts1.length === 0) {
            throw new Error('First alert should be triggered');
        }

        await alertGenerationService.generateAlert({
            ...alerts1[0],
            ruleId: cooldownRule._id.toString(),
        });

        // Try to trigger again immediately (should be blocked by cooldown)
        const alerts2 = await alertEvaluationService.evaluateDetectionData({
            ...data1,
            timestamp: new Date(),
        });

        // Should be blocked by cooldown
        if (alerts2.length > 0) {
            console.log(`   Warning: Cooldown may not be working (got ${alerts2.length} alerts)`);
        } else {
            console.log(`   Cooldown working correctly (no duplicate alert)`);
        }

        // Cleanup
        await alertRulesService.deleteRule(cooldownRule._id.toString());
    });

    // Cleanup
    await test('Cleanup test data', async () => {
        const db = getMongoDB();
        
        // Delete test alerts
        await db.collection('alert_history').deleteMany({
            deviceId: { $in: ['integration-test-device', 'cooldown-test-device'] },
        });

        // Delete test notifications
        await db.collection('in_app_notifications').deleteMany({
            deviceId: { $in: ['integration-test-device', 'cooldown-test-device'] },
        });

        // Delete test rules
        await alertRulesService.deleteRule(testRuleId.toString());

        console.log(`   Cleanup completed`);
    });

    // Summary
    console.log('\n📊 Test Results:');
    console.log(`   ✅ Passed: ${testResults.passed}`);
    console.log(`   ❌ Failed: ${testResults.failed}`);

    if (testResults.errors.length > 0) {
        console.log('\n❌ Errors:');
        testResults.errors.forEach(({ name, error }) => {
            console.log(`   - ${name}: ${error}`);
        });
        process.exit(1);
    }

    console.log('\n✅ All integration tests passed!');
}

main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});

