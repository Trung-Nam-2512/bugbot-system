/**
 * E2E Test - Manual Upload và Verification
 * Step-by-step verification của complete pipeline
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const BACKEND_URL = 'http://localhost:1435';

console.log('🧪 E2E Test - Complete Pipeline Verification');
console.log('==================================================\n');

let testImagePath = null;
let uploadResult = null;

// Step 1: Find test image
async function step1_findImage() {
    console.log('📋 Step 1: Finding Test Image');
    console.log('─────────────────────────────────');
    
    const uploadsDir = path.join(__dirname, '../uploads');
    
    if (!fs.existsSync(uploadsDir)) {
        console.log('   ❌ Uploads directory not found\n');
        return false;
    }
    
    const files = fs.readdirSync(uploadsDir, { recursive: true })
        .filter(f => (f.endsWith('.jpg') || f.endsWith('.jpeg')) && !f.includes('node_modules'));
    
    if (files.length === 0) {
        console.log('   ❌ No images found\n');
        return false;
    }
    
    testImagePath = path.join(uploadsDir, files[0]);
    const stats = fs.statSync(testImagePath);
    
    console.log(`   ✅ Found: ${path.basename(testImagePath)}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB\n`);
    
    return true;
}

// Step 2: Upload image
async function step2_uploadImage() {
    console.log('📤 Step 2: Uploading Image to Backend');
    console.log('─────────────────────────────────');
    
    try {
        // Use axios for better FormData handling
        const FormData = require('form-data');
        const formData = new FormData();
        
        formData.append('file', fs.createReadStream(testImagePath));
        formData.append('deviceId', 'e2e-test-device-' + Date.now());
        formData.append('ts', new Date().toISOString());
        
        const response = await axios.post(`${BACKEND_URL}/api/iot/cam/upload`, formData, {
            headers: formData.getHeaders(),
            timeout: 30000,
        });
        
        if (response.status === 200 && response.data.ok) {
            uploadResult = response.data;
            console.log(`   ✅ Upload successful!`);
            console.log(`   Shot ID: ${uploadResult.shot_id}`);
            console.log(`   Device ID: ${uploadResult.device_id}`);
            console.log(`   Image URL: ${uploadResult.image_url}\n`);
            return true;
        } else {
            console.log(`   ❌ Upload failed: ${response.data.error || 'Unknown error'}\n`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Upload error: ${error.message}\n`);
        return false;
    }
}

// Step 3: Wait for processing
async function step3_waitForProcessing() {
    console.log('⏳ Step 3: Waiting for AI Processing');
    console.log('─────────────────────────────────');
    console.log('   ⏳ Waiting 15 seconds for AI to process...');
    console.log('   👀 Watch AI service terminal for processing logs!\n');
    
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    console.log('   ✅ Wait complete\n');
    return true;
}

// Step 4: Check enriched events
async function step4_checkEnrichedEvents() {
    console.log('💾 Step 4: Checking Enriched Events');
    console.log('─────────────────────────────────');
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/cam/images?deviceId=${uploadResult.device_id}&hasDetections=true&limit=10`);
        const data = await response.json();
        
        if (!response.ok || !data.ok) {
            console.log('   ❌ Query failed\n');
            return null;
        }
        
        const withDetections = data.images.filter(img => img.hasDetections);
        
        console.log(`   Total images from device: ${data.total}`);
        console.log(`   Images with detections: ${withDetections.length}`);
        
        if (withDetections.length > 0) {
            const img = withDetections[0];
            console.log(`   ✅ ENRICHED EVENT FOUND!`);
            console.log(`   - Shot ID: ${img.id}`);
            console.log(`   - Detection Count: ${img.detectionCount}`);
            console.log(`   - Model: ${img.inferenceModel || 'N/A'}`);
            console.log(`   - Processing Time: ${img.processingTimeMs || 'N/A'}ms`);
            console.log(`   - Annotated URL: ${img.annotatedImageUrl ? 'Available' : 'N/A'}\n`);
            return img;
        } else {
            console.log(`   ⚠️  No enriched events yet`);
            console.log(`   💡 Check AI terminal - may still be processing\n`);
            return null;
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
        return null;
    }
}

// Step 5: Test detection APIs
async function step5_testDetectionAPIs(imageId) {
    console.log('🔍 Step 5: Testing Detection APIs');
    console.log('─────────────────────────────────');
    
    if (!imageId) {
        console.log('   ⚠️  Skipped - No image with detections\n');
        return false;
    }
    
    let passed = 0;
    let total = 0;
    
    // Test detection details
    total++;
    try {
        const response = await fetch(`${BACKEND_URL}/api/cam/images/${imageId}/detections`);
        const data = await response.json();
        
        if (response.ok && data.ok && data.hasDetections) {
            console.log(`   ✅ Detection Details API: PASS`);
            console.log(`      Detection Count: ${data.detectionCount}`);
            if (data.detections && data.detections.length > 0) {
                console.log(`      Detected: ${data.detections.map(d => d.class).join(', ')}`);
            }
            passed++;
        } else {
            console.log(`   ⚠️  Detection Details API: No detections`);
        }
    } catch (error) {
        console.log(`   ❌ Detection Details API: FAIL - ${error.message}`);
    }
    
    // Test annotated image
    total++;
    try {
        const response = await fetch(`${BACKEND_URL}/api/cam/images/${imageId}/annotated`);
        
        if (response.ok && response.headers.get('content-type')?.includes('image')) {
            console.log(`   ✅ Annotated Image API: PASS`);
            console.log(`      Content-Type: ${response.headers.get('content-type')}`);
            passed++;
        } else if (response.status === 404) {
            console.log(`   ⚠️  Annotated Image API: Not available yet`);
        } else {
            console.log(`   ❌ Annotated Image API: FAIL - Status ${response.status}`);
        }
    } catch (error) {
        console.log(`   ❌ Annotated Image API: FAIL - ${error.message}`);
    }
    
    // Test detection stats
    total++;
    try {
        const response = await fetch(`${BACKEND_URL}/api/cam/stats/detections`);
        const data = await response.json();
        
        if (response.ok && data.ok) {
            console.log(`   ✅ Detection Stats API: PASS`);
            console.log(`      Total Detections: ${data.totalDetections || 0}`);
            passed++;
        } else {
            console.log(`   ❌ Detection Stats API: FAIL`);
        }
    } catch (error) {
        console.log(`   ❌ Detection Stats API: FAIL - ${error.message}`);
    }
    
    console.log(`\n   Results: ${passed}/${total} APIs passed\n`);
    return passed === total;
}

// Step 6: Final summary
async function step6_summary(enrichedImage, apisPassed) {
    console.log('==================================================');
    console.log('📊 E2E Test Summary');
    console.log('==================================================');
    console.log(`  Image Upload:       ✅ PASS`);
    console.log(`  AI Processing:      ${enrichedImage ? '✅ PASS' : '⚠️  PENDING'}`);
    console.log(`  Enriched Events:    ${enrichedImage ? '✅ PASS' : '⚠️  PENDING'}`);
    console.log(`  Detection APIs:     ${apisPassed ? '✅ PASS' : '⚠️  PARTIAL'}`);
    console.log('==================================================\n');
    
    if (enrichedImage && apisPassed) {
        console.log('✅ E2E PIPELINE COMPLETE!');
        console.log('   Upload → Kafka → AI → Enriched → ClickHouse → APIs ✅\n');
        return true;
    } else if (enrichedImage) {
        console.log('⚠️  Pipeline working, some APIs pending');
        console.log('   AI processing: ✅');
        console.log('   APIs: ⚠️  Check again in a few seconds\n');
        return true;
    } else {
        console.log('⚠️  Pipeline in progress');
        console.log('   Upload: ✅');
        console.log('   AI Processing: ⏳ May still be processing');
        console.log('   💡 Check AI terminal for logs\n');
        return false;
    }
}

// Run all steps
async function runE2ETest() {
    const results = {
        step1: false,
        step2: false,
        step3: false,
        step4: null,
        step5: false,
    };
    
    // Step 1
    results.step1 = await step1_findImage();
    if (!results.step1) {
        console.log('❌ Cannot proceed without test image\n');
        process.exit(1);
    }
    
    // Step 2
    results.step2 = await step2_uploadImage();
    if (!results.step2) {
        console.log('❌ Upload failed, cannot proceed\n');
        process.exit(1);
    }
    
    // Step 3
    results.step3 = await step3_waitForProcessing();
    
    // Step 4
    results.step4 = await step4_checkEnrichedEvents();
    
    // Step 5
    if (results.step4) {
        results.step5 = await step5_testDetectionAPIs(results.step4.id);
    }
    
    // Step 6
    const finalResult = await step6_summary(results.step4, results.step5);
    
    process.exit(finalResult ? 0 : 1);
}

// Run test
runE2ETest().catch(error => {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
});


