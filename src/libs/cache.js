/**
 * Simple In-Memory Cache
 * 
 * Cache implementation cho stats queries với TTL
 */

const { logger } = require('./logger');

class SimpleCache {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 30 * 1000; // 30 seconds default
    }

    /**
     * Get value từ cache
     * @param {string} key - Cache key
     * @returns {any|null} - Cached value hoặc null nếu không có/expired
     */
    get(key) {
        const item = this.cache.get(key);

        if (!item) {
            return null;
        }

        // Check if expired
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    /**
     * Set value vào cache
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    set(key, value, ttl = null) {
        const expiresAt = Date.now() + (ttl || this.defaultTTL);

        this.cache.set(key, {
            value,
            expiresAt,
            createdAt: Date.now(),
        });

        logger.debug({ key, ttl: ttl || this.defaultTTL }, 'Cache set');
    }

    /**
     * Delete key từ cache
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        logger.debug('Cache cleared');
    }

    /**
     * Get cache stats
     */
    getStats() {
        const now = Date.now();
        let valid = 0;
        let expired = 0;

        this.cache.forEach(item => {
            if (now > item.expiresAt) {
                expired++;
            } else {
                valid++;
            }
        });

        return {
            total: this.cache.size,
            valid,
            expired,
        };
    }

    /**
     * Cleanup expired entries
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        this.cache.forEach((item, key) => {
            if (now > item.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        });

        if (cleaned > 0) {
            logger.debug({ cleaned }, 'Cache cleanup');
        }
    }
}

// Singleton instance
const cache = new SimpleCache();

// Auto cleanup mỗi 1 phút
setInterval(() => {
    cache.cleanup();
}, 60 * 1000);

module.exports = cache;









