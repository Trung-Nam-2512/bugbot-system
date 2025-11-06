/**
 * Simple Upload Test - Trigger AI Processing
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const BACKEND_URL = 'http://localhost:1435';

async function uploadTestImage() {
    console.log('🚀 Simple Upload Test');
    console.log('==================================================\n');
    
    // Find an image to upload
    console.log('1. Finding test image...');
    const uploadsDir = path.join(__dirname, '../uploads');
    
    if (!fs.existsSync(uploadsDir)) {
        console.log('   ❌ No uploads directory\n');
        return false;
    }
    
    const files = fs.readdirSync(uploadsDir, { recursive: true })
        .filter(f => (f.endsWith('.jpg') || f.endsWith('.jpeg')) && !f.includes('node_modules'));
    
    if (files.length === 0) {
        console.log('   ❌ No images found\n');
        return false;
    }
    
    const imagePath = path.join(uploadsDir, files[0]);
    console.log(`   ✅ Found: ${path.basename(imagePath)}\n`);
    
    // Upload using axios
    console.log('2. Uploading to backend...');
    try {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(imagePath));
        formData.append('deviceId', 'ai-test-device');
        formData.append('ts', new Date().toISOString());
        
        const response = await axios.post(`${BACKEND_URL}/api/iot/cam/upload`, formData, {
            headers: formData.getHeaders(),
        });
        
        const data = response.data;
        
        if (response.status === 200 && data.ok) {
            console.log(`   ✅ Upload successful!`);
            console.log(`   Shot ID: ${data.shot_id}`);
            console.log(`   Device ID: ${data.device_id}`);
            console.log(`   Image URL: ${data.image_url}\n`);
            
            console.log('==================================================');
            console.log('🔍 NOW CHECK AI SERVICE TERMINAL!');
            console.log('==================================================');
            console.log('You should see within 5-10 seconds:');
            console.log('  📥 Consumed event...');
            console.log('  ⬇️  Downloading image...');
            console.log('  🔍 Running YOLO inference...');
            console.log('  ✅ Detected X objects');
            console.log('  ⬆️  Uploading annotated image...');
            console.log('  ✅ Event processed successfully\n');
            
            console.log('Then run: node scripts/check-enriched-events.js\n');
            
            return data;
        } else {
            console.log(`   ❌ Upload failed: ${data.error}\n`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
        return false;
    }
}

uploadTestImage();

