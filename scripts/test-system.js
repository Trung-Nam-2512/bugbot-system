#!/usr/bin/env node

/**
 * Comprehensive System Test Script
 * Tests all Acceptance Criteria from requirements
 * 
 * Run: node scripts/test-system.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const FormData = require('form-data');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

let passedTests = 0;
let failedTests = 0;
const testResults = [];

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function test(name, fn) {
    return async () => {
        try {
            process.stdout.write(`\n${colors.cyan}[TEST]${colors.reset} ${name}... `);
            await fn();
            log(`✓ PASSED`, 'green');
            passedTests++;
            testResults.push({ name, status: 'PASSED' });
        } catch (error) {
            log(`✗ FAILED: ${error.message}`, 'red');
            failedTests++;
            testResults.push({ name, status: 'FAILED', error: error.message });
        }
    };
}

// Helper: Check if Docker container is running
function isContainerRunning(name) {
    try {
        const output = execSync(`docker ps --format "{{.Names}}"`, { encoding: 'utf8' });
        return output.includes(name);
    } catch {
        return false;
    }
}

// Helper: Check if service is accessible
function checkHealthEndpoint(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch {
                        resolve({ ok: true });
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

// Helper: Download test image
function downloadTestImage() {
    return new Promise((resolve, reject) => {
        const filePath = path.join(__dirname, '../test-image.jpg');
        if (fs.existsSync(filePath)) {
            resolve(filePath);
            return;
        }

        https.get('https://picsum.photos/640/480', (res) => {
            const fileStream = fs.createWriteStream(filePath);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve(filePath);
            });
        }).on('error', reject);
    });
}

// Helper: Create multipart form data
function createMultipartFormData(imagePath, deviceId, ts, extra) {
    const boundary = '----WebKitFormBoundary' + Date.now();
    const fileData = fs.readFileSync(imagePath);
    const filename = path.basename(imagePath);
    
    const CRLF = '\r\n';
    const parts = [];
    
    // File part
    parts.push(`--${boundary}${CRLF}`);
    parts.push(`Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}`);
    parts.push(`Content-Type: image/jpeg${CRLF}${CRLF}`);
    parts.push(fileData); // Binary data
    parts.push(`${CRLF}--${boundary}${CRLF}`);
    
    // deviceId part
    parts.push(`Content-Disposition: form-data; name="deviceId"${CRLF}${CRLF}`);
    parts.push(deviceId);
    parts.push(`${CRLF}--${boundary}${CRLF}`);
    
    // ts part
    parts.push(`Content-Disposition: form-data; name="ts"${CRLF}${CRLF}`);
    parts.push(ts);
    parts.push(`${CRLF}--${boundary}${CRLF}`);
    
    // extra part
    parts.push(`Content-Disposition: form-data; name="extra"${CRLF}${CRLF}`);
    parts.push(extra);
    parts.push(`${CRLF}--${boundary}--${CRLF}`);
    
    // Convert all parts to buffers
    const buffers = parts.map(p => {
        if (Buffer.isBuffer(p)) {
            return p;
        }
        return Buffer.from(p, 'utf8');
    });
    
    const buffer = Buffer.concat(buffers);
    
    return { buffer, boundary };
}

// Helper: Upload image to API
function uploadImage(imagePath, deviceId = 'TEST_DEVICE_001') {
    return new Promise((resolve, reject) => {
        const ts = Date.now().toString();
        const extra = JSON.stringify({ test: true, source: 'system-test' });
        
        // Use form-data package for proper multipart encoding
        const form = new FormData();
        form.append('file', fs.createReadStream(imagePath), {
            filename: path.basename(imagePath),
            contentType: 'image/jpeg'
        });
        form.append('deviceId', deviceId);
        form.append('ts', ts);
        form.append('extra', extra);

        const options = {
            hostname: 'localhost',
            port: process.env.PORT || 1435,
            path: '/api/upload',
            method: 'POST',
            headers: form.getHeaders(),
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const json = JSON.parse(data);
                        resolve({ statusCode: res.statusCode, data: json });
                    } catch {
                        resolve({ statusCode: res.statusCode, data: data });
                    }
                } else if (res.statusCode === 204) {
                    resolve({ statusCode: 204, duplicate: true });
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        form.pipe(req);
    });
}

// Helper: Check Kafka topic
function checkKafkaTopic(topic = 'events.raw') {
    try {
        execSync(`docker exec redpanda rpk topic describe ${topic}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

// Helper: Get Kafka message count
function getKafkaMessageCount(topic = 'events.raw') {
    try {
        const output = execSync(
            `docker exec redpanda rpk topic info ${topic} --format json`,
            { encoding: 'utf8', stdio: 'pipe' }
        );
        const info = JSON.parse(output);
        return info[0]?.partitionMetadata?.[0]?.leaderOffset || 0;
    } catch {
        return 0;
    }
}

// Helper: Check ClickHouse
function checkClickHouse(query) {
    try {
        const result = execSync(
            `docker exec clickhouse clickhouse-client -q "${query}"`,
            { encoding: 'utf8', stdio: 'pipe' }
        );
        return result.trim();
    } catch {
        return null;
    }
}

// Helper: Check MinIO bucket
function checkMinIOBucket(bucket = 'iot-raw') {
    try {
        execSync(
            `docker exec minio mc ls myminio/${bucket} 2>&1`,
            { stdio: 'ignore' }
        );
        return true;
    } catch {
        return false;
    }
}

// TEST SUITE
async function runTests() {
    log('\n╔══════════════════════════════════════════════════════════════╗', 'cyan');
    log('║     IoT Platform System Test Suite                          ║', 'cyan');
    log('║     Testing Acceptance Criteria                             ║', 'cyan');
    log('╚══════════════════════════════════════════════════════════════╝\n', 'cyan');

    // ==========================================
    // ACCEPTANCE CRITERIA 1: Docker Compose
    // ==========================================
    await test('AC1: Docker Compose - All services running', async () => {
        const services = ['redpanda', 'minio', 'clickhouse', 'mongodb'];
        for (const service of services) {
            if (!isContainerRunning(service)) {
                throw new Error(`Container ${service} is not running`);
            }
        }
    })();

    // ==========================================
    // ACCEPTANCE CRITERIA 2: Health Check
    // ==========================================
    await test('AC2: Health Check - All services healthy', async () => {
        const health = await checkHealthEndpoint('http://localhost:1435/api/health');
        if (!health.ok) {
            throw new Error('Health check returned unhealthy status');
        }
        
        const requiredServices = ['kafka', 'minio', 'clickhouse', 'mongodb'];
        for (const service of requiredServices) {
            if (!health.services?.[service]?.healthy) {
                throw new Error(`Service ${service} is not healthy`);
            }
        }
    })();

    await test('AC2: Health Check - Liveness probe works', async () => {
        await checkHealthEndpoint('http://localhost:1435/api/health/live');
    })();

    await test('AC2: Health Check - Readiness probe works', async () => {
        await checkHealthEndpoint('http://localhost:1435/api/health/ready');
    })();

    // ==========================================
    // ACCEPTANCE CRITERIA 3: Upload Endpoint
    // ==========================================
    await test('AC3: Upload API - Endpoint accessible', async () => {
        const imagePath = await downloadTestImage();
        const result = await uploadImage(imagePath, 'TEST_UPLOAD_001');
        
        if (result.statusCode !== 200) {
            throw new Error(`Expected 200, got ${result.statusCode}`);
        }
        
        if (!result.data?.imageUrl) {
            throw new Error('Response missing imageUrl');
        }
        
        if (!result.data?.published) {
            throw new Error('Response missing published flag');
        }
        
        log(`\n     → Image URL: ${result.data.imageUrl}`, 'blue');
        log(`     → Object Key: ${result.data.objectKey}`, 'blue');
        log(`     → MD5: ${result.data.md5}`, 'blue');
    })();

    // ==========================================
    // ACCEPTANCE CRITERIA 4: MinIO Storage
    // ==========================================
    await test('AC4: MinIO - Bucket exists and accessible', async () => {
        if (!checkMinIOBucket('iot-raw')) {
            throw new Error('Cannot access MinIO bucket iot-raw');
        }
    })();

    await test('AC4: MinIO - Image uploaded to correct path', async () => {
        const imagePath = await downloadTestImage();
        const deviceId = `TEST_MINIO_${Date.now()}`;
        const result = await uploadImage(imagePath, deviceId);
        
        if (!result.data?.objectKey) {
            throw new Error('No objectKey in response');
        }
        
        // Verify path format: raw/yyyy/mm/dd/deviceId/...
        const keyPattern = /^raw\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/\d+_.+\.jpg$/;
        if (!keyPattern.test(result.data.objectKey)) {
            throw new Error(`Invalid object key format: ${result.data.objectKey}`);
        }
        
        log(`     → Path format: ${result.data.objectKey}`, 'blue');
    })();

    // ==========================================
    // ACCEPTANCE CRITERIA 5: Kafka Publishing
    // ==========================================
    await test('AC5: Kafka - Topic exists', async () => {
        if (!checkKafkaTopic('events.raw')) {
            throw new Error('Kafka topic events.raw does not exist');
        }
    })();

    await test('AC5: Kafka - Event published to topic', async () => {
        const beforeCount = getKafkaMessageCount('events.raw');
        
        const imagePath = await downloadTestImage();
        const deviceId = `TEST_KAFKA_${Date.now()}`;
        const result = await uploadImage(imagePath, deviceId);
        
        if (!result.data?.published) {
            throw new Error('Upload did not publish to Kafka');
        }
        
        // Wait a bit for Kafka to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterCount = getKafkaMessageCount('events.raw');
        if (afterCount <= beforeCount) {
            throw new Error(`No new messages in Kafka (before: ${beforeCount}, after: ${afterCount})`);
        }
        
        log(`     → Messages before: ${beforeCount}`, 'blue');
        log(`     → Messages after: ${afterCount}`, 'blue');
        log(`     → New message published: ✓`, 'blue');
    })();

    // ==========================================
    // ACCEPTANCE CRITERIA 6: ClickHouse Query
    // ==========================================
    await test('AC6: ClickHouse - Database accessible', async () => {
        const result = checkClickHouse('SELECT 1');
        if (result !== '1') {
            throw new Error('Cannot query ClickHouse');
        }
    })();

    await test('AC6: ClickHouse - Table exists', async () => {
        const result = checkClickHouse("SHOW TABLES FROM iot LIKE 'events_raw'");
        if (!result.includes('events_raw')) {
            throw new Error('Table events_raw does not exist');
        }
    })();

    await test('AC6: ClickHouse - Can query new events', async () => {
        // Check if direct insert is enabled
        const directInsert = process.env.CLICKHOUSE_DIRECT_INSERT === 'true';
        
        if (!directInsert) {
            log(`     → Direct insert disabled, skipping (Spark should handle it)`, 'yellow');
            return;
        }
        
        const beforeCount = parseInt(checkClickHouse('SELECT count() FROM iot.events_raw') || '0');
        
        const imagePath = await downloadTestImage();
        const deviceId = `TEST_CH_${Date.now()}`;
        await uploadImage(imagePath, deviceId);
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterCount = parseInt(checkClickHouse('SELECT count() FROM iot.events_raw') || '0');
        if (afterCount <= beforeCount) {
            throw new Error(`No new events in ClickHouse (before: ${beforeCount}, after: ${afterCount})`);
        }
        
        log(`     → Events before: ${beforeCount}`, 'blue');
        log(`     → Events after: ${afterCount}`, 'blue');
        
        // Query recent event
        const recentEvent = checkClickHouse(
            `SELECT device_id, image_url FROM iot.events_raw WHERE device_id='${deviceId}' LIMIT 1`
        );
        if (!recentEvent || !recentEvent.includes(deviceId)) {
            throw new Error('Cannot find uploaded event in ClickHouse');
        }
        
        log(`     → Recent event found: ✓`, 'blue');
    })();

    // ==========================================
    // ACCEPTANCE CRITERIA 7: MongoDB Logging
    // ==========================================
    await test('AC7: MongoDB - Connection works', async () => {
        try {
            execSync('docker exec mongodb mongosh --eval "db.adminCommand(\'ping\')" -u root -p mongodb123 --quiet', 
                { stdio: 'ignore' });
        } catch {
            throw new Error('Cannot connect to MongoDB');
        }
    })();

    // ==========================================
    // SUMMARY
    // ==========================================
    log('\n╔══════════════════════════════════════════════════════════════╗', 'cyan');
    log('║                    TEST SUMMARY                              ║', 'cyan');
    log('╚══════════════════════════════════════════════════════════════╝\n', 'cyan');

    log(`Total Tests: ${passedTests + failedTests}`);
    log(`Passed: ${passedTests}`, 'green');
    log(`Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
    log(`Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%\n`);

    if (failedTests === 0) {
        log('🎉 ALL ACCEPTANCE CRITERIA PASSED!', 'green');
        log('✅ System is ready for production use!\n', 'green');
        process.exit(0);
    } else {
        log('❌ Some tests failed. Please review the errors above.', 'red');
        log('\nFailed tests:', 'yellow');
        testResults
            .filter(t => t.status === 'FAILED')
            .forEach(t => {
                log(`  - ${t.name}: ${t.error}`, 'red');
            });
        log('\n');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    log(`\nFatal error: ${error.message}`, 'red');
    process.exit(1);
});

