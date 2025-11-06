/**
 * Enriched Events Processor Service
 * 
 * Service xử lý enriched events từ Kafka topic 'events.enriched' và write vào ClickHouse.
 * Phase 3: Dashboard & Alert System
 */

const { logger } = require('../libs/logger');
const { insertEnrichedEvent } = require('../libs/clickhouse');
const alertEvaluationService = require('./alert-evaluation.service');
const alertGenerationService = require('./alert-generation.service');

// Configuration
const BATCH_SIZE = parseInt(process.env.ENRICHED_BATCH_SIZE || '50', 10);
const BATCH_TIMEOUT = parseInt(process.env.ENRICHED_BATCH_TIMEOUT || '5000', 10); // 5s
const MAX_RETRIES = 3;
const ALERT_EVALUATION_ENABLED = process.env.ALERT_EVALUATION_ENABLED !== 'false'; // Default enabled

/**
 * EnrichedEventsProcessor class
 * Xử lý enriched events từ Kafka và batch write vào ClickHouse
 */
class EnrichedEventsProcessor {
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
            const groupId = process.env.KAFKA_ENRICHED_CONSUMER_GROUP || 'iot-backend-enriched-processor';
            const topic = process.env.KAFKA_TOPIC_ENRICHED || 'events.enriched';

            // Tạo consumer từ kafka instance
            this.consumer = this.kafka.consumer({
                groupId,
                sessionTimeout: 30000,
                heartbeatInterval: 3000,
            });

            await this.consumer.connect();
            await this.consumer.subscribe({
                topic,
                fromBeginning: false, // Chỉ consume events mới
            });

            logger.info(
                { topic, groupId, brokers: brokers.length },
                'Enriched events processor initialized'
            );
        } catch (error) {
            logger.error({ error: error.message }, 'Failed to initialize enriched events processor');
            throw error;
        }
    }

    /**
     * Parse enriched event từ Kafka message
     */
    parseEvent(message) {
        try {
            const value = message.value.toString();
            const event = JSON.parse(value);

            // Validate required fields
            if (!event.device_id || !event.timestamp) {
                logger.warn({ event }, 'Invalid enriched event: missing required fields');
                return null;
            }

            // Format enriched event cho ClickHouse
            return {
                device_id: event.device_id,
                timestamp: new Date(event.timestamp),
                shot_id: event.shot_id || '',
                image_url: event.image_url || '',
                annotated_image_url: event.annotated_image_url || '',
                detection_count: parseInt(event.detection_count || 0, 10),
                detections: event.detections ? JSON.stringify(event.detections) : '[]',
                processing_time_ms: parseInt(event.processing_time_ms || 0, 10),
                processed_at: event.processed_at ? new Date(event.processed_at) : new Date(),
                inference_model: event.inference_model || 'yolov8n',
                inference_version: event.inference_version || '1.0.0',
                received_at: new Date(),
            };
        } catch (error) {
            logger.error({ error: error.message }, 'Failed to parse enriched event');
            return null;
        }
    }

    /**
     * Write batch to ClickHouse
     */
    async writeBatch(batch) {
        if (batch.length === 0) {
            return;
        }

        let retries = 0;
        while (retries < MAX_RETRIES) {
            try {
                // Insert batch vào ClickHouse
                for (const event of batch) {
                    await insertEnrichedEvent(event);
                }

                this.stats.batchesWritten++;
                this.stats.processed += batch.length;

                logger.debug(
                    { batchSize: batch.length, totalProcessed: this.stats.processed },
                    'Enriched events batch written to ClickHouse'
                );
                return;
            } catch (error) {
                retries++;
                this.stats.errors += batch.length;

                if (retries >= MAX_RETRIES) {
                    logger.error(
                        { error: error.message, batchSize: batch.length, retries },
                        'Failed to write enriched events batch after retries'
                    );
                    throw error;
                }

                // Exponential backoff
                const delay = Math.min(1000 * Math.pow(2, retries), 10000);
                logger.warn(
                    { error: error.message, retry: retries, delay },
                    'Retrying enriched events batch write'
                );
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Evaluate alerts for batch of enriched events
     */
    async evaluateAlertsForBatch(batch) {
        for (const event of batch) {
            try {
                // Parse detections từ JSON string
                let detections = [];
                try {
                    detections = typeof event.detections === 'string'
                        ? JSON.parse(event.detections)
                        : (event.detections || []);
                } catch (e) {
                    logger.warn({ error: e.message }, 'Failed to parse detections for alert evaluation');
                }

                // Evaluate detection data
                const triggeredAlerts = await alertEvaluationService.evaluateDetectionData({
                    device_id: event.device_id,
                    detection_count: event.detection_count || 0,
                    detections,
                    timestamp: event.timestamp || event.processed_at,
                });

                // Generate alerts
                for (const alertData of triggeredAlerts) {
                    try {
                        await alertGenerationService.generateAlert(alertData);
                    } catch (error) {
                        logger.warn(
                            { error: error.message, alertData },
                            'Failed to generate alert (non-blocking)'
                        );
                    }
                }
            } catch (error) {
                logger.warn(
                    { error: error.message, device_id: event.device_id },
                    'Alert evaluation failed for event (non-blocking)'
                );
            }
        }
    }

    /**
     * Add event to batch và flush nếu đủ
     */
    async addEventToBatch(event) {
        this.eventBatch.push(event);

        // Flush nếu batch đủ size
        if (this.eventBatch.length >= BATCH_SIZE) {
            const batch = [...this.eventBatch];
            this.eventBatch = [];

            // Clear timer nếu có
            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
                this.batchTimer = null;
            }

            // Write batch
            await this.writeBatch(batch);
        } else {
            // Set timer để flush sau timeout
            if (!this.batchTimer) {
                this.batchTimer = setTimeout(async () => {
                    if (this.eventBatch.length > 0) {
                        const batch = [...this.eventBatch];
                        this.eventBatch = [];

                        this.batchTimer = null;
                        await this.writeBatch(batch);
                    }
                }, BATCH_TIMEOUT);
            }
        }
    }

    /**
     * Start consuming messages
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Enriched events processor already running');
            return;
        }

        try {
            this.isRunning = true;

            await this.consumer.run({
                autoCommit: true,
                autoCommitInterval: 5000,
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        // Parse enriched event
                        const event = this.parseEvent(message);
                        if (!event) {
                            return; // Skip invalid events
                        }

                        // Add to batch
                        await this.addEventToBatch(event);

                        // Log progress mỗi 50 messages
                        if (this.stats.processed % 50 === 0) {
                            logger.debug(
                                {
                                    processed: this.stats.processed,
                                    errors: this.stats.errors,
                                    batchSize: this.eventBatch.length,
                                },
                                'Enriched events processor progress'
                            );
                        }
                    } catch (error) {
                        this.stats.errors++;
                        logger.error(
                            { error: error.message, topic, partition, offset: message.offset },
                            'Error processing enriched event'
                        );
                    }
                },
            });

            logger.info('Enriched events processor started successfully');
        } catch (error) {
            this.isRunning = false;
            logger.error({ error: error.message }, 'Failed to start enriched events processor');
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
            this.isRunning = false;

            // Clear timer
            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
                this.batchTimer = null;
            }

            // Flush remaining batch
            if (this.eventBatch.length > 0) {
                await this.writeBatch([...this.eventBatch]);
                this.eventBatch = [];
            }

            // Disconnect consumer
            if (this.consumer) {
                await this.consumer.disconnect();
            }

            logger.info('Enriched events processor stopped');
        } catch (error) {
            logger.error({ error: error.message }, 'Error stopping enriched events processor');
            throw error;
        }
    }

    /**
     * Get processor stats
     */
    getStats() {
        return {
            ...this.stats,
            batchSize: this.eventBatch.length,
            isRunning: this.isRunning,
        };
    }

    /**
     * Check if processor is healthy
     */
    isHealthy() {
        return this.isRunning && this.stats.errors < this.stats.processed / 10; // < 10% error rate
    }
}

// Singleton instance
let processorInstance = null;

/**
 * Initialize và start enriched events processor
 * @param {Object} kafka - Kafka instance
 */
async function startEnrichedEventsProcessor(kafka) {
    if (processorInstance) {
        logger.warn('Enriched events processor already initialized');
        return processorInstance;
    }

    try {
        processorInstance = new EnrichedEventsProcessor(kafka);
        await processorInstance.initialize();
        await processorInstance.start();

        logger.info('Enriched events processor service started');
        return processorInstance;
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to start enriched events processor service');
        throw error;
    }
}

/**
 * Stop enriched events processor
 */
async function stopEnrichedEventsProcessor() {
    if (processorInstance) {
        await processorInstance.stop();
        processorInstance = null;
    }
}

/**
 * Get enriched events processor stats
 */
function getEnrichedEventsProcessorStats() {
    return processorInstance ? processorInstance.getStats() : null;
}

/**
 * Check if enriched events processor is healthy
 */
function isEnrichedEventsProcessorHealthy() {
    return processorInstance ? processorInstance.isHealthy() : false;
}

module.exports = {
    startEnrichedEventsProcessor,
    stopEnrichedEventsProcessor,
    getEnrichedEventsProcessorStats,
    isEnrichedEventsProcessorHealthy,
};

