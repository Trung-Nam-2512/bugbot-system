// Test upload with form-data package
const FormData = require('form-data');
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

function uploadWithFormData(imagePath) {
    return new Promise((resolve, reject) => {
        const form = new FormData();
        
        // Add file - use Buffer instead of stream
        const fileBuffer = fs.readFileSync(imagePath);
        form.append('file', fileBuffer, {
            filename: 'test.jpg',
            contentType: 'image/jpeg'
        });
        
        // Add form fields
        form.append('deviceId', 'TEST_FORMDATA_001');
        form.append('ts', Date.now().toString());
        form.append('extra', JSON.stringify({ test: true }));

        const options = {
            hostname: 'localhost',
            port: 1435,
            path: '/api/upload',
            method: 'POST',
            headers: form.getHeaders(),
        };

        console.log('Headers:', JSON.stringify(options.headers, null, 2));

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

        req.on('error', (err) => {
            console.error('Request error:', err);
            reject(err);
        });

        form.on('error', (err) => {
            console.error('Form error:', err);
            reject(err);
        });

        form.pipe(req);
    });
}

(async () => {
    try {
        console.log('Downloading test image...');
        const imagePath = await downloadTestImage();
        console.log('Image ready:', imagePath);
        
        console.log('\nUploading with form-data...');
        const result = await uploadWithFormData(imagePath);
        
        console.log('\n=== RESULT ===');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.ok) {
            console.log('\n✅ SUCCESS!');
            console.log('Image URL:', result.imageUrl);
            console.log('Published:', result.published);
            process.exit(0);
        } else {
            console.log('\n❌ FAILED:', result.error);
            process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
})();

