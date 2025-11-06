#!/usr/bin/env node
/**
 * Test Detection Statistics Endpoints
 * 
 * Test script để verify detection statistics API endpoints
 */

require('dotenv').config();
const http = require('http');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1435';
const API_BASE = `${BACKEND_URL}/api/cam/stats`;

/**
 * Make HTTP request
 */
function makeRequest(path, queryParams = {}) {
    return new Promise((resolve, reject) => {
        const queryString = Object.keys(queryParams)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
            .join('&');
        
        const url = queryString ? `${path}?${queryString}` : path;
        
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ statusCode: res.statusCode, data: json });
                } catch (error) {
                    resolve({ statusCode: res.statusCode, data: data });
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * Test overall detection stats
 */
async function testOverallStats() {
    console.log('\n1. Testing GET /api/cam/stats/detections...');
    try {
        const response = await makeRequest(`${API_BASE}/detections`);
        if (response.statusCode === 200 && response.data.ok) {
            console.log('   ✅ PASSED');
            console.log(`   Total Detections: ${response.data.totalDetections || 0}`);
            console.log(`   Total Images: ${response.data.totalImages || 0}`);
            console.log(`   Avg per Image: ${response.data.avgDetectionsPerImage || 0}`);
            return true;
        } else {
            console.log(`   ❌ FAILED: ${response.statusCode}`);
            console.log(`   Response:`, JSON.stringify(response.data, null, 2));
            return false;
        }
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        return false;
    }
}

/**
 * Test species distribution
 */
async function testSpeciesStats() {
    console.log('\n2. Testing GET /api/cam/stats/species...');
    try {
        const response = await makeRequest(`${API_BASE}/species`);
        if (response.statusCode === 200 && response.data.ok) {
            console.log('   ✅ PASSED');
            console.log(`   Total Detections: ${response.data.totalDetections || 0}`);
            console.log(`   Species Count: ${response.data.distribution?.length || 0}`);
            if (response.data.distribution && response.data.distribution.length > 0) {
                console.log(`   Top Species: ${response.data.distribution[0].species} (${response.data.distribution[0].count})`);
            }
            return true;
        } else {
            console.log(`   ❌ FAILED: ${response.statusCode}`);
            console.log(`   Response:`, JSON.stringify(response.data, null, 2));
            return false;
        }
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        return false;
    }
}

/**
 * Test confidence distribution
 */
async function testConfidenceStats() {
    console.log('\n3. Testing GET /api/cam/stats/confidence...');
    try {
        const response = await makeRequest(`${API_BASE}/confidence`);
        if (response.statusCode === 200 && response.data.ok) {
            console.log('   ✅ PASSED');
            console.log(`   Avg Confidence: ${response.data.avgConfidence || 0}`);
            console.log(`   Min Confidence: ${response.data.minConfidence || 0}`);
            console.log(`   Max Confidence: ${response.data.maxConfidence || 0}`);
            console.log(`   Distribution Ranges: ${response.data.distribution?.length || 0}`);
            return true;
        } else {
            console.log(`   ❌ FAILED: ${response.statusCode}`);
            console.log(`   Response:`, JSON.stringify(response.data, null, 2));
            return false;
        }
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        return false;
    }
}

/**
 * Test detection timeline
 */
async function testTimelineStats() {
    console.log('\n4. Testing GET /api/cam/stats/detections/timeline...');
    try {
        // Test với period=day
        const response = await makeRequest(`${API_BASE}/detections/timeline`, { period: 'day' });
        if (response.statusCode === 200 && response.data.ok) {
            console.log('   ✅ PASSED (period=day)');
            console.log(`   Timeline Points: ${response.data.timeline?.length || 0}`);
            if (response.data.timeline && response.data.timeline.length > 0) {
                const last = response.data.timeline[response.data.timeline.length - 1];
                console.log(`   Latest: ${last.date} - ${last.detectionCount} detections`);
            }
            return true;
        } else {
            console.log(`   ❌ FAILED: ${response.statusCode}`);
            console.log(`   Response:`, JSON.stringify(response.data, null, 2));
            return false;
        }
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        return false;
    }
}

/**
 * Test invalid period
 */
async function testInvalidPeriod() {
    console.log('\n5. Testing invalid period parameter...');
    try {
        const response = await makeRequest(`${API_BASE}/detections/timeline`, { period: 'invalid' });
        if (response.statusCode === 400) {
            console.log('   ✅ PASSED (correctly rejected invalid period)');
            return true;
        } else {
            console.log(`   ❌ FAILED: Expected 400, got ${response.statusCode}`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        return false;
    }
}

/**
 * Main test function
 */
async function main() {
    console.log('Detection Statistics API Test');
    console.log('='.repeat(50));
    console.log(`Backend URL: ${BACKEND_URL}`);

    const results = [];

    results.push(await testOverallStats());
    results.push(await testSpeciesStats());
    results.push(await testConfidenceStats());
    results.push(await testTimelineStats());
    results.push(await testInvalidPeriod());

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('Test Summary:');
    const passed = results.filter(r => r).length;
    const total = results.length;
    console.log(`Passed: ${passed}/${total}`);

    if (passed === total) {
        console.log('\n✅ All tests passed!');
        process.exit(0);
    } else {
        console.log('\n❌ Some tests failed');
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});


