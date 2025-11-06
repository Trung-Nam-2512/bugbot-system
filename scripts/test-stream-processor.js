#!/usr/bin/env node
/**
 * Test Stream Processor
 * 
 * Script để test stream processor bằng cách:
 * 1. Send test events to Kafka
 * 2. Monitor stream processor
 * 3. Verify events trong ClickHouse
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
 * Generate test event
 */
function generateTestEvent(deviceId, index) {
    const timestamp = new Date().toISOString();
    return {
        device_id: deviceId || `test-device-${Math.floor(Math.random() * 5) + 1}`,
        timestamp,
        shot_id: `test-shot-${Date.now()}-${index}`,
        image_url: `http://localhost:9000/iot-raw/test/${timestamp}.jpg`,
        image_size: Math.floor(Math.random() * 1000000) + 100000, // 100KB - 1MB
        image_md5: `test-md5-${Date.now()}-${index}`,
        mime_type: 'image/jpeg',
        firmware_version: '1.0.0',
        ip_address: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
        extra: JSON.stringify({ test: true, index }),
        received_at: new Date().toISOString(),
    };
}

/**
 * Send events to Kafka
 */
async function sendEvents(count = 10) {
    console.log(`\n📤 Sending ${count} test events to Kafka...`);
    
    const kafka = new Kafka({
        clientId: 'test-stream-processor',
        brokers: KAFKA_BROKERS,
    });

    const producer = kafka.producer();
    await producer.connect();

    const events = [];
    for (let i = 0; i < count; i++) {
        events.push(generateTestEvent(null, i));
    }

    const messages = events.map(event => ({
        value: JSON.stringify(event),
        headers: {
            'source': 'test-script',
            'timestamp': Date.now().toString(),
        },
    }));

    await producer.send({
        topic: KAFKA_TOPIC,
        messages,
    });

    console.log(`✅ Sent ${count} events to Kafka topic: ${KAFKA_TOPIC}`);
    
    await producer.disconnect();
    return events;
}

/**
 * Check events trong ClickHouse
 */
async function checkClickHouseEvents(deviceIds, startTime) {
    console.log('\n🔍 Checking ClickHouse for events...');
    
    // Wait một chút để stream processor xử lý
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
        // Convert ISO string to Date object for ClickHouse
        const startTimeDate = new Date(startTime);
        
        const result = await clickhouseClient.query({
            query: `
                SELECT 
                    device_id,
                    COUNT(*) as count,
                    MAX(received_at) as last_received
                FROM iot.events_raw
                WHERE received_at >= {start_time:DateTime64(3)}
                GROUP BY device_id
                ORDER BY device_id
            `,
            query_params: {
                start_time: startTimeDate,
            },
            format: 'JSONEachRow',
        });

        const data = await result.json();
        
        if (data.length > 0) {
            console.log('\n✅ Events found in ClickHouse:');
            console.table(data);
            return true;
        } else {
            console.log('\n⚠️  No events found in ClickHouse yet');
            return false;
        }
    } catch (error) {
        console.error('\n❌ Error checking ClickHouse:', error.message);
        return false;
    }
}

/**
 * Check hourly aggregations
 */
async function checkHourlyAgg(startTime) {
    console.log('\n🔍 Checking hourly aggregations...');
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        // Convert ISO string to Date object for ClickHouse
        const startTimeDate = new Date(startTime);
        
        const result = await clickhouseClient.query({
            query: `
                SELECT 
                    device_id,
                    hour,
                    image_count,
                    total_size,
                    avg_size
                FROM iot.events_hourly
                WHERE processing_date >= toDate({start_time:DateTime64(3)})
                ORDER BY device_id, hour
                LIMIT 20
            `,
            query_params: {
                start_time: startTimeDate,
            },
            format: 'JSONEachRow',
        });

        const data = await result.json();
        
        if (data.length > 0) {
            console.log('\n✅ Hourly aggregations found:');
            console.table(data);
            return true;
        } else {
            console.log('\n⚠️  No hourly aggregations found yet');
            return false;
        }
    } catch (error) {
        console.error('\n❌ Error checking hourly aggregations:', error.message);
        return false;
    }
}

/**
 * Check stream processor health
 */
async function checkStreamProcessorHealth() {
    console.log('\n🔍 Checking stream processor health...');
    
    try {
        const response = await fetch('http://localhost:1435/api/health/stream-processor');
        const data = await response.json();
        
        if (data.ok) {
            console.log('\n✅ Stream processor is healthy');
            console.log('Stats:', JSON.stringify(data.stats, null, 2));
            return true;
        } else {
            console.log('\n⚠️  Stream processor is not healthy');
            console.log('Stats:', JSON.stringify(data.stats, null, 2));
            return false;
        }
    } catch (error) {
        console.error('\n❌ Error checking stream processor health:', error.message);
        console.log('Note: Make sure backend is running');
        return false;
    }
}

/**
 * Main test function
 */
async function main() {
    console.log('🚀 Stream Processor Test');
    console.log('========================');
    console.log(`Kafka Brokers: ${KAFKA_BROKERS.join(', ')}`);
    console.log(`Kafka Topic: ${KAFKA_TOPIC}`);
    console.log(`ClickHouse: ${process.env.CLICKHOUSE_HOST}`);

    const startTime = new Date().toISOString();
    const eventCount = parseInt(process.argv[2] || '10', 10);

    try {
        // Step 1: Check stream processor health
        await checkStreamProcessorHealth();

        // Step 2: Send test events
        const events = await sendEvents(eventCount);
        const deviceIds = [...new Set(events.map(e => e.device_id))];

        // Step 3: Wait và check ClickHouse
        console.log('\n⏳ Waiting 5 seconds for stream processor to process events...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 4: Verify events trong ClickHouse
        const foundRaw = await checkClickHouseEvents(deviceIds, startTime);

        // Step 5: Check hourly aggregations
        const foundAgg = await checkHourlyAgg(startTime);

        // Step 6: Final health check
        await checkStreamProcessorHealth();

        // Summary
        console.log('\n📊 Test Summary');
        console.log('================');
        console.log(`Events sent: ${eventCount}`);
        console.log(`Events in ClickHouse: ${foundRaw ? '✅' : '❌'}`);
        console.log(`Hourly aggregations: ${foundAgg ? '✅' : '❌'}`);

        if (foundRaw && foundAgg) {
            console.log('\n🎉 All tests passed!');
            process.exit(0);
        } else {
            console.log('\n⚠️  Some tests failed. Check logs for details.');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run test
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

