/**
 * Simple Alert API Test
 * Test basic connectivity
 */

require('dotenv').config();
const fetch = globalThis.fetch || require('node-fetch');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1435';

async function test() {
    console.log('🧪 Testing Alert API Connectivity...\n');

    // Test 1: Health check
    try {
        const healthRes = await fetch(`${BACKEND_URL}/api/health`);
        const health = await healthRes.json();
        console.log('✅ Backend health:', health.ok ? 'OK' : 'FAILED');
    } catch (error) {
        console.error('❌ Backend not reachable:', error.message);
        process.exit(1);
    }

    // Test 2: Try alerts endpoint
    try {
        const res = await fetch(`${BACKEND_URL}/api/alerts/rules`);
        const data = await res.json();
        console.log(`✅ Alerts endpoint: ${res.status}`, data);
    } catch (error) {
        console.error('❌ Alerts endpoint error:', error.message);
    }

    // Test 3: Try alerts stats
    try {
        const res = await fetch(`${BACKEND_URL}/api/alerts/stats`);
        const data = await res.json();
        console.log(`✅ Alerts stats: ${res.status}`, data);
    } catch (error) {
        console.error('❌ Alerts stats error:', error.message);
    }
}

test().catch(console.error);


