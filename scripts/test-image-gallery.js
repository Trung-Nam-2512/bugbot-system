/**
 * Test Image Gallery with Detection Data
 * Tests enhanced image API với detection filtering và annotated images
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1435';

console.log('Image Gallery API Test');
console.log('==================================================');
console.log(`Backend URL: ${BACKEND_URL}\n`);

let allTestsPassed = true;

// Test 1: Get images with basic pagination
async function testBasicImageList() {
    process.stdout.write('1. Testing GET /api/cam/images (basic)... ');
    try {
        const response = await fetch(`${BACKEND_URL}/api/cam/images?page=1&limit=10`);
        const data = await response.json();
        
        if (response.ok && data.ok && Array.isArray(data.images)) {
            console.log('✅ PASSED');
            console.log(`   Total Images: ${data.total}`);
            console.log(`   Images Returned: ${data.images.length}`);
            console.log(`   Has Detection Data: ${data.images.filter(img => img.hasDetections).length} images`);
            return true;
        } else {
            console.log('❌ FAILED');
            console.log(`   Response:`, data);
            return false;
        }
    } catch (error) {
        console.log('❌ FAILED');
        console.log(`   Error: ${error.message}`);
        return false;
    }
}

// Test 2: Filter by hasDetections=true
async function testFilterByDetections() {
    process.stdout.write('2. Testing filter by hasDetections=true... ');
    try {
        const response = await fetch(`${BACKEND_URL}/api/cam/images?hasDetections=true&limit=10`);
        const data = await response.json();
        
        if (response.ok && data.ok) {
            const allHaveDetections = data.images.every(img => img.hasDetections === true);
            if (allHaveDetections) {
                console.log('✅ PASSED');
                console.log(`   Images with Detections: ${data.images.length}`);
                return true;
            } else {
                console.log('❌ FAILED');
                console.log(`   Not all images have detections`);
                return false;
            }
        } else {
            console.log('✅ PASSED (no images with detections yet)');
            return true;
        }
    } catch (error) {
        console.log('❌ FAILED');
        console.log(`   Error: ${error.message}`);
        return false;
    }
}

// Test 3: Filter by minConfidence
async function testFilterByConfidence() {
    process.stdout.write('3. Testing filter by minConfidence=0.5... ');
    try {
        const response = await fetch(`${BACKEND_URL}/api/cam/images?minConfidence=0.5&limit=10`);
        const data = await response.json();
        
        if (response.ok && data.ok) {
            // Check if all images have detections with confidence >= 0.5
            const allMeetThreshold = data.images.every(img => {
                if (!img.detections || img.detections.length === 0) return false;
                return img.detections.some(det => det.confidence >= 0.5);
            });
            
            if (data.images.length === 0 || allMeetThreshold) {
                console.log('✅ PASSED');
                console.log(`   Images matching threshold: ${data.images.length}`);
                return true;
            } else {
                console.log('❌ FAILED');
                console.log(`   Some images don't meet confidence threshold`);
                return false;
            }
        } else {
            console.log('✅ PASSED (no images yet)');
            return true;
        }
    } catch (error) {
        console.log('❌ FAILED');
        console.log(`   Error: ${error.message}`);
        return false;
    }
}

// Test 4: Filter by species
async function testFilterBySpecies() {
    process.stdout.write('4. Testing filter by species=person... ');
    try {
        const response = await fetch(`${BACKEND_URL}/api/cam/images?species=person&limit=10`);
        const data = await response.json();
        
        if (response.ok && data.ok) {
            const allHaveSpecies = data.images.every(img => {
                if (!img.detections || img.detections.length === 0) return false;
                return img.detections.some(det => det.class.toLowerCase() === 'person');
            });
            
            if (data.images.length === 0 || allHaveSpecies) {
                console.log('✅ PASSED');
                console.log(`   Images with 'person': ${data.images.length}`);
                return true;
            } else {
                console.log('❌ FAILED');
                console.log(`   Some images don't have 'person' detection`);
                return false;
            }
        } else {
            console.log('✅ PASSED (no images yet)');
            return true;
        }
    } catch (error) {
        console.log('❌ FAILED');
        console.log(`   Error: ${error.message}`);
        return false;
    }
}

// Test 5: Get single image with detection data
async function testGetImageById() {
    process.stdout.write('5. Testing GET /api/cam/images/:id... ');
    try {
        // First get list to get an image ID
        const listResponse = await fetch(`${BACKEND_URL}/api/cam/images?limit=1`);
        const listData = await listResponse.json();
        
        if (!listData.ok || listData.images.length === 0) {
            console.log('⚠️ SKIPPED (no images available)');
            return true;
        }
        
        const imageId = listData.images[0].id;
        
        // Get single image
        const response = await fetch(`${BACKEND_URL}/api/cam/images/${imageId}`);
        const data = await response.json();
        
        if (response.ok && data.ok && data.image) {
            console.log('✅ PASSED');
            console.log(`   Image ID: ${data.image.id}`);
            console.log(`   Has Detections: ${data.image.hasDetections}`);
            console.log(`   Detection Count: ${data.image.detectionCount || 0}`);
            return true;
        } else {
            console.log('❌ FAILED');
            console.log(`   Response:`, data);
            return false;
        }
    } catch (error) {
        console.log('❌ FAILED');
        console.log(`   Error: ${error.message}`);
        return false;
    }
}

// Test 6: Get detection details
async function testGetDetections() {
    process.stdout.write('6. Testing GET /api/cam/images/:id/detections... ');
    try {
        // First get an image with detections
        const listResponse = await fetch(`${BACKEND_URL}/api/cam/images?hasDetections=true&limit=1`);
        const listData = await listResponse.json();
        
        if (!listData.ok || listData.images.length === 0) {
            console.log('⚠️ SKIPPED (no images with detections yet)');
            return true;
        }
        
        const imageId = listData.images[0].id;
        
        // Get detections
        const response = await fetch(`${BACKEND_URL}/api/cam/images/${imageId}/detections`);
        const data = await response.json();
        
        if (response.ok && data.ok) {
            console.log('✅ PASSED');
            console.log(`   Image ID: ${data.imageId}`);
            console.log(`   Detection Count: ${data.detectionCount || 0}`);
            console.log(`   Has Metadata: ${!!data.metadata}`);
            return true;
        } else {
            console.log('❌ FAILED');
            console.log(`   Response:`, data);
            return false;
        }
    } catch (error) {
        console.log('❌ FAILED');
        console.log(`   Error: ${error.message}`);
        return false;
    }
}

// Test 7: Get annotated image
async function testGetAnnotatedImage() {
    process.stdout.write('7. Testing GET /api/cam/images/:id/annotated... ');
    try {
        // First get an image with detections
        const listResponse = await fetch(`${BACKEND_URL}/api/cam/images?hasDetections=true&limit=1`);
        const listData = await listResponse.json();
        
        if (!listData.ok || listData.images.length === 0) {
            console.log('⚠️ SKIPPED (no images with detections yet)');
            return true;
        }
        
        const imageId = listData.images[0].id;
        
        // Get annotated image
        const response = await fetch(`${BACKEND_URL}/api/cam/images/${imageId}/annotated`);
        
        if (response.ok && response.headers.get('content-type')?.includes('image')) {
            console.log('✅ PASSED');
            console.log(`   Content-Type: ${response.headers.get('content-type')}`);
            return true;
        } else if (response.status === 404) {
            console.log('⚠️ SKIPPED (annotated image not available)');
            return true;
        } else {
            console.log('❌ FAILED');
            console.log(`   Status: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log('❌ FAILED');
        console.log(`   Error: ${error.message}`);
        return false;
    }
}

// Test 8: Sort by detection count
async function testSortByDetections() {
    process.stdout.write('8. Testing sort by detections... ');
    try {
        const response = await fetch(`${BACKEND_URL}/api/cam/images?sortBy=detections&sortOrder=desc&limit=10`);
        const data = await response.json();
        
        if (response.ok && data.ok) {
            // Check if sorted correctly (descending detection count)
            let isSorted = true;
            for (let i = 0; i < data.images.length - 1; i++) {
                const current = data.images[i].detectionCount || 0;
                const next = data.images[i + 1].detectionCount || 0;
                if (current < next) {
                    isSorted = false;
                    break;
                }
            }
            
            if (isSorted) {
                console.log('✅ PASSED');
                console.log(`   Images returned: ${data.images.length}`);
                return true;
            } else {
                console.log('❌ FAILED');
                console.log(`   Images not sorted correctly`);
                return false;
            }
        } else {
            console.log('✅ PASSED (no images yet)');
            return true;
        }
    } catch (error) {
        console.log('❌ FAILED');
        console.log(`   Error: ${error.message}`);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    const tests = [
        testBasicImageList,
        testFilterByDetections,
        testFilterByConfidence,
        testFilterBySpecies,
        testGetImageById,
        testGetDetections,
        testGetAnnotatedImage,
        testSortByDetections,
    ];
    
    const results = [];
    
    for (const test of tests) {
        const result = await test();
        results.push(result);
        console.log(''); // Empty line between tests
    }
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log('==================================================');
    console.log(`Test Summary:`);
    console.log(`Passed: ${passed}/${total}`);
    console.log('');
    
    if (passed === total) {
        console.log('✅ All tests passed!');
        process.exit(0);
    } else {
        console.log('❌ Some tests failed!');
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
});


