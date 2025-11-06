const { Kafka, logLevel } = require('kafkajs');
const { logger } = require('./logger');

let kafka;
let producer;
let isConnected = false;

/**
 * Initialize Kafka client and producer
 */
async function initKafka() {
    try {
        const brokers = (process.env.KAFKA_BROKERS || 'localhost:1448').split(',').map(b => b.trim());
        
        // Log brokers for debugging
        logger.info({ brokers, env: process.env.KAFKA_BROKERS }, 'Initializing Kafka with brokers');
        
        kafka = new Kafka({
            clientId: process.env.KAFKA_CLIENT_ID || 'iot-backend',
            brokers,
            logLevel: logLevel.INFO,
            retry: {
                initialRetryTime: 100,
                retries: 8,
                maxRetryTime: 30000,
                multiplier: 2,
            },
            connectionTimeout: 10000,
            requestTimeout: 30000,
        });

        producer = kafka.producer({
            allowAutoTopicCreation: true,
            transactionTimeout: 30000,
        });

        await producer.connect();
        isConnected = true;
        
        logger.info({ brokers }, '✅ Kafka producer connected');
        return true;
    } catch (error) {
        logger.error({ error: error.message }, '❌ Failed to connect to Kafka');
        return false;
    }
}

/**
 * Publish event to Kafka topic
 * @param {string} topic - Kafka topic name
 * @param {object} payload - Event payload (will be JSON stringified)
 * @param {string} key - Optional message key for partitioning
 */
async function publishEvent(topic, payload, key = null) {
    if (!isConnected) {
        logger.warn('Kafka producer not connected, attempting to reconnect...');
        await initKafka();
    }

    try {
        const message = {
            value: JSON.stringify(payload),
            headers: {
                'source': 'iot-backend',
                'timestamp': Date.now().toString(),
            },
        };

        if (key) {
            message.key = key;
        }

        const result = await producer.send({
            topic,
            messages: [message],
        });

        logger.debug({ topic, key, partition: result[0].partition }, 'Event published to Kafka');
        return true;
    } catch (error) {
        logger.error({ error: error.message, topic }, 'Failed to publish event to Kafka');
        throw error;
    }
}

/**
 * Publish batch of events to Kafka
 * @param {string} topic - Kafka topic name
 * @param {Array<object>} payloads - Array of event payloads
 */
async function publishBatch(topic, payloads) {
    if (!isConnected) {
        logger.warn('Kafka producer not connected, attempting to reconnect...');
        await initKafka();
    }

    try {
        const messages = payloads.map(payload => ({
            value: JSON.stringify(payload),
            headers: {
                'source': 'iot-backend',
                'timestamp': Date.now().toString(),
            },
        }));

        await producer.send({
            topic,
            messages,
        });

        logger.debug({ topic, count: messages.length }, 'Batch events published to Kafka');
        return true;
    } catch (error) {
        logger.error({ error: error.message, topic }, 'Failed to publish batch to Kafka');
        throw error;
    }
}

/**
 * Disconnect Kafka producer
 */
async function disconnectKafka() {
    if (producer && isConnected) {
        await producer.disconnect();
        isConnected = false;
        logger.info('Kafka producer disconnected');
    }
}

/**
 * Health check for Kafka connection
 */
function isKafkaHealthy() {
    return isConnected;
}

/**
 * Get Kafka instance
 * @returns {Kafka|null} - Kafka instance hoặc null
 */
function getKafka() {
    return kafka;
}

module.exports = {
    initKafka,
    publishEvent,
    publishBatch,
    disconnectKafka,
    isKafkaHealthy,
    getKafka,
};

