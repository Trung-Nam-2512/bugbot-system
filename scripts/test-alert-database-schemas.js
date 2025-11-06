/**
 * Test Database Schemas
 * Verify MongoDB và ClickHouse schemas are created correctly
 */

require('dotenv').config();
const { initMongoDB, getMongoDB } = require('../src/libs/mongodb');
const { initClickHouse, getClickHouseClient, isClickHouseHealthy } = require('../src/libs/clickhouse');

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
    console.log('🧪 Testing Database Schemas...\n');

    // Test MongoDB
    console.log('📊 Testing MongoDB...\n');

    await test('Initialize MongoDB', async () => {
        await initMongoDB();
        const db = getMongoDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }
    });

    await test('Check alert_rules collection exists', async () => {
        const db = getMongoDB();
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes('alert_rules')) {
            throw new Error('alert_rules collection not found');
        }

        // Check indexes
        const indexes = await db.collection('alert_rules').indexes();
        const indexNames = indexes.map(i => i.name);
        
        if (!indexNames.includes('name_1')) {
            throw new Error('alert_rules.name index not found');
        }
        
        console.log(`   Collection exists with ${indexes.length} indexes`);
    });

    await test('Check alert_history collection exists', async () => {
        const db = getMongoDB();
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes('alert_history')) {
            throw new Error('alert_history collection not found');
        }

        // Check indexes
        const indexes = await db.collection('alert_history').indexes();
        const indexNames = indexes.map(i => i.name);
        
        if (!indexNames.includes('alertId_1')) {
            throw new Error('alert_history.alertId index not found');
        }
        
        console.log(`   Collection exists with ${indexes.length} indexes`);
    });

    await test('Check notification_channels collection exists', async () => {
        const db = getMongoDB();
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes('notification_channels')) {
            throw new Error('notification_channels collection not found');
        }

        console.log(`   Collection exists`);
    });

    // Test ClickHouse
    console.log('\n📊 Testing ClickHouse...\n');

    await test('Initialize ClickHouse', async () => {
        await initClickHouse();
        const healthy = await isClickHouseHealthy();
        if (!healthy) {
            throw new Error('ClickHouse not healthy');
        }
    });

    await test('Check alerts table exists', async () => {
        const client = getClickHouseClient();
        const result = await client.query({
            query: 'SHOW TABLES FROM iot LIKE \'alerts\'',
            format: 'JSONEachRow',
        });
        
        const tables = await result.json();
        if (tables.length === 0) {
            throw new Error('alerts table not found');
        }

        console.log(`   Table exists`);
    });

    await test('Check alerts table schema', async () => {
        const client = getClickHouseClient();
        const result = await client.query({
            query: 'DESCRIBE TABLE iot.alerts',
            format: 'JSONEachRow',
        });
        
        const columns = await result.json();
        const columnNames = columns.map(c => c.name);
        
        const requiredColumns = [
            'alert_id',
            'rule_id',
            'rule_name',
            'device_id',
            'severity',
            'message',
            'triggered_at',
            'status',
        ];

        for (const col of requiredColumns) {
            if (!columnNames.includes(col)) {
                throw new Error(`Required column '${col}' not found`);
            }
        }

        console.log(`   Table has ${columns.length} columns`);
    });

    await test('Check alerts_hourly table exists', async () => {
        const client = getClickHouseClient();
        const result = await client.query({
            query: 'SHOW TABLES FROM iot LIKE \'alerts_hourly\'',
            format: 'JSONEachRow',
        });
        
        const tables = await result.json();
        if (tables.length === 0) {
            throw new Error('alerts_hourly table not found');
        }

        console.log(`   Table exists`);
    });

    await test('Check alerts_hourly_mv materialized view exists', async () => {
        const client = getClickHouseClient();
        const result = await client.query({
            query: 'SHOW TABLES FROM iot LIKE \'alerts_hourly_mv\'',
            format: 'JSONEachRow',
        });
        
        const tables = await result.json();
        if (tables.length === 0) {
            throw new Error('alerts_hourly_mv view not found');
        }

        console.log(`   Materialized view exists`);
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

    console.log('\n✅ All database schema tests passed!');
}

main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});


