// Simple test to verify upload endpoint
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

async function downloadTestImage() {
    const filePath = path.join(__dirname, '../test-image.jpg');
    if (fs.existsSync(filePath)) {
        return filePath;
    }

    return new Promise((resolve, reject) => {
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

async function testUpload(imagePath) {
    const fileData = fs.readFileSync(imagePath);
    const boundary = '----WebKitFormBoundary' + Date.now();
    
    const parts = [];
    
    // File part
    parts.push(Buffer.from(`--${boundary}\r\n`, 'utf8'));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="test.jpg"\r\n`, 'utf8'));
    parts.push(Buffer.from(`Content-Type: image/jpeg\r\n\r\n`, 'utf8'));
    parts.push(fileData);
    parts.push(Buffer.from(`\r\n--${boundary}\r\n`, 'utf8'));
    
    // deviceId
    parts.push(Buffer.from(`Content-Disposition: form-data; name="deviceId"\r\n\r\n`, 'utf8'));
    parts.push(Buffer.from('TEST_001', 'utf8'));
    parts.push(Buffer.from(`\r\n--${boundary}\r\n`, 'utf8'));
    
    // ts
    parts.push(Buffer.from(`Content-Disposition: form-data; name="ts"\r\n\r\n`, 'utf8'));
    parts.push(Buffer.from(Date.now().toString(), 'utf8'));
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));
    
    const buffer = Buffer.concat(parts);
    
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 1435,
            path: '/api/upload',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': buffer.length,
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log('Status:', res.statusCode);
                console.log('Response:', data);
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);
        req.write(buffer);
        req.end();
    });
}

(async () => {
    try {
        console.log('Downloading test image...');
        const imagePath = await downloadTestImage();
        console.log('Image downloaded:', imagePath);
        
        console.log('Testing upload...');
        const result = await testUpload(imagePath);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();










