/**
 * Test Alert Rules API
 * Test CRUD operations cho alert rules
 */

require('dotenv').config();
// Use built-in fetch for Node.js 18+
const fetch = globalThis.fetch || require('node-fetch');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1435';
const API_BASE = `${BACKEND_URL}/api/alerts/rules`;

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
    console.log('🧪 Testing Alert Rules API...\n');

    let createdRuleId = null;

    // Test 1: Create alert rule
    await test('Create alert rule', async () => {
        const uniqueName = `Test Detection Count Alert ${Date.now()}`;
        const rule = {
            name: uniqueName,
            enabled: true,
            conditions: {
                type: 'detection_count',
                operator: '>=',
                value: 3,
            },
            severity: 'warning',
            notificationChannels: [
                {
                    type: 'in_app',
                    config: {},
                },
            ],
            cooldownPeriod: 300,
        };

        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rule),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to create rule: ${JSON.stringify(error)}`);
        }

        const result = await response.json();
        if (!result.ok || !result.rule || !result.rule._id) {
            throw new Error('Invalid response format');
        }

        createdRuleId = result.rule._id;
        console.log(`   Created rule ID: ${createdRuleId}`);
    });

    // Test 2: Get all rules
    await test('Get all alert rules', async () => {
        const response = await fetch(API_BASE);
        if (!response.ok) {
            throw new Error(`Failed to get rules: ${response.status}`);
        }

        const result = await response.json();
        if (!result.ok || !Array.isArray(result.rules)) {
            throw new Error('Invalid response format');
        }

        console.log(`   Found ${result.rules.length} rules`);
    });

    // Test 3: Get rule by ID
    await test('Get rule by ID', async () => {
        if (!createdRuleId) {
            throw new Error('No rule ID from previous test');
        }

        const response = await fetch(`${API_BASE}/${createdRuleId}`);
        if (!response.ok) {
            throw new Error(`Failed to get rule: ${response.status}`);
        }

        const result = await response.json();
        if (!result.ok || !result.rule || result.rule._id.toString() !== createdRuleId.toString()) {
            throw new Error('Invalid response format');
        }
    });

    // Test 4: Update rule
    await test('Update alert rule', async () => {
        if (!createdRuleId) {
            throw new Error('No rule ID from previous test');
        }

        const updates = {
            enabled: false,
            severity: 'critical',
        };

        const response = await fetch(`${API_BASE}/${createdRuleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to update rule: ${JSON.stringify(error)}`);
        }

        const result = await response.json();
        if (!result.ok || result.rule.severity !== 'critical') {
            throw new Error('Rule not updated correctly');
        }
    });

    // Test 5: Get enabled rules
    await test('Get enabled rules', async () => {
        const response = await fetch(`${API_BASE}?enabled=true`);
        if (!response.ok) {
            throw new Error(`Failed to get enabled rules: ${response.status}`);
        }

        const result = await response.json();
        if (!result.ok || !Array.isArray(result.rules)) {
            throw new Error('Invalid response format');
        }

        // Should have 0 enabled rules (we disabled the test rule)
        const enabledCount = result.rules.filter(r => r.enabled).length;
        console.log(`   Found ${enabledCount} enabled rules`);
    });

    // Test 6: Delete rule
    await test('Delete alert rule', async () => {
        if (!createdRuleId) {
            throw new Error('No rule ID from previous test');
        }

        const response = await fetch(`${API_BASE}/${createdRuleId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to delete rule: ${JSON.stringify(error)}`);
        }

        const result = await response.json();
        if (!result.ok) {
            throw new Error('Delete failed');
        }
    });

    // Test 7: Verify deletion
    await test('Verify rule deleted', async () => {
        if (!createdRuleId) {
            throw new Error('No rule ID from previous test');
        }

        const response = await fetch(`${API_BASE}/${createdRuleId}`);
        if (response.status !== 404) {
            throw new Error('Rule should be deleted (404 expected)');
        }
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

    console.log('\n✅ All tests passed!');
}

main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});

