/**
 * Notification Service
 * Gửi notifications qua các channels: email, webhook, in-app
 */

const { logger } = require('../libs/logger');
const { getMongoDB } = require('../libs/mongodb');

/**
 * Send email notification
 */
async function sendEmail(config, alertData) {
    try {
        const nodemailer = require('nodemailer');
        
        // Get SMTP config từ env hoặc config
        const smtpConfig = {
            host: config.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(config.smtpPort || process.env.SMTP_PORT || '587', 10),
            secure: config.smtpSecure === true || process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: config.smtpUser || process.env.SMTP_USER,
                pass: config.smtpPassword || process.env.SMTP_PASSWORD,
            },
        };

        // Validate SMTP config
        if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
            logger.warn('SMTP credentials not configured, skipping email');
            await storeNotification({
                type: 'email',
                channel: config.to,
                alertId: alertData.alertId,
                status: 'failed',
                error: 'SMTP credentials not configured',
                config,
            });
            return false;
        }

        // Create transporter
        const transporter = nodemailer.createTransport(smtpConfig);

        // Email templates
        const emailTemplates = require('./email-templates');
        const htmlContent = emailTemplates.generateAlertEmailHTML(alertData);
        const textContent = emailTemplates.generateAlertEmailText(alertData);

        const severityEmoji = {
            info: 'ℹ️',
            warning: '⚠️',
            critical: '🚨',
        };

        const mailOptions = {
            from: config.from || process.env.SMTP_FROM || smtpConfig.auth.user,
            to: config.to,
            subject: `${severityEmoji[alertData.severity] || 'ℹ️'} Alert: ${alertData.ruleName} - ${alertData.deviceId}`,
            text: textContent,
            html: htmlContent,
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);

        logger.info(
            {
                to: config.to,
                messageId: info.messageId,
                alertId: alertData.alertId,
            },
            'Email notification sent'
        );

        // Store notification record
        await storeNotification({
            type: 'email',
            channel: config.to,
            alertId: alertData.alertId,
            status: 'sent',
            config: {
                ...config,
                messageId: info.messageId,
            },
        });

        return true;
    } catch (error) {
        logger.error(
            { error: error.message, to: config.to },
            'Failed to send email notification'
        );

        // Store failed notification
        await storeNotification({
            type: 'email',
            channel: config.to,
            alertId: alertData.alertId,
            status: 'failed',
            error: error.message,
            config,
        });

        throw error;
    }
}

/**
 * Send webhook notification
 */
async function sendWebhook(config, alertData) {
    try {
        const axios = require('axios');
        
        const payload = {
            alertId: alertData.alertId,
            ruleName: alertData.ruleName,
            deviceId: alertData.deviceId,
            severity: alertData.severity,
            message: alertData.message,
            metadata: alertData.metadata,
            triggeredAt: alertData.triggeredAt,
        };

        const response = await axios.post(config.url, payload, {
            headers: {
                'Content-Type': 'application/json',
                ...(config.headers || {}),
            },
            timeout: config.timeout || 5000,
        });

        logger.info(
            {
                url: config.url,
                alertId: alertData.alertId,
                status: response.status,
            },
            'Webhook notification sent'
        );

        // Store notification record
        await storeNotification({
            type: 'webhook',
            channel: config.url,
            alertId: alertData.alertId,
            status: 'sent',
            config,
        });

        return true;
    } catch (error) {
        logger.error(
            { error: error.message, url: config.url },
            'Failed to send webhook notification'
        );

        // Store failed notification
        await storeNotification({
            type: 'webhook',
            channel: config.url,
            alertId: alertData.alertId,
            status: 'failed',
            error: error.message,
            config,
        });

        throw error;
    }
}

/**
 * Send in-app notification
 */
async function sendInApp(alertData) {
    try {
        // Store in-app notification
        const db = getMongoDB();
        if (db) {
            const notification = {
                alertId: alertData.alertId,
                ruleName: alertData.ruleName,
                deviceId: alertData.deviceId,
                severity: alertData.severity,
                message: alertData.message,
                read: false,
                createdAt: new Date(),
            };

            await db.collection('in_app_notifications').insertOne(notification);
            logger.debug({ alertId: alertData.alertId }, 'In-app notification stored');
        }

        // Store notification record
        await storeNotification({
            type: 'in_app',
            channel: 'in_app',
            alertId: alertData.alertId,
            status: 'sent',
        });

        return true;
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to send in-app notification');
        throw error;
    }
}

/**
 * Store notification record
 */
async function storeNotification(notificationData) {
    try {
        const db = getMongoDB();
        if (!db) {
            return; // Skip if MongoDB unavailable
        }

        await db.collection('notification_logs').insertOne({
            ...notificationData,
            createdAt: new Date(),
        });
    } catch (error) {
        logger.warn({ error: error.message }, 'Failed to store notification log');
        // Don't throw - notification should still be sent
    }
}

module.exports = {
    sendEmail,
    sendWebhook,
    sendInApp,
};

