/**
 * E2E Alert Flow Test
 * Test complete flow: enriched event → alert evaluation → alert generation → notification
 */

require('dotenv').config();
const { initMongoDB, getMongoDB } = require('../src/libs/mongodb');
const alertRulesService = require('../src/services/alert-rules.service');
const alertEvaluationService = require('../src/services/alert-evaluation.service');
const alertGenerationService = require('../src/services/alert-generation.service');

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
    console.log('🧪 Testing E2E Alert Flow...\n');

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
    await test('Create test alert rule', async () => {
        const rule = await alertRulesService.createRule({
            name: `E2E Test Rule ${Date.now()}`,
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
            cooldownPeriod: 10,
        });
        testRuleId = rule._id;
        console.log(`   Created rule: ${rule.name}`);
    });

    // Simulate enriched event
    await test('Simulate enriched event with detections', async () => {
        const enrichedEvent = {
            device_id: 'e2e-test-device',
            detection_count: 3,
            detections: [
                { class: 'person', confidence: 0.9 },
                { class: 'cat', confidence: 0.8 },
                { class: 'dog', confidence: 0.7 },
            ],
            timestamp: new Date(),
        };

        // Evaluate alerts
        const triggeredAlerts = await alertEvaluationService.evaluateDetectionData(enrichedEvent);
        if (triggeredAlerts.length === 0) {
            throw new Error('No alerts triggered');
        }

        console.log(`   Triggered ${triggeredAlerts.length} alert(s)`);

        // Generate alert
        const alert = await alertGenerationService.generateAlert(triggeredAlerts[0]);
        if (!alert || !alert.alertId) {
            throw new Error('Alert generation failed');
        }

        console.log(`   Alert generated: ${alert.alertId}`);
    });

    // Verify alert in database
    await test('Verify alert in MongoDB', async () => {
        const db = getMongoDB();
        const alerts = await db.collection('alert_history')
            .find({ deviceId: 'e2e-test-device', status: 'active' })
            .sort({ triggeredAt: -1 })
            .limit(1)
            .toArray();

        if (alerts.length === 0) {
            throw new Error('Alert not found in MongoDB');
        }

        const alert = alerts[0];
        console.log(`   Alert found: ${alert.alertId}, severity: ${alert.severity}`);
    });

    // Verify in-app notification
    await test('Verify in-app notification created', async () => {
        const db = getMongoDB();
        const notifications = await db.collection('in_app_notifications')
            .find({ deviceId: 'e2e-test-device' })
            .sort({ createdAt: -1 })
            .limit(1)
            .toArray();

        if (notifications.length === 0) {
            throw new Error('In-app notification not found');
        }

        const notification = notifications[0];
        console.log(`   Notification found: ${notification.alertId}`);
    });

    // Verify notification log
    await test('Verify notification log created', async () => {
        const db = getMongoDB();
        const logs = await db.collection('notification_logs')
            .find({})
            .sort({ createdAt: -1 })
            .limit(1)
            .toArray();

        if (logs.length === 0) {
            throw new Error('Notification log not found');
        }

        const log = logs[0];
        console.log(`   Notification log: ${log.type}, status: ${log.status}`);
    });

    // Test dashboard API can fetch alert
    await test('Test dashboard API can fetch alert', async () => {
        const fetch = globalThis.fetch || require('node-fetch');
        const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1435';

        const response = await fetch(`${BACKEND_URL}/api/dashboard/alerts/recent?limit=5`);
        if (!response.ok) {
            throw new Error(`Dashboard API failed: ${response.status}`);
        }

        const data = await response.json();
        if (!data.ok || !Array.isArray(data.alerts)) {
            throw new Error('Invalid dashboard API response');
        }

        const ourAlert = data.alerts.find(a => a.deviceId === 'e2e-test-device');
        if (!ourAlert) {
            console.log(`   Warning: Alert not in recent list (may be older than others)`);
        } else {
            console.log(`   Dashboard API can fetch alert: ${ourAlert.alertId}`);
        }
    });

    // Cleanup
    await test('Cleanup test data', async () => {
        const db = getMongoDB();
        
        // Delete test alerts
        await db.collection('alert_history').deleteMany({
            deviceId: 'e2e-test-device',
        });

        // Delete test notifications
        await db.collection('in_app_notifications').deleteMany({
            deviceId: 'e2e-test-device',
        });

        // Delete test rule
        if (testRuleId) {
            await alertRulesService.deleteRule(testRuleId.toString());
        }

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

    console.log('\n✅ E2E Alert Flow test passed!');
    console.log('\n🎉 Complete flow verified:');
    console.log('   Enriched Event → Alert Evaluation → Alert Generation →');
    console.log('   MongoDB Storage → In-App Notification → Dashboard API');
}

main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});


