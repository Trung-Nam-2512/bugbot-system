/**
 * Notifications Controller
 * API endpoints cho in-app notifications
 */

const { logger } = require('../libs/logger');
const { getMongoDB } = require('../libs/mongodb');
const cache = require('../libs/cache');

const CACHE_TTL = 30; // 30 seconds

/**
 * GET /api/notifications - Get user notifications
 */
async function getNotifications(req, res, next) {
    try {
        const db = getMongoDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const {
            page = 1,
            limit = 20,
            read,
            severity,
            deviceId,
        } = req.query;

        const query = {};
        if (read !== undefined) {
            query.read = read === 'true';
        }
        if (severity) {
            query.severity = severity;
        }
        if (deviceId) {
            query.deviceId = deviceId;
        }

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        
        const [notifications, total] = await Promise.all([
            db.collection('in_app_notifications')
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit, 10))
                .toArray(),
            db.collection('in_app_notifications').countDocuments(query),
        ]);

        return res.json({
            ok: true,
            notifications,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total,
                totalPages: Math.ceil(total / parseInt(limit, 10)),
            },
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Error in getNotifications');
        next(error);
    }
}

/**
 * GET /api/notifications/unread - Get unread count
 */
async function getUnreadCount(req, res, next) {
    try {
        const cacheKey = 'notificationsUnreadCount';
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json({ ok: true, ...cached, cached: true });
        }

        const db = getMongoDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const count = await db.collection('in_app_notifications')
            .countDocuments({ read: false });

        const result = { count };
        cache.set(cacheKey, result, CACHE_TTL);
        return res.json({ ok: true, ...result, cached: false });
    } catch (error) {
        logger.error({ error: error.message }, 'Error in getUnreadCount');
        next(error);
    }
}

/**
 * POST /api/notifications/:id/read - Mark notification as read
 */
async function markAsRead(req, res, next) {
    try {
        const db = getMongoDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const { id } = req.params;
        
        const result = await db.collection('in_app_notifications').updateOne(
            { alertId: id },
            { $set: { read: true, readAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                ok: false,
                error: 'not_found',
                message: 'Notification not found',
            });
        }

        // Clear cache
        try {
            cache.delete('notificationsUnreadCount');
        } catch (e) {
            // Cache clear failed, continue anyway
        }

        return res.json({
            ok: true,
            message: 'Notification marked as read',
        });
    } catch (error) {
        logger.error({ error: error.message, id: req.params.id }, 'Error in markAsRead');
        next(error);
    }
}

/**
 * POST /api/notifications/read-all - Mark all notifications as read
 */
async function markAllAsRead(req, res, next) {
    try {
        const db = getMongoDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const result = await db.collection('in_app_notifications').updateMany(
            { read: false },
            { $set: { read: true, readAt: new Date() } }
        );

        // Clear cache
        try {
            cache.delete('notificationsUnreadCount');
        } catch (e) {
            // Cache clear failed, continue anyway
        }

        return res.json({
            ok: true,
            message: 'All notifications marked as read',
            updated: result.modifiedCount,
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Error in markAllAsRead');
        next(error);
    }
}

/**
 * DELETE /api/notifications/:id - Delete notification
 */
async function deleteNotification(req, res, next) {
    try {
        const db = getMongoDB();
        if (!db) {
            throw new Error('MongoDB not connected');
        }

        const { id } = req.params;
        
        const result = await db.collection('in_app_notifications').deleteOne({ alertId: id });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                ok: false,
                error: 'not_found',
                message: 'Notification not found',
            });
        }

        // Clear cache
        try {
            cache.delete('notificationsUnreadCount');
        } catch (e) {
            // Cache clear failed, continue anyway
        }

        return res.json({
            ok: true,
            message: 'Notification deleted',
        });
    } catch (error) {
        logger.error({ error: error.message, id: req.params.id }, 'Error in deleteNotification');
        next(error);
    }
}

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
};


