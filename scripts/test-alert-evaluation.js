/**
 * Test Alert Evaluation Logic
 * Test rule evaluation với different detection data
 */

require('dotenv').config();
const alertEvaluationService = require('../src/services/alert-evaluation.service');
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
    console.log('🧪 Testing Alert Evaluation Logic...\n');

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
    await test('Create test rule', async () => {
        const rule = await alertRulesService.createRule({
            name: 'Test Evaluation Rule',
            enabled: true,
            conditions: {
                type: 'detection_count',
                operator: '>=',
                value: 2,
            },
            severity: 'warning',
            notificationChannels: [],
            cooldownPeriod: 60, // 1 minute for testing
        });
        testRuleId = rule._id;
        console.log(`   Created rule ID: ${testRuleId}`);
    });

    // Test 1: Detection count threshold (should trigger)
    await test('Evaluate: detection_count >= 2 (should trigger)', async () => {
        const detectionData = {
            device_id: 'test-device-1',
            detection_count: 3,
            detections: [
                { class: 'person', confidence: 0.9 },
                { class: 'cat', confidence: 0.8 },
                { class: 'dog', confidence: 0.7 },
            ],
            timestamp: new Date(),
        };

        const alerts = await alertEvaluationService.evaluateDetectionData(detectionData);
        if (alerts.length === 0) {
            throw new Error('Alert should be triggered (detection_count = 3 >= 2)');
        }
        console.log(`   Triggered ${alerts.length} alert(s)`);
    });

    // Test 2: Detection count threshold (should NOT trigger)
    await test('Evaluate: detection_count < 2 (should NOT trigger)', async () => {
        const detectionData = {
            device_id: 'test-device-1',
            detection_count: 1,
            detections: [{ class: 'person', confidence: 0.9 }],
            timestamp: new Date(),
        };

        const alerts = await alertEvaluationService.evaluateDetectionData(detectionData);
        if (alerts.length > 0) {
            throw new Error('Alert should NOT be triggered (detection_count = 1 < 2)');
        }
        console.log(`   No alerts triggered (correct)`);
    });

    // Test 3: Confidence threshold
    await test('Create confidence rule and evaluate', async () => {
        // Create confidence rule
        const confidenceRule = await alertRulesService.createRule({
            name: 'Test Confidence Rule',
            enabled: true,
            conditions: {
                type: 'confidence',
                operator: '>=',
                value: 0.95,
            },
            severity: 'critical',
            notificationChannels: [],
            cooldownPeriod: 60,
        });

        // Test with high confidence (should trigger)
        const detectionData = {
            device_id: 'test-device-2',
            detection_count: 1,
            detections: [{ class: 'person', confidence: 0.98 }],
            timestamp: new Date(),
        };

        const alerts = await alertEvaluationService.evaluateDetectionData(detectionData);
        if (alerts.length === 0) {
            throw new Error('Alert should be triggered (confidence = 0.98 >= 0.95)');
        }
        console.log(`   Confidence alert triggered (correct)`);
    });

    // Test 4: Species detection
    await test('Create species rule and evaluate', async () => {
        // Create species rule
        const speciesRule = await alertRulesService.createRule({
            name: 'Test Species Rule',
            enabled: true,
            conditions: {
                type: 'species',
                operator: 'in',
                value: 'person',
            },
            severity: 'warning',
            notificationChannels: [],
            cooldownPeriod: 60,
        });

        // Test with matching species (should trigger)
        const detectionData = {
            device_id: 'test-device-3',
            detection_count: 1,
            detections: [{ class: 'person', confidence: 0.9 }],
            timestamp: new Date(),
        };

        const alerts = await alertEvaluationService.evaluateDetectionData(detectionData);
        if (alerts.length === 0) {
            throw new Error('Alert should be triggered (species = person)');
        }
        console.log(`   Species alert triggered (correct)`);
    });

    // Test 5: Device-specific rule
    await test('Device-specific rule evaluation', async () => {
        // Create device-specific rule
        const deviceRule = await alertRulesService.createRule({
            name: 'Test Device-Specific Rule',
            enabled: true,
            conditions: {
                type: 'detection_count',
                operator: '>=',
                value: 1,
                deviceId: 'specific-device',
            },
            severity: 'info',
            notificationChannels: [],
            cooldownPeriod: 60,
        });

        // Test with matching device (should trigger)
        const matchingData = {
            device_id: 'specific-device',
            detection_count: 1,
            detections: [{ class: 'cat', confidence: 0.8 }],
            timestamp: new Date(),
        };

        const matchingAlerts = await alertEvaluationService.evaluateDetectionData(matchingData);
        if (matchingAlerts.length === 0) {
            throw new Error('Alert should be triggered for matching device');
        }

        // Test with different device (should NOT trigger)
        const nonMatchingData = {
            device_id: 'other-device',
            detection_count: 1,
            detections: [{ class: 'cat', confidence: 0.8 }],
            timestamp: new Date(),
        };

        const nonMatchingAlerts = await alertEvaluationService.evaluateDetectionData(nonMatchingData);
        if (nonMatchingAlerts.length > 0) {
            throw new Error('Alert should NOT be triggered for different device');
        }

        console.log(`   Device-specific rule working correctly`);
    });

    // Cleanup: Delete test rules
    await test('Cleanup test rules', async () => {
        const rules = await alertRulesService.getAllRules({});
        const testRules = rules.filter(r => r.name.startsWith('Test '));
        for (const rule of testRules) {
            await alertRulesService.deleteRule(rule._id.toString());
        }
        console.log(`   Deleted ${testRules.length} test rules`);
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

    console.log('\n✅ All evaluation tests passed!');
}

main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});

