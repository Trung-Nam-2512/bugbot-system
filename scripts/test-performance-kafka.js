#!/usr/bin/env node
/**
 * Performance Test Script (Kafka-based)
 * 
 * Test stream processor performance với concurrent events sent to Kafka
 */

require('dotenv').config();
const { Kafka } = require('kafkajs');
const { createClient } = require('@clickhouse/client');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:19092').split(',');
const KAFKA_TOPIC = process.env.KAFKA_TOPIC_RAW || 'events.raw';
const CONCURRENT_EVENTS = parseInt(process.env.PERF_TEST_EVENTS || '100', 10);

const clickhouseClient = createClient({
    url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || 'clickhouse123',
    database: process.env.CLICKHOUSE_DATABASE || 'iot',
});

/**
 * Send batch of events to Kafka
 */
async function sendEventsBatch(count, deviceId) {
    const kafka = new Kafka({
        brokers: KAFKA_BROKERS,
        clientId: 'perf-test-producer',
    });

    const producer = kafka.producer();
    await producer.connect();

    const messages = [];
    for (let i = 0; i < count; i++) {
        const event = {
            device_id: deviceId,
            timestamp: new Date().toISOString(),
            shot_id: `perf-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
            image_url: `http://localhost:9000/iot-raw/${deviceId}/test-${i}.jpg`,
            image_size: 100000 + Math.floor(Math.random() * 900000),
            image_md5: `md5-${Date.now()}-${i}`,
            mime_type: 'image/jpeg',
            firmware_version: '1.0.0',
            ip_address: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
            extra: JSON.stringify({ test: true, type: 'performance', index: i }),
            received_at: new Date().toISOString(),
        };

        messages.push({
            key: deviceId,
            value: JSON.stringify(event),
        });
    }

    const startTime = Date.now();
    await producer.send({
        topic: KAFKA_TOPIC,
        messages,
    });
    const sendLatency = Date.now() - startTime;

    await producer.disconnect();

    return { count, sendLatency };
}

/**
 * Check ClickHouse count
 */
async function getClickHouseCount(deviceId) {
    try {
        const result = await clickhouseClient.query({
            query: 'SELECT COUNT(*) as count FROM iot.events_raw WHERE device_id = {device_id:String}',
            query_params: { device_id: deviceId },
            format: 'JSONEachRow',
        });

        const data = await result.json();
        return parseInt(data[0]?.count || 0, 10);
    } catch (error) {
        return -1;
    }
}

/**
 * Run performance test
 */
async function runPerformanceTest() {
    console.log('🚀 Performance Test (Kafka-based)');
    console.log('===================================\n');

    const deviceId = `perf-device-${Date.now()}`;

    console.log(`📊 Configuration:`);
    console.log(`  - Concurrent events: ${CONCURRENT_EVENTS}`);
    console.log(`  - Device ID: ${deviceId}`);
    console.log(`  - Kafka topic: ${KAFKA_TOPIC}\n`);

    // Step 1: Send all events
    console.log(`📤 Step 1: Sending ${CONCURRENT_EVENTS} events to Kafka...`);
    const startTime = Date.now();

    const sendResult = await sendEventsBatch(CONCURRENT_EVENTS, deviceId);

    const totalSendTime = Date.now() - startTime;

    console.log(`✅ Events sent:`);
    console.log(`   Count: ${sendResult.count}`);
    console.log(`   Send latency: ${sendResult.sendLatency}ms`);
    console.log(`   Throughput: ${((sendResult.count / sendResult.sendLatency) * 1000).toFixed(2)} events/second`);

    // Step 2: Wait for processing
    console.log(`\n⏳ Step 2: Waiting 15 seconds for stream processor...`);
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Step 3: Check ClickHouse
    console.log(`\n📊 Step 3: Checking ClickHouse...`);
    const clickhouseCount = await getClickHouseCount(deviceId);

    const totalProcessingTime = Date.now() - startTime;

    // Step 4: Results
    console.log('\n📊 Performance Test Results');
    console.log('==========================\n');
    console.log(`Events sent: ${CONCURRENT_EVENTS}`);
    console.log(`Events in ClickHouse: ${clickhouseCount}`);
    console.log(`Match: ${clickhouseCount === CONCURRENT_EVENTS ? '✅' : '⚠️'}`);
    console.log(`\nTiming:`);
    console.log(`  Total time: ${totalProcessingTime}ms (${(totalProcessingTime / 1000).toFixed(2)}s)`);
    console.log(`  Processing latency: ${totalProcessingTime - sendResult.sendLatency}ms`);
    console.log(`  Events/second: ${((CONCURRENT_EVENTS / totalProcessingTime) * 1000).toFixed(2)}`);

    // Summary
    console.log('\n📋 Summary:');
    if (clickhouseCount === CONCURRENT_EVENTS) {
        console.log('✅ Performance test PASSED!');
        console.log(`   All ${CONCURRENT_EVENTS} events processed successfully`);
        process.exit(0);
    } else {
        console.log(`⚠️  Performance test PARTIAL`);
        console.log(`   Expected: ${CONCURRENT_EVENTS}, Got: ${clickhouseCount}`);
        console.log(`   May need more time for batch processing`);
        process.exit(1);
    }
}

runPerformanceTest().catch(console.error);









