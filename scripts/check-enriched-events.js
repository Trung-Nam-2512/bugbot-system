/**
 * Check for Enriched Events
 */

const BACKEND_URL = 'http://localhost:1435';

async function checkEnrichedEvents() {
    console.log('🔍 Checking for Enriched Events');
    console.log('==================================================\n');
    
    try {
        console.log('1. Querying images with detections...');
        const response = await fetch(`${BACKEND_URL}/api/cam/images?hasDetections=true&limit=10`);
        const data = await response.json();
        
        if (!response.ok || !data.ok) {
            console.log('   ❌ Query failed\n');
            return;
        }
        
        const withDetections = data.images.filter(img => img.hasDetections);
        
        console.log(`   Total images: ${data.total}`);
        console.log(`   With detections: ${withDetections.length}\n`);
        
        if (withDetections.length === 0) {
            console.log('⚠️  No enriched events yet');
            console.log('💡 Wait a few more seconds and run this script again\n');
            return;
        }
        
        // Show latest detection
        const latest = withDetections[0];
        console.log('✅ ENRICHED EVENTS FOUND!\n');
        console.log('Latest Detection:');
        console.log('─────────────────────────────────');
        console.log(`Shot ID: ${latest.id}`);
        console.log(`Device ID: ${latest.deviceId}`);
        console.log(`Detection Count: ${latest.detectionCount}`);
        console.log(`Model: ${latest.inferenceModel || 'N/A'}`);
        console.log(`Processing Time: ${latest.processingTimeMs || 'N/A'}ms`);
        console.log(`Timestamp: ${latest.timestamp}\n`);
        
        if (latest.detections && latest.detections.length > 0) {
            console.log('Detected Objects:');
            latest.detections.forEach((det, i) => {
                console.log(`  ${i + 1}. ${det.class} (${(det.confidence * 100).toFixed(1)}%)`);
            });
            console.log('');
        }
        
        // Check stats
        console.log('2. Checking detection statistics...');
        const statsResponse = await fetch(`${BACKEND_URL}/api/cam/stats/detections`);
        const statsData = await statsResponse.json();
        
        if (statsResponse.ok && statsData.ok) {
            console.log(`   Total Detections: ${statsData.totalDetections || 0}`);
            console.log(`   Total Images: ${statsData.totalImages || 0}`);
            console.log(`   Avg per Image: ${statsData.avgDetectionsPerImage?.toFixed(2) || 0}\n`);
        }
        
        console.log('==================================================');
        console.log('✅ E2E PIPELINE WORKING!');
        console.log('==================================================');
        console.log('Upload → Kafka → AI → Annotated → ClickHouse ✅\n');
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
    }
}

checkEnrichedEvents();


