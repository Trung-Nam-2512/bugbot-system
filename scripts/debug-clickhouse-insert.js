#!/usr/bin/env node
/**
 * Debug Script - Test ClickHouse Insert Directly
 * 
 * Test insert trực tiếp vào ClickHouse để debug issue
 */

require('dotenv').config();
const { createClient } = require('@clickhouse/client');

const clickhouseClient = createClient({
    host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || 'clickhouse123',
    database: process.env.CLICKHOUSE_DATABASE || 'iot',
});

async function testDirectInsert() {
    console.log('🧪 Testing Direct ClickHouse Insert...\n');

    // Test event giống format từ stream processor
    const testEvent = {
        device_id: 'test-device-direct',
        timestamp: new Date(),
        shot_id: 'test-shot-123',
        image_url: 'http://localhost:9000/test.jpg',
        image_size: 100000,
        image_md5: 'test-md5-123',
        mime_type: 'image/jpeg',
        firmware_version: '1.0.0',
        ip_address: '192.168.1.100',
        extra: '{"test": true}',
        received_at: new Date(),
    };

    console.log('Test event:', JSON.stringify(testEvent, null, 2));
    console.log('');

    try {
        console.log('Attempting insert...');
        
        await clickhouseClient.insert({
            table: 'iot.events_raw',
            values: [testEvent],
            format: 'JSONEachRow',
        });

        console.log('✅ Insert successful!');

        // Verify
        const result = await clickhouseClient.query({
            query: 'SELECT * FROM iot.events_raw WHERE device_id = {device_id:String} ORDER BY timestamp DESC LIMIT 1',
            query_params: { device_id: 'test-device-direct' },
            format: 'JSONEachRow',
        });

        const data = await result.json();
        console.log('\n✅ Verified event in ClickHouse:');
        console.log(JSON.stringify(data[0], null, 2));

    } catch (error) {
        console.error('❌ Insert failed!');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        // Try alternative format
        console.log('\n🔄 Trying alternative format (without received_at)...');
        
        const simpleEvent = {
            device_id: testEvent.device_id,
            timestamp: testEvent.timestamp,
            shot_id: testEvent.shot_id,
            image_url: testEvent.image_url,
            image_size: testEvent.image_size,
            image_md5: testEvent.image_md5,
            mime_type: testEvent.mime_type,
            firmware_version: testEvent.firmware_version,
            ip_address: testEvent.ip_address,
            extra: testEvent.extra,
        };

        try {
            await clickhouseClient.insert({
                table: 'iot.events_raw',
                values: [simpleEvent],
                format: 'JSONEachRow',
            });
            console.log('✅ Alternative format worked!');
        } catch (error2) {
            console.error('❌ Alternative format also failed:', error2.message);
        }
    }
}

testDirectInsert().catch(console.error);


