/**
 * Test Dashboard API
 * Test dashboard endpoints cho frontend integration
 */

require('dotenv').config();
const fetch = globalThis.fetch || require('node-fetch');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1435';

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
    console.log('🧪 Testing Dashboard API...\n');

    // Test 1: Dashboard Overview
    await test('GET /api/dashboard/overview', async () => {
        const response = await fetch(`${BACKEND_URL}/api/dashboard/overview`);
        if (!response.ok) {
            throw new Error(`Status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.ok || !data.alerts || !data.rules) {
            throw new Error('Invalid response format');
        }

        console.log(`   Active alerts: ${data.alerts.active}`);
        console.log(`   Active rules: ${data.rules.active}`);
        console.log(`   Unread notifications: ${data.notifications.unread}`);
    });

    // Test 2: Recent Alerts
    await test('GET /api/dashboard/alerts/recent', async () => {
        const response = await fetch(`${BACKEND_URL}/api/dashboard/alerts/recent?limit=5`);
        if (!response.ok) {
            throw new Error(`Status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.ok || !Array.isArray(data.alerts)) {
            throw new Error('Invalid response format');
        }

        console.log(`   Found ${data.alerts.length} recent alerts`);
    });

    // Test 3: Alerts Summary
    await test('GET /api/dashboard/alerts/summary', async () => {
        const response = await fetch(`${BACKEND_URL}/api/dashboard/alerts/summary`);
        if (!response.ok) {
            throw new Error(`Status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.ok || !data.byStatus || !data.bySeverity) {
            throw new Error('Invalid response format');
        }

        console.log(`   Active: ${data.byStatus.active}, Total: ${data.byStatus.total}`);
        console.log(`   By severity: ${JSON.stringify(data.bySeverity)}`);
    });

    // Test 4: Active Rules
    await test('GET /api/dashboard/rules/active', async () => {
        const response = await fetch(`${BACKEND_URL}/api/dashboard/rules/active`);
        if (!response.ok) {
            throw new Error(`Status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.ok || !Array.isArray(data.rules)) {
            throw new Error('Invalid response format');
        }

        console.log(`   Found ${data.rules.length} active rules`);
    });

    // Test 5: Dashboard Stats
    await test('GET /api/dashboard/stats', async () => {
        const response = await fetch(`${BACKEND_URL}/api/dashboard/stats`);
        if (!response.ok) {
            throw new Error(`Status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.ok || !data.alerts) {
            throw new Error('Invalid response format');
        }

        console.log(`   Alerts: ${data.alerts.active} active`);
        if (data.detections) {
            console.log(`   Detections: ${data.detections.totalDetections} total`);
        }
    });

    // Test 6: Real-time data (polling simulation)
    await test('Test polling support (2 requests)', async () => {
        const response1 = await fetch(`${BACKEND_URL}/api/dashboard/overview`);
        const data1 = await response1.json();
        
        // Wait 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response2 = await fetch(`${BACKEND_URL}/api/dashboard/overview`);
        const data2 = await response2.json();

        // Both should work
        if (!data1.ok || !data2.ok) {
            throw new Error('Polling requests failed');
        }

        console.log(`   Polling test: ✅ Both requests successful`);
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

    console.log('\n✅ All dashboard API tests passed!');
    console.log('\n💡 Dashboard can now poll these endpoints for real-time updates');
}

main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});


