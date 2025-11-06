/**
 * Stream Processor Service
 * 
 * Service xử lý streaming data từ Kafka topic 'events.raw' và write vào ClickHouse.
 * Áp dụng SOLID principles:
 * - Single Responsibility: Chỉ xử lý streaming từ Kafka -> ClickHouse
 * - Open/Closed: Có thể extend thêm processors khác
 * - Dependency Inversion: Inject dependencies (kafka, clickhouse)
 */

const { logger } = require('../libs/logger');
const { insertEvent } = require('../libs/clickhouse');

// Configuration
const BATCH_SIZE = parseInt(process.env.STREAM_BATCH_SIZE || '100', 10);
const BATCH_TIMEOUT = parseInt(process.env.STREAM_BATCH_TIMEOUT || '5000', 10); // 5s
const MAX_RETRIES = 3;

/**
 * StreamProcessor class
 * Xử lý streaming events từ Kafka và batch write vào ClickHouse
 */
class StreamProcessor {
    constructor(kafka) {
        this.kafka = kafka;
        this.consumer = null;
        this.isRunning = false;
        this.eventBatch = [];
        this.batchTimer = null;
        this.stats = {
            processed: 0,
            errors: 0,
            batchesWritten: 0,
        };
    }

    /**
     * Khởi tạo Kafka consumer
     */
    async initialize() {
        try {
            const brokers = (process.env.KAFKA_BROKERS || 'localhost:1448').split(',');
            const groupId = process.env.KAFKA_CONSUMER_GROUP || 'iot-backend-processor';
            const topic = process.env.KAFKA_TOPIC_RAW || 'events.raw';

            // Tạo consumer từ kafka instance
            this.consumer = this.kafka.consumer({
                groupId,
                sessionTimeout: 30000,
                heartbeatInterval: 3000,
                maxWaitTimeInMs: 5000,
            });

            // Connect consumer
            await this.consumer.connect();
            logger.info({ groupId, topic }, 'Stream processor consumer connected');

            // Subscribe to topic
            await this.consumer.subscribe({
                topic,
                fromBeginning: false, // Chỉ đọc message mới
            });

            logger.info({ topic }, 'Stream processor subscribed to topic');
            return true;
        } catch (error) {
            logger.error({ error: error.message }, 'Failed to initialize stream processor');
            throw error;
        }
    }

    /**
     * Parse event từ Kafka message
     * @param {Object} message - Kafka message
     * @returns {Object|null} - Parsed event hoặc null nếu invalid
     */
    parseEvent(message) {
        try {
            const eventData = JSON.parse(message.value.toString());
            
            // Validate required fields
            if (!eventData.device_id || !eventData.timestamp || !eventData.image_url) {
                logger.warn({ eventData }, 'Invalid event: missing required fields');
                return null;
            }

            // Format event cho ClickHouse
            // Convert timestamp từ ISO string sang Date object cho ClickHouse
            const timestampDate = new Date(eventData.timestamp);
            const receivedAtDate = eventData.received_at 
                ? new Date(eventData.received_at) 
                : new Date();

            return {
                device_id: eventData.device_id,
                timestamp: timestampDate, // ClickHouse client sẽ tự convert
                shot_id: eventData.shot_id || '',
                image_url: eventData.image_url,
                image_size: parseInt(eventData.image_size || 0, 10),
                image_md5: eventData.image_md5 || '',
                mime_type: eventData.mime_type || 'image/jpeg',
                firmware_version: eventData.firmware_version || '',
                ip_address: eventData.ip_address || '',
                extra: eventData.extra || '',
                received_at: receivedAtDate, // ClickHouse client sẽ tự convert
            };
        } catch (error) {
            logger.error({ error: error.message }, 'Failed to parse event');
            return null;
        }
    }

    /**
     * Write batch vào ClickHouse
     * @param {Array} events - Array of events
     */
    async writeBatch(events) {
        if (events.length === 0) {
            return;
        }

        try {
            logger.debug({ count: events.length }, 'Writing batch to ClickHouse');

            // Write từng event (có thể optimize bằng batch insert)
            const promises = events.map(event => 
                this.writeEventWithRetry(event)
            );

            await Promise.allSettled(promises);

            this.stats.batchesWritten++;
            this.stats.processed += events.length;

            logger.info(
                { 
                    count: events.length, 
                    totalProcessed: this.stats.processed,
                    batchesWritten: this.stats.batchesWritten,
                },
                'Batch written to ClickHouse'
            );
        } catch (error) {
            this.stats.errors++;
            logger.error({ error: error.message, count: events.length }, 'Failed to write batch');
        }
    }

    /**
     * Write event với retry mechanism
     * @param {Object} event - Event to write
     */
    async writeEventWithRetry(event, retries = 0) {
        try {
            await insertEvent(event);
        } catch (error) {
            if (retries < MAX_RETRIES) {
                logger.warn(
                    { error: error.message, retries: retries + 1 }, 
                    'Retrying write event'
                );
                // Exponential backoff: 100ms, 200ms, 400ms
                await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retries)));
                return this.writeEventWithRetry(event, retries + 1);
            } else {
                this.stats.errors++;
                logger.error({ error: error.message, event }, 'Failed to write event after retries');
                throw error;
            }
        }
    }

    /**
     * Flush batch hiện tại
     */
    async flushBatch() {
        if (this.eventBatch.length === 0) {
            return;
        }

        const batch = [...this.eventBatch];
        this.eventBatch = [];

        // Clear timer
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        await this.writeBatch(batch);
    }

    /**
     * Add event vào batch và flush nếu cần
     * @param {Object} event - Event to add
     */
    async addEventToBatch(event) {
        this.eventBatch.push(event);

        // Flush nếu đạt batch size
        if (this.eventBatch.length >= BATCH_SIZE) {
            await this.flushBatch();
        } else {
            // Set timer để flush sau BATCH_TIMEOUT
            if (!this.batchTimer) {
                this.batchTimer = setTimeout(() => {
                    this.flushBatch().catch(error => {
                        logger.error({ error: error.message }, 'Error flushing batch on timeout');
                    });
                }, BATCH_TIMEOUT);
            }
        }
    }

    /**
     * Start consuming messages
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Stream processor already running');
            return;
        }

        try {
            this.isRunning = true;

            await this.consumer.run({
                autoCommit: true,
                autoCommitInterval: 5000,
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        // Parse event
                        const event = this.parseEvent(message);
                        if (!event) {
                            return; // Skip invalid events
                        }

                        // Add to batch
                        await this.addEventToBatch(event);

                        // Log progress mỗi 100 messages
                        if (this.stats.processed % 100 === 0) {
                            logger.debug(
                                { 
                                    processed: this.stats.processed,
                                    errors: this.stats.errors,
                                    batchSize: this.eventBatch.length,
                                },
                                'Stream processor progress'
                            );
                        }
                    } catch (error) {
                        this.stats.errors++;
                        logger.error(
                            { error: error.message, topic, partition, offset: message.offset },
                            'Error processing message'
                        );
                    }
                },
            });

            logger.info('Stream processor started successfully');
        } catch (error) {
            this.isRunning = false;
            logger.error({ error: error.message }, 'Failed to start stream processor');
            throw error;
        }
    }

    /**
     * Stop consumer và flush batch cuối cùng
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        try {
            logger.info('Stopping stream processor...');
            this.isRunning = false;

            // Flush batch cuối cùng
            await this.flushBatch();

            // Disconnect consumer
            if (this.consumer) {
                await this.consumer.disconnect();
                logger.info('Stream processor consumer disconnected');
            }

            // Log final stats
            logger.info(
                {
                    processed: this.stats.processed,
                    errors: this.stats.errors,
                    batchesWritten: this.stats.batchesWritten,
                },
                'Stream processor stopped'
            );
        } catch (error) {
            logger.error({ error: error.message }, 'Error stopping stream processor');
            throw error;
        }
    }

    /**
     * Get processor stats
     * @returns {Object} - Stats object
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            batchSize: this.eventBatch.length,
        };
    }

    /**
     * Health check
     * @returns {Boolean} - True if healthy
     */
    isHealthy() {
        return this.isRunning && this.consumer !== null;
    }
}

// Singleton instance
let processorInstance = null;

/**
 * Initialize và start stream processor
 * @param {Object} kafka - Kafka instance
 */
async function startStreamProcessor(kafka) {
    if (processorInstance) {
        logger.warn('Stream processor already initialized');
        return processorInstance;
    }

    try {
        processorInstance = new StreamProcessor(kafka);
        await processorInstance.initialize();
        await processorInstance.start();
        
        logger.info('Stream processor service started');
        return processorInstance;
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to start stream processor service');
        throw error;
    }
}

/**
 * Stop stream processor
 */
async function stopStreamProcessor() {
    if (processorInstance) {
        await processorInstance.stop();
        processorInstance = null;
    }
}

/**
 * Get stream processor instance
 */
function getStreamProcessor() {
    return processorInstance;
}

/**
 * Health check
 */
function isStreamProcessorHealthy() {
    return processorInstance ? processorInstance.isHealthy() : false;
}

/**
 * Get stats
 */
function getStreamProcessorStats() {
    return processorInstance ? processorInstance.getStats() : null;
}

module.exports = {
    startStreamProcessor,
    stopStreamProcessor,
    getStreamProcessor,
    isStreamProcessorHealthy,
    getStreamProcessorStats,
};

