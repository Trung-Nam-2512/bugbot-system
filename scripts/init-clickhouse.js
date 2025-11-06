#!/usr/bin/env node

/**
 * Initialize ClickHouse database and tables
 * Run: npm run sql:init
 */

require('dotenv').config();
const { createClient } = require('@clickhouse/client');
const fs = require('fs');
const path = require('path');

const sqlFile = path.join(__dirname, '../infra/clickhouse/init/01-create-tables.sql');

async function initClickHouse() {
    console.log('🔧 Initializing ClickHouse database...');
    
    const client = createClient({
        host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || 'clickhouse123',
    });

    try {
        // Create database if not exists
        await client.command({
            query: 'CREATE DATABASE IF NOT EXISTS iot',
        });
        console.log('✅ Database "iot" created/verified');

        // Read and execute SQL file
        if (fs.existsSync(sqlFile)) {
            const sql = fs.readFileSync(sqlFile, 'utf8');
            
            // Split by semicolon and execute each statement
            const statements = sql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            for (const statement of statements) {
                try {
                    await client.command({ query: statement });
                    console.log('✅ Executed statement');
                } catch (error) {
                    console.error('❌ Failed to execute statement:', error.message);
                }
            }

            console.log('✅ All ClickHouse tables created successfully');
        } else {
            console.warn('⚠️  SQL file not found:', sqlFile);
        }

        // Verify tables
        const result = await client.query({
            query: 'SHOW TABLES FROM iot',
            format: 'JSONEachRow',
        });
        
        const tables = await result.json();
        console.log('\n📊 Tables in database:');
        tables.forEach(t => console.log(`   - ${t.name}`));

        await client.close();
        console.log('\n✨ ClickHouse initialization completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error initializing ClickHouse:', error.message);
        process.exit(1);
    }
}

initClickHouse();

