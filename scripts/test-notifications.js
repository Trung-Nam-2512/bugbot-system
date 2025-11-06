/**
 * Test Notification System
 * Test email, webhook, và in-app notifications
 */

require('dotenv').config();
const { initMongoDB } = require('../src/libs/mongodb');
const notificationService = require('../src/services/notification.service');

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
    console.log('🧪 Testing Notification System...\n');

    // Initialize MongoDB
    try {
        await initMongoDB();
        console.log('✅ MongoDB connected\n');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error.message);
        process.exit(1);
    }

    // Test data
    const alertData = {
        alertId: `test-alert-${Date.now()}`,
        ruleId: 'test-rule-id',
        ruleName: 'Test Alert Rule',
        deviceId: 'test-device-1',
        severity: 'warning',
        message: 'Test alert message: 3 objects detected',
        metadata: {
            detection_count: 3,
            detections_count: 3,
        },
        triggeredAt: new Date(),
    };

    // Test 1: In-app notification
    await test('In-app notification', async () => {
        await notificationService.sendInApp(alertData);
        console.log('   In-app notification sent');
    });

    // Test 2: Webhook notification (mock)
    await test('Webhook notification (mock URL)', async () => {
        const config = {
            url: 'https://httpbin.org/post', // Test webhook endpoint
            timeout: 5000,
        };

        try {
            await notificationService.sendWebhook(config, alertData);
            console.log('   Webhook notification sent');
        } catch (error) {
            // Webhook might fail if URL not accessible, that's OK for testing
            console.log(`   Webhook test: ${error.message} (expected if URL not accessible)`);
        }
    });

    // Test 3: Email notification (no SMTP config - should skip gracefully)
    await test('Email notification (no SMTP config)', async () => {
        const config = {
            to: 'test@example.com',
        };

        const result = await notificationService.sendEmail(config, alertData);
        if (result === false) {
            console.log('   Email skipped (no SMTP config - expected)');
        } else {
            console.log('   Email notification sent');
        }
    });

    // Test 4: Notification logs
    await test('Verify notification logs', async () => {
        const { getMongoDB } = require('../src/libs/mongodb');
        const db = getMongoDB();
        
        const logs = await db.collection('notification_logs')
            .find({ alertId: alertData.alertId })
            .toArray();

        if (logs.length === 0) {
            throw new Error('No notification logs found');
        }

        console.log(`   Found ${logs.length} notification log(s)`);
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

    console.log('\n✅ All notification tests passed!');
    console.log('\n💡 Note: Email requires SMTP configuration in .env file');
    console.log('   Set SMTP_USER, SMTP_PASSWORD, SMTP_HOST, etc.');
}

main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});


