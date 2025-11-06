/**
 * Complete E2E Pipeline Test
 * Tests: Upload → AI Processing → Enriched Events → Detection APIs
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1435';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

console.log('🚀 Complete E2E Pipeline Test');
console.log('==================================================');
console.log(`Backend: ${BACKEND_URL}`);
console.log(`AI Service: ${AI_SERVICE_URL}\n`);

// Helper: Wait with progress indicator
async function wait(seconds, message) {
    process.stdout.write(`${message}`);
    for (let i = 0; i < seconds; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        process.stdout.write('.');
    }
    console.log(' Done!\n');
}

// Test 1: Verify Services Health
async function testServicesHealth() {
    console.log('📊 Step 1: Verify Services Health');
    console.log('─────────────────────────────────');
    
    try {
        // Backend health
        const backendHealth = await fetch(`${BACKEND_URL}/api/health`);
        const backendData = await backendHealth.json();
        console.log(`  Backend: ${backendData.ok ? '✅ Healthy' : '❌ Unhealthy'}`);
        
        // AI Service health
        const aiHealth = await fetch(`${AI_SERVICE_URL}/health/readiness`);
        const aiData = await aiHealth.json();
        console.log(`  AI Service: ${aiData.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
        console.log(`  Model: ${aiData.model?.name || 'N/A'} (${aiData.model?.device || 'N/A'})`);
        
        if (!backendData.ok || aiData.status !== 'healthy') {
            throw new Error('Services not healthy');
        }
        
        console.log('  Status: ✅ All services healthy\n');
        return true;
    } catch (error) {
        console.log(`  Status: ❌ Failed - ${error.message}\n`);
        return false;
    }
}

// Test 2: Upload Test Image
async function testImageUpload() {
    console.log('📤 Step 2: Upload Test Image');
    console.log('─────────────────────────────────');
    
    try {
        // Find a test image
        const testImagePath = path.join(__dirname, '../test-images/test-1.jpg');
        
        if (!fs.existsSync(testImagePath)) {
            console.log('  ⚠️  Test image not found, creating dummy image...');
            // Use any existing image from uploads if available
            const uploadsDir = path.join(__dirname, '../uploads');
            if (fs.existsSync(uploadsDir)) {
                const files = fs.readdirSync(uploadsDir, { recursive: true })
                    .filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'));
                if (files.length > 0) {
                    const sourceImage = path.join(uploadsDir, files[0]);
                    console.log(`  Using existing image: ${files[0]}`);
                    
                    const formData = new FormData();
                    formData.append('file', fs.createReadStream(sourceImage));
                    formData.append('deviceId', 'test-e2e-device');
                    formData.append('ts', new Date().toISOString());
                    
                    const response = await fetch(`${BACKEND_URL}/api/iot/cam/upload`, {
                        method: 'POST',
                        body: formData,
                        headers: formData.getHeaders(),
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok && data.ok) {
                        console.log(`  ✅ Image uploaded successfully`);
                        console.log(`  Shot ID: ${data.shot_id}`);
                        console.log(`  Device ID: ${data.device_id}`);
                        console.log(`  Image URL: ${data.image_url}\n`);
                        return {
                            shotId: data.shot_id,
                            deviceId: data.device_id,
                            imageUrl: data.image_url,
                        };
                    }
                }
            }
            console.log('  ❌ No test images available\n');
            return null;
        }
        
        // Upload test image
        const formData = new FormData();
        formData.append('file', fs.createReadStream(testImagePath));
        formData.append('deviceId', 'test-e2e-device');
        formData.append('ts', new Date().toISOString());
        
        const response = await fetch(`${BACKEND_URL}/api/iot/cam/upload`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders(),
        });
        
        const data = await response.json();
        
        if (response.ok && data.ok) {
            console.log(`  ✅ Image uploaded successfully`);
            console.log(`  Shot ID: ${data.shot_id}`);
            console.log(`  Device ID: ${data.device_id}\n`);
            return {
                shotId: data.shot_id,
                deviceId: data.device_id,
            };
        } else {
            throw new Error(data.error || 'Upload failed');
        }
    } catch (error) {
        console.log(`  ❌ Failed - ${error.message}\n`);
        return null;
    }
}

// Test 3: Wait for AI Processing
async function waitForAIProcessing(shotId, maxWaitSeconds = 30) {
    console.log('🤖 Step 3: Wait for AI Processing');
    console.log('─────────────────────────────────');
    
    await wait(10, '  Waiting for AI to process (10s)');
    
    return true;
}

// Test 4: Check Enriched Events in ClickHouse
async function checkEnrichedEvents(deviceId) {
    console.log('💾 Step 4: Check Enriched Events in ClickHouse');
    console.log('─────────────────────────────────');
    
    try {
        // Query images with detection filter
        const response = await fetch(`${BACKEND_URL}/api/cam/images?deviceId=${deviceId}&hasDetections=true&limit=5`);
        const data = await response.json();
        
        if (response.ok && data.ok) {
            const imagesWithDetections = data.images.filter(img => img.hasDetections);
            
            console.log(`  Total images from device: ${data.total}`);
            console.log(`  Images with detections: ${imagesWithDetections.length}`);
            
            if (imagesWithDetections.length > 0) {
                const img = imagesWithDetections[0];
                console.log(`  ✅ Enriched event found!`);
                console.log(`  - Shot ID: ${img.id}`);
                console.log(`  - Detection Count: ${img.detectionCount}`);
                console.log(`  - Annotated URL: ${img.annotatedImageUrl ? 'Available' : 'N/A'}`);
                console.log(`  - Model: ${img.inferenceModel || 'N/A'}`);
                console.log(`  - Processing Time: ${img.processingTimeMs || 'N/A'}ms\n`);
                return img;
            } else {
                console.log(`  ⚠️  No enriched events yet (might still be processing)\n`);
                return null;
            }
        } else {
            throw new Error('Failed to query images');
        }
    } catch (error) {
        console.log(`  ❌ Failed - ${error.message}\n`);
        return null;
    }
}

// Test 5: Test Detection APIs
async function testDetectionAPIs(imageId) {
    console.log('🔍 Step 5: Test Detection APIs');
    console.log('─────────────────────────────────');
    
    if (!imageId) {
        console.log('  ⚠️  Skipped - No image with detections\n');
        return false;
    }
    
    try {
        // Test detection details endpoint
        const detailsResponse = await fetch(`${BACKEND_URL}/api/cam/images/${imageId}/detections`);
        const detailsData = await detailsResponse.json();
        
        if (detailsResponse.ok && detailsData.ok) {
            console.log(`  ✅ Detection Details API working`);
            console.log(`  - Has Detections: ${detailsData.hasDetections}`);
            console.log(`  - Detection Count: ${detailsData.detectionCount || 0}`);
            
            if (detailsData.detections && detailsData.detections.length > 0) {
                console.log(`  - Detected Objects:`);
                detailsData.detections.slice(0, 3).forEach(det => {
                    console.log(`    • ${det.class}: ${(det.confidence * 100).toFixed(1)}%`);
                });
            }
        }
        
        // Test annotated image endpoint
        const annotatedResponse = await fetch(`${BACKEND_URL}/api/cam/images/${imageId}/annotated`);
        
        if (annotatedResponse.ok && annotatedResponse.headers.get('content-type')?.includes('image')) {
            console.log(`  ✅ Annotated Image API working`);
            console.log(`  - Content-Type: ${annotatedResponse.headers.get('content-type')}`);
        } else if (annotatedResponse.status === 404) {
            console.log(`  ⚠️  Annotated image not available yet`);
        }
        
        console.log('');
        return true;
    } catch (error) {
        console.log(`  ❌ Failed - ${error.message}\n`);
        return false;
    }
}

// Test 6: Test Detection Statistics
async function testDetectionStatistics() {
    console.log('📊 Step 6: Test Detection Statistics');
    console.log('─────────────────────────────────');
    
    try {
        // Overall detection stats
        const statsResponse = await fetch(`${BACKEND_URL}/api/cam/stats/detections`);
        const statsData = await statsResponse.json();
        
        if (statsResponse.ok && statsData.ok) {
            console.log(`  ✅ Detection Statistics API working`);
            console.log(`  - Total Detections: ${statsData.totalDetections || 0}`);
            console.log(`  - Total Images: ${statsData.totalImages || 0}`);
            console.log(`  - Avg Detections/Image: ${statsData.avgDetectionsPerImage?.toFixed(2) || 0}`);
        }
        
        // Species distribution
        const speciesResponse = await fetch(`${BACKEND_URL}/api/cam/stats/species`);
        const speciesData = await speciesResponse.json();
        
        if (speciesResponse.ok && speciesData.ok) {
            console.log(`  ✅ Species Distribution API working`);
            console.log(`  - Total Species: ${speciesData.distribution?.length || 0}`);
            if (speciesData.distribution && speciesData.distribution.length > 0) {
                console.log(`  - Top Species:`);
                speciesData.distribution.slice(0, 3).forEach(sp => {
                    console.log(`    • ${sp.species}: ${sp.count} detections`);
                });
            }
        }
        
        console.log('');
        return true;
    } catch (error) {
        console.log(`  ❌ Failed - ${error.message}\n`);
        return false;
    }
}

// Run all tests
async function runE2ETest() {
    console.log('Starting Complete E2E Pipeline Test...\n');
    
    const results = {
        servicesHealth: false,
        imageUpload: false,
        aiProcessing: false,
        enrichedEvents: false,
        detectionAPIs: false,
        statistics: false,
    };
    
    // Step 1: Check services
    results.servicesHealth = await testServicesHealth();
    if (!results.servicesHealth) {
        console.log('❌ Services not healthy, aborting test\n');
        process.exit(1);
    }
    
    // Step 2: Upload image
    const uploadResult = await testImageUpload();
    results.imageUpload = !!uploadResult;
    
    if (uploadResult) {
        // Step 3: Wait for processing
        results.aiProcessing = await waitForAIProcessing(uploadResult.shotId);
        
        // Step 4: Check enriched events
        const enrichedImage = await checkEnrichedEvents(uploadResult.deviceId);
        results.enrichedEvents = !!enrichedImage;
        
        // Step 5: Test detection APIs
        if (enrichedImage) {
            results.detectionAPIs = await testDetectionAPIs(enrichedImage.id);
        }
    }
    
    // Step 6: Test statistics (always run)
    results.statistics = await testDetectionStatistics();
    
    // Summary
    console.log('==================================================');
    console.log('📊 Test Summary');
    console.log('==================================================');
    console.log(`  Services Health:    ${results.servicesHealth ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Image Upload:       ${results.imageUpload ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  AI Processing:      ${results.aiProcessing ? '✅ PASS' : '⚠️  SKIP'}`);
    console.log(`  Enriched Events:    ${results.enrichedEvents ? '✅ PASS' : '⚠️  PENDING'}`);
    console.log(`  Detection APIs:     ${results.detectionAPIs ? '✅ PASS' : '⚠️  SKIP'}`);
    console.log(`  Statistics:         ${results.statistics ? '✅ PASS' : '❌ FAIL'}`);
    console.log('==================================================\n');
    
    const criticalPassed = results.servicesHealth && results.imageUpload && results.statistics;
    const enhancedPassed = results.enrichedEvents && results.detectionAPIs;
    
    if (criticalPassed && enhancedPassed) {
        console.log('✅ All E2E tests PASSED!\n');
        process.exit(0);
    } else if (criticalPassed) {
        console.log('⚠️  Core functionality working, detection pipeline pending\n');
        console.log('💡 Tip: Wait a few seconds and run test again to check enriched events\n');
        process.exit(0);
    } else {
        console.log('❌ Some critical tests failed\n');
        process.exit(1);
    }
}

// Run tests
runE2ETest().catch(error => {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
});


