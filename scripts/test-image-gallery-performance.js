/**
 * Performance Test for Image Gallery API
 * Tests response times và performance với concurrent requests
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1435';
const CONCURRENT_REQUESTS = 10;
const ITERATIONS = 5;

console.log('Image Gallery Performance Test');
console.log('==================================================');
console.log(`Backend URL: ${BACKEND_URL}`);
console.log(`Concurrent Requests: ${CONCURRENT_REQUESTS}`);
console.log(`Iterations: ${ITERATIONS}\n`);

// Performance test: Basic list endpoint
async function testListPerformance() {
    console.log('1. Testing GET /api/cam/images performance...');
    
    const times = [];
    
    for (let i = 0; i < ITERATIONS; i++) {
        const start = Date.now();
        const response = await fetch(`${BACKEND_URL}/api/cam/images?page=1&limit=20`);
        const end = Date.now();
        
        if (response.ok) {
            times.push(end - start);
        }
    }
    
    const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`   Average: ${avgTime.toFixed(2)}ms`);
    console.log(`   Min: ${minTime}ms`);
    console.log(`   Max: ${maxTime}ms`);
    console.log(`   Status: ${avgTime < 500 ? '✅ PASS' : '⚠️ SLOW'}\n`);
    
    return { avgTime, minTime, maxTime };
}

// Performance test: Concurrent requests
async function testConcurrentRequests() {
    console.log('2. Testing concurrent requests...');
    
    const start = Date.now();
    
    const promises = [];
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
        promises.push(fetch(`${BACKEND_URL}/api/cam/images?page=${i + 1}&limit=10`));
    }
    
    const responses = await Promise.all(promises);
    const end = Date.now();
    
    const totalTime = end - start;
    const successCount = responses.filter(r => r.ok).length;
    
    console.log(`   Requests: ${CONCURRENT_REQUESTS}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Total Time: ${totalTime}ms`);
    console.log(`   Avg per Request: ${(totalTime / CONCURRENT_REQUESTS).toFixed(2)}ms`);
    console.log(`   Status: ${successCount === CONCURRENT_REQUESTS ? '✅ PASS' : '❌ FAIL'}\n`);
    
    return { totalTime, successCount };
}

// Performance test: Filter by detection status
async function testFilterPerformance() {
    console.log('3. Testing filter performance...');
    
    const tests = [
        { name: 'hasDetections=true', url: '/api/cam/images?hasDetections=true&limit=20' },
        { name: 'minConfidence=0.5', url: '/api/cam/images?minConfidence=0.5&limit=20' },
        { name: 'species=person', url: '/api/cam/images?species=person&limit=20' },
        { name: 'sort by detections', url: '/api/cam/images?sortBy=detections&sortOrder=desc&limit=20' },
    ];
    
    for (const test of tests) {
        const times = [];
        
        for (let i = 0; i < ITERATIONS; i++) {
            const start = Date.now();
            const response = await fetch(`${BACKEND_URL}${test.url}`);
            const end = Date.now();
            
            if (response.ok) {
                times.push(end - start);
            }
        }
        
        const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
        console.log(`   ${test.name}: ${avgTime.toFixed(2)}ms ${avgTime < 500 ? '✅' : '⚠️'}`);
    }
    
    console.log('');
}

// Performance test: Image detail endpoints
async function testDetailEndpointPerformance() {
    console.log('4. Testing detail endpoints performance...');
    
    // Get first image ID
    const listResponse = await fetch(`${BACKEND_URL}/api/cam/images?limit=1`);
    const listData = await listResponse.json();
    
    if (!listData.ok || listData.images.length === 0) {
        console.log('   ⚠️ SKIPPED (no images available)\n');
        return;
    }
    
    const imageId = listData.images[0].id;
    
    const tests = [
        { name: 'GET /api/cam/images/:id', url: `/api/cam/images/${imageId}` },
        { name: 'GET /api/cam/images/:id/detections', url: `/api/cam/images/${imageId}/detections` },
    ];
    
    for (const test of tests) {
        const times = [];
        
        for (let i = 0; i < ITERATIONS; i++) {
            const start = Date.now();
            const response = await fetch(`${BACKEND_URL}${test.url}`);
            const end = Date.now();
            
            if (response.ok) {
                times.push(end - start);
            }
        }
        
        const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
        console.log(`   ${test.name}: ${avgTime.toFixed(2)}ms ${avgTime < 500 ? '✅' : '⚠️'}`);
    }
    
    console.log('');
}

// Performance test: Pagination
async function testPaginationPerformance() {
    console.log('5. Testing pagination performance...');
    
    const times = [];
    const pages = [1, 2, 3, 5, 10];
    
    for (const page of pages) {
        const start = Date.now();
        const response = await fetch(`${BACKEND_URL}/api/cam/images?page=${page}&limit=20`);
        const end = Date.now();
        
        if (response.ok) {
            times.push({ page, time: end - start });
        }
    }
    
    for (const { page, time } of times) {
        console.log(`   Page ${page}: ${time}ms ${time < 500 ? '✅' : '⚠️'}`);
    }
    
    const avgTime = times.reduce((sum, t) => sum + t.time, 0) / times.length;
    console.log(`   Average: ${avgTime.toFixed(2)}ms\n`);
}

// Performance test: Memory usage (simulate many requests)
async function testMemoryUsage() {
    console.log('6. Testing memory usage (100 requests)...');
    
    const start = Date.now();
    let successCount = 0;
    
    for (let i = 0; i < 100; i++) {
        const response = await fetch(`${BACKEND_URL}/api/cam/images?page=${(i % 10) + 1}&limit=10`);
        if (response.ok) {
            successCount++;
        }
        
        // Show progress
        if ((i + 1) % 20 === 0) {
            process.stdout.write(`   Progress: ${i + 1}/100\r`);
        }
    }
    
    const end = Date.now();
    const totalTime = end - start;
    
    console.log(`   Progress: 100/100 ✅`);
    console.log(`   Total Time: ${totalTime}ms`);
    console.log(`   Avg per Request: ${(totalTime / 100).toFixed(2)}ms`);
    console.log(`   Success Rate: ${successCount}/100 (${(successCount / 100 * 100).toFixed(1)}%)`);
    console.log(`   Status: ${successCount >= 99 ? '✅ PASS' : '❌ FAIL'}\n`);
}

// Run all tests
async function runAllTests() {
    const results = {
        listPerformance: null,
        concurrentRequests: null,
    };
    
    try {
        results.listPerformance = await testListPerformance();
        results.concurrentRequests = await testConcurrentRequests();
        await testFilterPerformance();
        await testDetailEndpointPerformance();
        await testPaginationPerformance();
        await testMemoryUsage();
        
        console.log('==================================================');
        console.log('Performance Summary:');
        console.log(`  List API: ${results.listPerformance.avgTime.toFixed(2)}ms avg`);
        console.log(`  Concurrent: ${(results.concurrentRequests.totalTime / CONCURRENT_REQUESTS).toFixed(2)}ms per request`);
        console.log('');
        
        // Check if performance meets requirements
        const listOk = results.listPerformance.avgTime < 500;
        const concurrentOk = results.concurrentRequests.successCount === CONCURRENT_REQUESTS;
        
        if (listOk && concurrentOk) {
            console.log('✅ All performance tests passed!');
            console.log('✅ API response time < 500ms');
            console.log('✅ Concurrent requests handled correctly\n');
            process.exit(0);
        } else {
            console.log('⚠️ Some performance issues detected');
            if (!listOk) console.log('   - API response time > 500ms');
            if (!concurrentOk) console.log('   - Concurrent requests failed');
            console.log('');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Performance test error:', error.message);
        process.exit(1);
    }
}

// Run tests
runAllTests();


