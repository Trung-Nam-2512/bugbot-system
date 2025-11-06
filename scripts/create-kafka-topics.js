#!/usr/bin/env node

/**
 * Create Kafka topics
 * Run: npm run kafka:create-topics
 */

require('dotenv').config();
const { Kafka } = require('kafkajs');

const TOPICS = [
    {
        topic: 'events.raw',
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
            { name: 'retention.ms', value: '604800000' }, // 7 days
            { name: 'compression.type', value: 'snappy' },
        ],
    },
    {
        topic: 'events.processed',
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
            { name: 'retention.ms', value: '2592000000' }, // 30 days
        ],
    },
];

async function createTopics() {
    console.log('🔧 Creating Kafka topics...');
    
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:19092').split(',');
    
    const kafka = new Kafka({
        clientId: 'topic-creator',
        brokers,
    });

    const admin = kafka.admin();

    try {
        await admin.connect();
        console.log('✅ Connected to Kafka');

        // Get existing topics
        const existingTopics = await admin.listTopics();
        console.log('\n📋 Existing topics:', existingTopics);

        // Create topics
        const topicsToCreate = TOPICS.filter(t => !existingTopics.includes(t.topic));

        if (topicsToCreate.length === 0) {
            console.log('\n✨ All topics already exist!');
        } else {
            await admin.createTopics({
                topics: topicsToCreate,
                waitForLeaders: true,
            });

            console.log('\n✅ Created topics:');
            topicsToCreate.forEach(t => {
                console.log(`   - ${t.topic} (${t.numPartitions} partitions)`);
            });
        }

        await admin.disconnect();
        console.log('\n✨ Kafka topics setup completed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating Kafka topics:', error.message);
        process.exit(1);
    }
}

createTopics();

