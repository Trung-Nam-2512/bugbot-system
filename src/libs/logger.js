const pino = require('pino');

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
    formatters: {
        level: (label) => {
            return { level: label };
        },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with additional context
 * @param {object} bindings - Additional context to bind to the logger
 * @returns {pino.Logger}
 */
function createChildLogger(bindings) {
    return logger.child(bindings);
}

module.exports = {
    logger,
    createChildLogger,
};

