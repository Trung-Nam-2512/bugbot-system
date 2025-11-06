#!/usr/bin/env node
/**
 * Test ClickHouse Format
 * Test với format timestamp đúng
 */

require('dotenv').config();
const { createClient } = require('@clickhouse/client');

const clickhouseClient = createClient({
    host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || 'clickhouse123',
    database: process.env.CLICKHOUSE_DATABASE || 'iot',
});

async function test() {
    console.log('🧪 Testing ClickHouse Insert with Correct Format...\n');

    // Format timestamp đúng: YYYY-MM-DD HH:MM:SS.mmm
    const now = new Date();
    const formatTimestamp = (dt) => {
        const date = dt instanceof Date ? dt : new Date(dt);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    };

    const timestampStr = formatTimestamp(now);
    const receivedAtStr = formatTimestamp(now);

    console.log('Formatted timestamp:', timestampStr);
    console.log('');

    const query = `
        INSERT INTO iot.events_raw (
            device_id,
            timestamp,
            shot_id,
            image_url,
            image_size,
            image_md5,
            mime_type,
            firmware_version,
            ip_address,
            extra,
            received_at
        ) VALUES (
            {device_id: String},
            {timestamp: DateTime64(3)},
            {shot_id: String},
            {image_url: String},
            {image_size: UInt64},
            {image_md5: String},
            {mime_type: String},
            {firmware_version: String},
            {ip_address: String},
            {extra: String},
            {received_at: DateTime64(3)}
        )
    `;

    try {
        console.log('Inserting with query parameters...');

        await clickhouseClient.command({
            query,
            query_params: {
                device_id: 'test-format-query',
                timestamp: timestampStr,
                shot_id: 'test-shot-format',
                image_url: 'http://localhost:9000/test.jpg',
                image_size: 100000,
                image_md5: 'test-md5-format',
                mime_type: 'image/jpeg',
                firmware_version: '1.0.0',
                ip_address: '192.168.1.100',
                extra: '{"test": true}',
                received_at: receivedAtStr,
            },
        });

        console.log('✅ Insert successful!');

        // Verify
        const result = await clickhouseClient.query({
            query: 'SELECT * FROM iot.events_raw WHERE device_id = {device_id:String} ORDER BY timestamp DESC LIMIT 1',
            query_params: { device_id: 'test-format-query' },
            format: 'JSONEachRow',
        });

        const data = await result.json();
        console.log('\n✅ Verified in ClickHouse:');
        console.log(JSON.stringify(data[0], null, 2));

    } catch (error) {
        console.error('❌ Insert failed!');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

test().catch(console.error);









