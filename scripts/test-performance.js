#!/usr/bin/env node
/**
 * Performance Test Script
 * 
 * Test với concurrent uploads và measure performance
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { createClient } = require('@clickhouse/client');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1435';
const CONCURRENT_UPLOADS = parseInt(process.env.PERF_TEST_UPLOADS || '50', 10);

const clickhouseClient = createClient({
    url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || 'clickhouse123',
    database: process.env.CLICKHOUSE_DATABASE || 'iot',
});

/**
 * Upload single image
 */
async function uploadImage(deviceId, imagePath, index) {
    const startTime = Date.now();

    try {
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

        const latency = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                latency,
                index,
                error: `${response.status}: ${errorText}`,
            };
        }

        const result = await response.json();
        return {
            success: true,
            latency,
            index,
            shotId: result.shot_id || result.id,
        };
    } catch (error) {
        return {
            success: false,
            latency: Date.now() - startTime,
            index,
            error: error.message,
        };
    }
}

/**
 * Check ClickHouse events count
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
    console.log('🚀 Performance Test');
    console.log('===================\n');

    const deviceId = `perf-test-device-${Date.now()}`;
    const imagePath = path.join(__dirname, '../test-image.jpg');

    if (!fs.existsSync(imagePath)) {
        console.error(`❌ Test image not found: ${imagePath}`);
        process.exit(1);
    }

    console.log(`📊 Configuration:`);
    console.log(`  - Concurrent uploads: ${CONCURRENT_UPLOADS}`);
    console.log(`  - Device ID: ${deviceId}`);
    console.log(`  - Backend: ${BACKEND_URL}\n`);

    const startTime = Date.now();
    const results = [];

    console.log(`📤 Uploading ${CONCURRENT_UPLOADS} images...\n`);

    // Create concurrent uploads
    const uploadPromises = [];
    for (let i = 0; i < CONCURRENT_UPLOADS; i++) {
        uploadPromises.push(uploadImage(deviceId, imagePath, i));
    }

    // Wait for all uploads
    const uploadResults = await Promise.allSettled(uploadPromises);

    uploadResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            results.push(result.value);
        } else {
            results.push({
                success: false,
                index,
                error: result.reason?.message || 'Unknown error',
            });
        }
    });

    const totalTime = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const latencies = results.filter(r => r.success).map(r => r.latency);
    const avgLatency = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;
    const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

    console.log(`\n⏳ Waiting 10 seconds for stream processor...`);
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check ClickHouse
    const clickhouseCount = await getClickHouseCount(deviceId);

    // Print results
    console.log('\n📊 Performance Test Results');
    console.log('==========================\n');
    console.log(`Total uploads: ${CONCURRENT_UPLOADS}`);
    console.log(`Successful: ${successful} (${((successful / CONCURRENT_UPLOADS) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failed}`);
    console.log(`\nTiming:`);
    console.log(`  Total time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    console.log(`  Throughput: ${((CONCURRENT_UPLOADS / totalTime) * 1000).toFixed(2)} uploads/second`);
    console.log(`\nLatency:`);
    console.log(`  Average: ${avgLatency.toFixed(0)}ms`);
    console.log(`  Min: ${minLatency}ms`);
    console.log(`  Max: ${maxLatency}ms`);
    console.log(`\nClickHouse:`);
    console.log(`  Events in ClickHouse: ${clickhouseCount}`);
    console.log(`  Expected: ${successful}`);
    console.log(`  Match: ${clickhouseCount === successful ? '✅' : '⚠️'}`);

    if (failed > 0) {
        console.log(`\n⚠️  Failed uploads:`);
        results.filter(r => !r.success).forEach(r => {
            console.log(`  - Upload #${r.index}: ${r.error}`);
        });
    }

    // Summary
    console.log('\n📋 Summary:');
    if (successful === CONCURRENT_UPLOADS && clickhouseCount === successful) {
        console.log('✅ All tests passed!');
        process.exit(0);
    } else {
        console.log('⚠️  Some tests failed or data mismatch');
        process.exit(1);
    }
}

runPerformanceTest().catch(console.error);

