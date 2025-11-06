/**
 * Run All Alert System Tests
 * Run comprehensive test suite cho alert system
 */

const { spawn } = require('child_process');
const path = require('path');

const tests = [
    { name: 'Database Schemas', file: 'test-alert-database-schemas.js' },
    { name: 'Alert Rules API', file: 'test-alert-rules-api.js' },
    { name: 'Alert Evaluation', file: 'test-alert-evaluation.js' },
    { name: 'Alert Integration', file: 'test-alert-integration.js' },
];

async function runTest(test) {
    return new Promise((resolve, reject) => {
        console.log(`\n🧪 Running ${test.name} tests...\n`);
        console.log('─'.repeat(60));

        const scriptPath = path.join(__dirname, test.file);
        const child = spawn('node', [scriptPath], {
            stdio: 'inherit',
            shell: true,
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve(true);
            } else {
                reject(new Error(`${test.name} tests failed with exit code ${code}`));
            }
        });

        child.on('error', (error) => {
            reject(new Error(`Failed to run ${test.name}: ${error.message}`));
        });
    });
}

async function main() {
    console.log('🚀 Running All Alert System Tests\n');
    console.log('═'.repeat(60));

    const results = {
        passed: [],
        failed: [],
    };

    for (const test of tests) {
        try {
            await runTest(test);
            results.passed.push(test.name);
            console.log(`\n✅ ${test.name}: PASSED\n`);
        } catch (error) {
            results.failed.push({ name: test.name, error: error.message });
            console.log(`\n❌ ${test.name}: FAILED - ${error.message}\n`);
        }
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log(`\n✅ Passed: ${results.passed.length}/${tests.length}`);
    results.passed.forEach(name => {
        console.log(`   ✅ ${name}`);
    });

    if (results.failed.length > 0) {
        console.log(`\n❌ Failed: ${results.failed.length}/${tests.length}`);
        results.failed.forEach(({ name, error }) => {
            console.log(`   ❌ ${name}: ${error}`);
        });
        console.log('\n');
        process.exit(1);
    }

    console.log('\n🎉 All tests passed!\n');
}

main().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
});


