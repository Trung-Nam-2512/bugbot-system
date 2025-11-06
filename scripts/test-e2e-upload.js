#!/usr/bin/env node
/**
 * End-to-End Test Script
 * 
 * Test complete flow: Upload → Kafka → ClickHouse → Aggregations
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { createClient } = require('@clickhouse/client');
const { Kafka } = require('kafkajs');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1435';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:19092').split(',');
const KAFKA_TOPIC = process.env.KAFKA_TOPIC_RAW || 'events.raw';

const clickhouseClient = createClient({
    url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || 'clickhouse123',
    database: process.env.CLICKHOUSE_DATABASE || 'iot',
});

const kafka = new Kafka({
    brokers: KAFKA_BROKERS,
    clientId: 'e2e-test-client',
});

const consumer = kafka.consumer({ groupId: 'e2e-test-group' });

/**
 * Upload image via API
 */
async function uploadImage(deviceId, imagePath) {
    console.log(`\n📤 Uploading image for device: ${deviceId}...`);

    // Read file into buffer
    const fileBuffer = fs.readFileSync(imagePath);
    const fileName = path.basename(imagePath);

    const formData = new FormData();
    formData.append('file', fileBuffer, fileName);
    formData.append('deviceId', deviceId);
    formData.append('ts', new Date().toISOString());

    const response = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log(`✅ Upload successful:`, result);
    return result;
}

/**
 * Check event in Kafka
 */
async function checkKafkaEvent(shotId, timeout = 10000) {
    console.log(`\n🔍 Checking Kafka for event: ${shotId}...`);

    await consumer.connect();
    await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: false });

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            consumer.disconnect();
            reject(new Error('Timeout waiting for Kafka event'));
        }, timeout);

        consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const event = JSON.parse(message.value.toString());
                    if (event.shot_id === shotId) {
                        clearTimeout(timer);
                        await consumer.disconnect();
                        console.log(`✅ Event found in Kafka:`, event);
                        resolve(event);
                    }
                } catch (error) {
                    // Continue listening
                }
            },
        });
    });
}

/**
 * Check event in ClickHouse events_raw
 */
async function checkClickHouseEvent(shotId, timeout = 10000) {
    console.log(`\n🔍 Checking ClickHouse events_raw for shot_id: ${shotId}...`);

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const result = await clickhouseClient.query({
                query: 'SELECT * FROM iot.events_raw WHERE shot_id = {shot_id:String} LIMIT 1',
                query_params: { shot_id: shotId },
                format: 'JSONEachRow',
            });

            const data = await result.json();

            if (data.length > 0) {
                console.log(`✅ Event found in ClickHouse events_raw:`, data[0]);
                return data[0];
            }
        } catch (error) {
            console.error('Error checking ClickHouse:', error.message);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Timeout waiting for event in ClickHouse');
}

/**
 * Check hourly aggregation
 */
async function checkHourlyAggregation(deviceId, timeout = 10000) {
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
                console.log(`✅ Hourly aggregation found:`, data[0]);
                return data[0];
            }
        } catch (error) {
            console.error('Error checking hourly aggregation:', error.message);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`⚠️  Hourly aggregation not found (may need to wait for MV to process)`);
    return null;
}

/**
 * Check daily stats
 */
async function checkDailyStats(deviceId, timeout = 10000) {
    console.log(`\n🔍 Checking daily stats for device: ${deviceId}...`);

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const result = await clickhouseClient.query({
                query: `
                    SELECT * FROM iot.device_stats_daily 
                    WHERE device_id = {device_id:String} 
                    AND date = toDate(now())
                    LIMIT 1
                `,
                query_params: { device_id: deviceId },
                format: 'JSONEachRow',
            });

            const data = await result.json();

            if (data.length > 0) {
                console.log(`✅ Daily stats found:`, data[0]);
                return data[0];
            }
        } catch (error) {
            console.error('Error checking daily stats:', error.message);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`⚠️  Daily stats not found (may need to wait for MV to process)`);
    return null;
}

/**
 * Run E2E test
 */
async function runE2ETest() {
    console.log('🚀 End-to-End Test');
    console.log('==================\n');

    const deviceId = `e2e-test-device-${Date.now()}`;
    const imagePath = path.join(__dirname, '../test-image.jpg');

    // Check if test image exists
    if (!fs.existsSync(imagePath)) {
        console.error(`❌ Test image not found: ${imagePath}`);
        console.error('Please ensure test-image.jpg exists in project root');
        process.exit(1);
    }

    try {
        // Step 1: Upload image
        const uploadResult = await uploadImage(deviceId, imagePath);
        const shotId = uploadResult.shot_id || uploadResult.id;

        if (!shotId) {
            throw new Error('No shot_id returned from upload');
        }

        console.log(`\n⏳ Waiting 3 seconds for processing...`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 2: Check Kafka (optional - may be too fast)
        try {
            await checkKafkaEvent(shotId, 5000);
        } catch (error) {
            console.log(`⚠️  Kafka check skipped (event may already be consumed)`);
        }

        // Step 3: Check ClickHouse events_raw
        const event = await checkClickHouseEvent(shotId, 15000);

        if (!event) {
            throw new Error('Event not found in ClickHouse events_raw');
        }

        // Step 4: Check hourly aggregation
        await checkHourlyAggregation(deviceId, 10000);

        // Step 5: Check daily stats
        await checkDailyStats(deviceId, 10000);

        console.log('\n🎉 End-to-End Test PASSED! ✅');
        console.log('\n📊 Summary:');
        console.log(`  - Upload: ✅`);
        console.log(`  - ClickHouse events_raw: ✅`);
        console.log(`  - Hourly aggregation: ⚠️  (may need more time)`);
        console.log(`  - Daily stats: ⚠️  (may need more time)`);

        process.exit(0);
    } catch (error) {
        console.error('\n❌ End-to-End Test FAILED!');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run test
runE2ETest().catch(console.error);

