/**
 * Comprehensive Alert System Test Script
 * Tests all components: rules, evaluation, generation, notifications, APIs
 */

require('dotenv').config();
const axios = require('axios');
const { getDB } = require('../src/libs/mongodb');
const { initMongoDB, closeMongoDB } = require('../src/libs/mongodb');
const { initClickHouse, closeClickHouse, getClickHouseClient } = require('../src/libs/clickhouse');
const alertRulesService = require('../src/services/alert-rules.service');
const alertEvaluationService = require('../src/services/alert-evaluation.service');
const alertGenerationService = require('../src/services/alert-generation.service');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const TEST_DEVICE_ID = 'test-device-alert-' + Date.now();

let testsPassed = 0;
let testsFailed = 0;
const results = [];

function logTest(name, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${name}`);
    if (details) {
        console.log(`   ${details}`);
    }
    results.push({ name, passed, details });
    if (passed) {
        testsPassed++;
    } else {
        testsFailed++;
    }
}

async function testDatabaseSchemas() {
    console.log('\n📊 Testing Database Schemas...\n');

    try {
        // Test MongoDB collections
        const db = getDB();
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        const requiredCollections = ['alert_rules', 'alert_history', 'notification_channels'];
        for (const coll of requiredCollections) {
            const exists = collectionNames.includes(coll);
            logTest(`MongoDB collection: ${coll}`, exists, exists ? 'Collection exists' : 'Collection missing');
        }

        // Test ClickHouse table
        const clickhouse = getClickHouseClient();
        const tablesResult = await clickhouse.query({
            query: "SHOW TABLES FROM iot LIKE 'alerts%'",
            format: 'JSONEachRow',
        });
        const tables = await tablesResult.json();
        const tableNames = tables.map(t => t.name);

        logTest('ClickHouse table: alerts', tableNames.includes('alerts'), 
            tableNames.includes('alerts') ? 'Table exists' : 'Table missing');
        logTest('ClickHouse table: alerts_hourly', tableNames.includes('alerts_hourly'),
            tableNames.includes('alerts_hourly') ? 'Table exists' : 'Table missing');

        return true;
    } catch (error) {
        logTest('Database schema check', false, error.message);
        return false;
    }
}

async function testAlertRulesService() {
    console.log('\n🔧 Testing Alert Rules Service...\n');

    try {
        // Test create rule
        const ruleData = {
            name: 'Test Detection Count Rule',
            enabled: true,
            conditions: {
                type: 'detection_count',
                operator: '>',
                value: 5,
            },
            severity: 'warning',
            notificationChannels: [
                { type: 'in_app', config: {} },
            ],
            cooldownPeriod: 60,
        };

        const rule = await alertRulesService.createRule(ruleData);
        logTest('Create alert rule', !!rule && !!rule._id, 
            rule ? `Rule ID: ${rule._id}` : 'Failed to create');

        const ruleId = rule._id.toString();

        // Test get rule by ID
        const retrievedRule = await alertRulesService.getRuleById(ruleId);
        logTest('Get rule by ID', !!retrievedRule && retrievedRule.name === ruleData.name,
            retrievedRule ? 'Rule retrieved' : 'Rule not found');

        // Test get all rules
        const allRules = await alertRulesService.getAllRules();
        logTest('Get all rules', allRules.length > 0, `Found ${allRules.length} rules`);

        // Test get enabled rules
        const enabledRules = await alertRulesService.getEnabledRules();
        logTest('Get enabled rules', enabledRules.length > 0, `Found ${enabledRules.length} enabled rules`);

        // Test update rule
        const updatedRule = await alertRulesService.updateRule(ruleId, {
            severity: 'critical',
        });
        logTest('Update rule', !!updatedRule && updatedRule.severity === 'critical',
            updatedRule ? 'Rule updated' : 'Update failed');

        // Cleanup
        await alertRulesService.deleteRule(ruleId);
        logTest('Delete rule', true, 'Rule deleted');

        return true;
    } catch (error) {
        logTest('Alert rules service', false, error.message);
        return false;
    }
}

async function testAlertEvaluation() {
    console.log('\n⚖️ Testing Alert Evaluation Service...\n');

    try {
        // Create test rule
        const rule = await alertRulesService.createRule({
            name: 'Test Evaluation Rule',
            enabled: true,
            conditions: {
                type: 'detection_count',
                operator: '>',
                value: 3,
            },
            severity: 'warning',
            notificationChannels: [],
            cooldownPeriod: 0, // No cooldown for testing
        });

        // Test evaluation with triggering data
        const triggeringData = {
            device_id: TEST_DEVICE_ID,
            detection_count: 5,
            detections: [
                { class: 'person', confidence: 0.9 },
                { class: 'car', confidence: 0.8 },
            ],
            timestamp: new Date(),
        };

        const triggeredAlerts = await alertEvaluationService.evaluateDetectionData(triggeringData);
        logTest('Alert evaluation (triggering)', triggeredAlerts.length > 0,
            triggeredAlerts.length > 0 ? `Triggered ${triggeredAlerts.length} alerts` : 'No alerts triggered');

        // Test evaluation with non-triggering data
        const nonTriggeringData = {
            device_id: TEST_DEVICE_ID,
            detection_count: 2,
            detections: [],
            timestamp: new Date(),
        };

        const nonTriggeredAlerts = await alertEvaluationService.evaluateDetectionData(nonTriggeringData);
        logTest('Alert evaluation (non-triggering)', nonTriggeredAlerts.length === 0,
            nonTriggeredAlerts.length === 0 ? 'No alerts (expected)' : 'Unexpected alerts');

        // Cleanup
        await alertRulesService.deleteRule(rule._id.toString());

        return true;
    } catch (error) {
        logTest('Alert evaluation service', false, error.message);
        return false;
    }
}

async function testAlertGeneration() {
    console.log('\n🚨 Testing Alert Generation Service...\n');

    try {
        // Create test rule
        const rule = await alertRulesService.createRule({
            name: 'Test Generation Rule',
            enabled: true,
            conditions: {
                type: 'detection_count',
                operator: '>',
                value: 2,
            },
            severity: 'info',
            notificationChannels: [
                { type: 'in_app', config: {} },
            ],
            cooldownPeriod: 0,
        });

        // Generate alert
        const alertData = {
            ruleId: rule._id.toString(),
            ruleName: rule.name,
            deviceId: TEST_DEVICE_ID,
            severity: rule.severity,
            message: 'Test alert message',
            metadata: { test: true },
            triggeredAt: new Date(),
        };

        const generatedAlert = await alertGenerationService.generateAlert(alertData);
        logTest('Generate alert', !!generatedAlert && !!generatedAlert.alertId,
            generatedAlert ? `Alert ID: ${generatedAlert.alertId}` : 'Failed to generate');

        const alertId = generatedAlert.alertId;

        // Test acknowledge
        const acknowledged = await alertGenerationService.acknowledgeAlert(alertId, 'test-user');
        logTest('Acknowledge alert', acknowledged, acknowledged ? 'Alert acknowledged' : 'Failed to acknowledge');

        // Test resolve
        const resolved = await alertGenerationService.resolveAlert(alertId, 'test-user');
        logTest('Resolve alert', resolved, resolved ? 'Alert resolved' : 'Failed to resolve');

        // Cleanup
        await alertRulesService.deleteRule(rule._id.toString());

        return true;
    } catch (error) {
        logTest('Alert generation service', false, error.message);
        return false;
    }
}

async function testAPIEndpoints() {
    console.log('\n🌐 Testing API Endpoints...\n');

    try {
        // Test GET /api/alerts/rules
        const rulesResponse = await axios.get(`${BACKEND_URL}/api/alerts/rules`);
        logTest('GET /api/alerts/rules', rulesResponse.status === 200 && rulesResponse.data.ok,
            rulesResponse.data.ok ? `Found ${rulesResponse.data.count} rules` : 'API error');

        // Test POST /api/alerts/rules
        const createRuleData = {
            name: 'API Test Rule',
            enabled: true,
            conditions: {
                type: 'detection_count',
                operator: '>',
                value: 10,
            },
            severity: 'critical',
            notificationChannels: [],
        };

        const createResponse = await axios.post(`${BACKEND_URL}/api/alerts/rules`, createRuleData);
        logTest('POST /api/alerts/rules', createResponse.status === 201 && createResponse.data.ok,
            createResponse.data.ok ? 'Rule created' : 'Failed to create');

        const createdRuleId = createResponse.data.rule._id;

        // Test GET /api/alerts/rules/:id
        const getRuleResponse = await axios.get(`${BACKEND_URL}/api/alerts/rules/${createdRuleId}`);
        logTest('GET /api/alerts/rules/:id', getRuleResponse.status === 200 && getRuleResponse.data.ok,
            getRuleResponse.data.ok ? 'Rule retrieved' : 'Failed to retrieve');

        // Test GET /api/alerts
        const alertsResponse = await axios.get(`${BACKEND_URL}/api/alerts`);
        logTest('GET /api/alerts', alertsResponse.status === 200 && alertsResponse.data.ok,
            alertsResponse.data.ok ? `Found ${alertsResponse.data.alerts.length} alerts` : 'API error');

        // Test GET /api/alerts/stats
        const statsResponse = await axios.get(`${BACKEND_URL}/api/alerts/stats`);
        logTest('GET /api/alerts/stats', statsResponse.status === 200 && statsResponse.data.ok,
            statsResponse.data.ok ? 'Stats retrieved' : 'Failed to get stats');

        // Cleanup
        await axios.delete(`${BACKEND_URL}/api/alerts/rules/${createdRuleId}`);

        return true;
    } catch (error) {
        logTest('API endpoints', false, error.response?.data?.message || error.message);
        return false;
    }
}

async function testIntegration() {
    console.log('\n🔗 Testing Integration...\n');

    try {
        // Create rule
        const rule = await alertRulesService.createRule({
            name: 'Integration Test Rule',
            enabled: true,
            conditions: {
                type: 'detection_count',
                operator: '>',
                value: 1,
            },
            severity: 'warning',
            notificationChannels: [
                { type: 'in_app', config: {} },
            ],
            cooldownPeriod: 0,
        });

        // Simulate enriched event
        const enrichedEvent = {
            device_id: TEST_DEVICE_ID,
            detection_count: 5,
            detections: [
                { class: 'person', confidence: 0.9 },
                { class: 'car', confidence: 0.8 },
            ],
            timestamp: new Date(),
        };

        // Evaluate
        const triggeredAlerts = await alertEvaluationService.evaluateDetectionData(enrichedEvent);
        logTest('Integration: Alert evaluation', triggeredAlerts.length > 0,
            triggeredAlerts.length > 0 ? 'Alerts triggered' : 'No alerts');

        // Generate alerts
        if (triggeredAlerts.length > 0) {
            for (const alertData of triggeredAlerts) {
                await alertGenerationService.generateAlert(alertData);
            }
            logTest('Integration: Alert generation', true, 'Alerts generated');

            // Verify alert in database
            const db = getDB();
            const alert = await db.collection('alert_history').findOne({
                deviceId: TEST_DEVICE_ID,
            });
            logTest('Integration: Alert stored', !!alert, alert ? 'Alert found in DB' : 'Alert not found');
        }

        // Cleanup
        await alertRulesService.deleteRule(rule._id.toString());

        return true;
    } catch (error) {
        logTest('Integration test', false, error.message);
        return false;
    }
}

async function runTests() {
    console.log('🧪 Alert System Comprehensive Test Suite\n');
    console.log('='.repeat(60));
    console.log(`Backend URL: ${BACKEND_URL}`);
    console.log(`Test Device ID: ${TEST_DEVICE_ID}`);
    console.log('='.repeat(60));

    try {
        // Initialize connections
        console.log('\n📡 Initializing connections...');
        await initMongoDB();
        await initClickHouse();
        console.log('✅ Connections initialized\n');

        // Run tests
        await testDatabaseSchemas();
        await testAlertRulesService();
        await testAlertEvaluation();
        await testAlertGeneration();
        await testAPIEndpoints();
        await testIntegration();

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Passed: ${testsPassed}`);
        console.log(`❌ Failed: ${testsFailed}`);
        console.log(`📈 Total: ${testsPassed + testsFailed}`);
        console.log(`🎯 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
        console.log('='.repeat(60));

        if (testsFailed === 0) {
            console.log('\n🎉 ALL TESTS PASSED!\n');
            process.exit(0);
        } else {
            console.log('\n⚠️  SOME TESTS FAILED\n');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Test suite error:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await closeMongoDB();
        await closeClickHouse();
    }
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

