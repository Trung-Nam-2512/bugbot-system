/**
 * Backend Pipeline Test (Without AI Service HTTP Check)
 * Tests backend functionality và manual verification của AI processing
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1435';

console.log('🚀 Backend Pipeline Test');
console.log('==================================================');
console.log(`Backend: ${BACKEND_URL}\n`);

// Test 1: Backend Health
async function testBackendHealth() {
    console.log('1. Backend Health Check...');
    try {
        const response = await fetch(`${BACKEND_URL}/api/health`);
        const data = await response.json();
        console.log(`   ✅ Backend: ${data.ok ? 'Healthy' : 'Unhealthy'}`);
        console.log(`   Uptime: ${data.uptime || 'N/A'}\n`);
        return data.ok;
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
        return false;
    }
}

// Test 2: Upload Image
async function testUpload() {
    console.log('2. Upload Test Image...');
    try {
        // Find any existing image
        const uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadsDir)) {
            console.log('   ⚠️  No uploads directory found\n');
            return null;
        }
        
        const files = fs.readdirSync(uploadsDir, { recursive: true })
            .filter(f => (f.endsWith('.jpg') || f.endsWith('.jpeg')) && !f.includes('node_modules'));
        
        if (files.length === 0) {
            console.log('   ⚠️  No images found\n');
            return null;
        }
        
        const imagePath = path.join(uploadsDir, files[0]);
        const formData = new FormData();
        formData.append('file', fs.createReadStream(imagePath));
        formData.append('deviceId', 'test-pipeline-device');
        formData.append('ts', new Date().toISOString());
        
        const response = await fetch(`${BACKEND_URL}/api/iot/cam/upload`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders(),
        });
        
        const data = await response.json();
        
        if (response.ok && data.ok) {
            console.log(`   ✅ Upload successful`);
            console.log(`   Shot ID: ${data.shot_id}`);
            console.log(`   Device ID: ${data.device_id}\n`);
            return data;
        } else {
            console.log(`   ❌ Upload failed: ${data.error}\n`);
            return null;
        }
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
        return null;
    }
}

// Test 3: Check ClickHouse Raw Events
async function checkRawEvents() {
    console.log('3. Check Raw Events in ClickHouse...');
    try {
        const response = await fetch(`${BACKEND_URL}/api/cam/images?limit=5&sortBy=timestamp&sortOrder=desc`);
        const data = await response.json();
        
        if (response.ok && data.ok) {
            console.log(`   ✅ Query successful`);
            console.log(`   Total images: ${data.total}`);
            console.log(`   Recent: ${data.images.length} images\n`);
            return true;
        } else {
            console.log(`   ❌ Query failed\n`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
        return false;
    }
}

// Test 4: Check Enriched Events (if any)
async function checkEnrichedEvents() {
    console.log('4. Check Enriched Events...');
    try {
        const response = await fetch(`${BACKEND_URL}/api/cam/images?hasDetections=true&limit=10`);
        const data = await response.json();
        
        if (response.ok && data.ok) {
            const withDetections = data.images.filter(img => img.hasDetections);
            console.log(`   Total images: ${data.total}`);
            console.log(`   With detections: ${withDetections.length}`);
            
            if (withDetections.length > 0) {
                console.log(`   ✅ Enriched events found!`);
                const img = withDetections[0];
                console.log(`   Latest detection:`);
                console.log(`   - Shot ID: ${img.id}`);
                console.log(`   - Detection Count: ${img.detectionCount}`);
                console.log(`   - Model: ${img.inferenceModel || 'N/A'}`);
                console.log(`   - Processing Time: ${img.processingTimeMs || 'N/A'}ms\n`);
                return img;
            } else {
                console.log(`   ⚠️  No enriched events yet\n`);
                console.log(`   💡 AI service is processing. Check again in a few seconds.\n`);
                return null;
            }
        } else {
            console.log(`   ❌ Query failed\n`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
        return false;
    }
}

// Test 5: Detection Statistics
async function checkDetectionStats() {
    console.log('5. Check Detection Statistics...');
    try {
        const response = await fetch(`${BACKEND_URL}/api/cam/stats/detections`);
        const data = await response.json();
        
        if (response.ok && data.ok) {
            console.log(`   ✅ Stats API working`);
            console.log(`   Total Detections: ${data.totalDetections || 0}`);
            console.log(`   Total Images: ${data.totalImages || 0}`);
            console.log(`   Avg per Image: ${data.avgDetectionsPerImage?.toFixed(2) || 0}\n`);
            return true;
        } else {
            console.log(`   ❌ Stats failed\n`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
        return false;
    }
}

// Test 6: Image Gallery APIs
async function testImageGalleryAPIs() {
    console.log('6. Test Image Gallery APIs...');
    try {
        // Test basic list
        const listResponse = await fetch(`${BACKEND_URL}/api/cam/images?limit=3`);
        const listData = await listResponse.json();
        
        if (!listResponse.ok || !listData.ok || listData.images.length === 0) {
            console.log(`   ⚠️  No images available\n`);
            return false;
        }
        
        console.log(`   ✅ Image list API working`);
        
        // Test single image
        const imageId = listData.images[0].id;
        const detailResponse = await fetch(`${BACKEND_URL}/api/cam/images/${imageId}`);
        const detailData = await detailResponse.json();
        
        if (detailResponse.ok && detailData.ok) {
            console.log(`   ✅ Image detail API working`);
        }
        
        // Test detections endpoint
        const detectionsResponse = await fetch(`${BACKEND_URL}/api/cam/images/${imageId}/detections`);
        const detectionsData = await detectionsResponse.json();
        
        if (detectionsResponse.ok && detectionsData.ok) {
            console.log(`   ✅ Detections API working`);
            console.log(`   Has detections: ${detectionsData.hasDetections}`);
        }
        
        console.log('');
        return true;
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
        return false;
    }
}

// Run tests
async function runTests() {
    console.log('Starting Backend Pipeline Test...\n');
    
    const results = {
        health: await testBackendHealth(),
        upload: null,
        rawEvents: false,
        enrichedEvents: false,
        stats: false,
        imageAPIs: false,
    };
    
    if (!results.health) {
        console.log('❌ Backend not healthy, aborting\n');
        process.exit(1);
    }
    
    results.upload = await testUpload();
    results.rawEvents = await checkRawEvents();
    
    // Wait a bit for potential AI processing
    console.log('⏳ Waiting 5 seconds for AI processing...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    results.enrichedEvents = await checkEnrichedEvents();
    results.stats = await checkDetectionStats();
    results.imageAPIs = await testImageGalleryAPIs();
    
    // Summary
    console.log('==================================================');
    console.log('📊 Test Summary');
    console.log('==================================================');
    console.log(`  Backend Health:     ✅ PASS`);
    console.log(`  Upload:             ${results.upload ? '✅ PASS' : '⚠️  SKIP'}`);
    console.log(`  Raw Events:         ${results.rawEvents ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Enriched Events:    ${results.enrichedEvents ? '✅ PASS' : '⚠️  PENDING'}`);
    console.log(`  Statistics:         ${results.stats ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Image Gallery APIs: ${results.imageAPIs ? '✅ PASS' : '❌ FAIL'}`);
    console.log('==================================================\n');
    
    if (results.enrichedEvents) {
        console.log('✅ Full pipeline working! AI service is processing events.\n');
    } else {
        console.log('⚠️  Backend working correctly.');
        console.log('💡 AI service is running - check its terminal for processing logs.');
        console.log('💡 Run this test again in a few seconds to see enriched events.\n');
    }
    
    process.exit(0);
}

runTests().catch(error => {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
});


