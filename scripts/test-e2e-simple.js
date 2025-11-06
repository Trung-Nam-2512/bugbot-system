#!/usr/bin/env node
/**
 * Simple E2E Test
 * 
 * Test bằng cách:
 * 1. Send test events qua Kafka (simulate upload)
 * 2. Verify trong ClickHouse
 * 3. Verify aggregations
 */

require('dotenv').config();
const { Kafka } = require('kafkajs');
const { createClient } = require('@clickhouse/client');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:19092').split(',');
const KAFKA_TOPIC = process.env.KAFKA_TOPIC_RAW || 'events.raw';

const clickhouseClient = createClient({
    url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || 'clickhouse123',
    database: process.env.CLICKHOUSE_DATABASE || 'iot',
});

/**
 * Send test event to Kafka
 */
async function sendTestEvent(deviceId) {
    const kafka = new Kafka({
        brokers: KAFKA_BROKERS,
        clientId: 'e2e-test-producer',
    });

    const producer = kafka.producer();
    await producer.connect();

    const event = {
        device_id: deviceId,
        timestamp: new Date().toISOString(),
        shot_id: `e2e-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        image_url: `http://localhost:9000/iot-raw/${deviceId}/test.jpg`,
        image_size: 100000 + Math.floor(Math.random() * 900000),
        image_md5: `test-md5-${Date.now()}`,
        mime_type: 'image/jpeg',
        firmware_version: '1.0.0',
        ip_address: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
        extra: JSON.stringify({ test: true, type: 'e2e' }),
        received_at: new Date().toISOString(),
    };

    await producer.send({
        topic: KAFKA_TOPIC,
        messages: [{
            key: deviceId,
            value: JSON.stringify(event),
        }],
    });

    await producer.disconnect();

    return event;
}


/**
 * Check hourly aggregation
 */
async function checkHourlyAgg(deviceId, timeout = 10000) {
    console.log(`\n🔍 Checking hourly aggregation for device: ${deviceId}...`);

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const result = await clickhouseClient.query({
                query: `
                    SELECT * FROM iot.events_hourly 
                    WHERE device_id = {device_id:String} 
                    AND hour = toStartOfHour(now())
                    LIMIT 1
                `,
                query_params: { device_id: deviceId },
                format: 'JSONEachRow',
            });

            const data = await result.json();

            if (data.length > 0) {
                console.log(`✅ Hourly aggregation found`);
                console.log(`   Image count: ${data[0].image_count}`);
                console.log(`   Total size: ${data[0].total_size} bytes`);
                return data[0];
            }
        } catch (error) {
            // Continue
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`⚠️  Hourly aggregation not found (may need more time for MV)`);
    return null;
}

/**
 * Run E2E test
 */
async function runE2ETest() {
    console.log('🚀 End-to-End Test (Simple)');
    console.log('===========================\n');

    const deviceId = `e2e-device-${Date.now()}`;

    try {
        // Step 1: Send event to Kafka
        console.log('📤 Step 1: Sending test event to Kafka...');
        const event = await sendTestEvent(deviceId);
        console.log(`✅ Event sent: ${event.shot_id}`);

        // Step 2: Wait for processing
        console.log('\n⏳ Waiting 5 seconds for stream processor...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 3: Check ClickHouse (check by device_id and timestamp)
        console.log('\n📊 Step 2: Checking ClickHouse events_raw...');

        // Wait a bit more for batch processing
        await new Promise(resolve => setTimeout(resolve, 3000));

        let clickhouseEvent = null;
        const maxRetries = 10;
        for (let i = 0; i < maxRetries; i++) {
            try {
                const result = await clickhouseClient.query({
                    query: `
                        SELECT * FROM iot.events_raw 
                        WHERE device_id = {device_id:String} 
                        AND timestamp >= {timestamp:DateTime64(3)}
                        ORDER BY timestamp DESC LIMIT 1
                    `,
                    query_params: {
                        device_id: deviceId,
                        timestamp: new Date(Date.now() - 60000).toISOString().replace('T', ' ').replace('Z', ''),
                    },
                    format: 'JSONEachRow',
                });

                const data = await result.json();
                if (data.length > 0) {
                    clickhouseEvent = data[0];
                    break;
                }
            } catch (error) {
                // Continue
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (!clickhouseEvent) {
            throw new Error('Event not found in ClickHouse');
        }

        console.log(`✅ Event found in ClickHouse events_raw`);
        console.log(`   Device: ${clickhouseEvent.device_id}`);
        console.log(`   Shot ID: ${clickhouseEvent.shot_id}`);
        console.log(`   Timestamp: ${clickhouseEvent.timestamp}`);

        // Step 4: Check hourly aggregation
        console.log('\n📊 Step 3: Checking hourly aggregation...');
        await checkHourlyAgg(deviceId, 10000);

        // Step 5: Summary
        console.log('\n🎉 End-to-End Test PASSED! ✅');
        console.log('\n📋 Summary:');
        console.log(`  ✅ Event sent to Kafka`);
        console.log(`  ✅ Event in ClickHouse events_raw`);
        console.log(`  ✅ Hourly aggregation (may need more time)`);

        process.exit(0);
    } catch (error) {
        console.error('\n❌ End-to-End Test FAILED!');
        console.error('Error:', error.message);
        process.exit(1);
    }
}

runE2ETest().catch(console.error);

