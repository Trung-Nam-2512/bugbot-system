/**
 * Email Templates
 * Templates cho email notifications
 */

/**
 * Generate alert email HTML
 */
function generateAlertEmailHTML(alertData) {
    const severityEmoji = {
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🚨',
    };

    const severityColor = {
        info: '#2196F3',
        warning: '#FF9800',
        critical: '#F44336',
    };

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #f4f4f4;
                }
                .container {
                    max-width: 600px;
                    margin: 20px auto;
                    background-color: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .header {
                    background-color: ${severityColor[alertData.severity] || '#2196F3'};
                    color: white;
                    padding: 30px 20px;
                    text-align: center;
                }
                .header h1 {
                    margin: 0;
                    font-size: 24px;
                }
                .content {
                    padding: 30px 20px;
                }
                .alert-info {
                    background-color: #f9f9f9;
                    padding: 20px;
                    margin: 20px 0;
                    border-left: 4px solid ${severityColor[alertData.severity] || '#2196F3'};
                    border-radius: 4px;
                }
                .alert-info p {
                    margin: 10px 0;
                }
                .alert-info strong {
                    color: #555;
                }
                .footer {
                    text-align: center;
                    padding: 20px;
                    background-color: #f9f9f9;
                    color: #666;
                    font-size: 12px;
                    border-top: 1px solid #eee;
                }
                .button {
                    display: inline-block;
                    padding: 10px 20px;
                    background-color: ${severityColor[alertData.severity] || '#2196F3'};
                    color: white;
                    text-decoration: none;
                    border-radius: 4px;
                    margin: 10px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${severityEmoji[alertData.severity] || 'ℹ️'} ${alertData.ruleName}</h1>
                </div>
                <div class="content">
                    <div class="alert-info">
                        <p><strong>Device ID:</strong> ${alertData.deviceId}</p>
                        <p><strong>Severity:</strong> <span style="color: ${severityColor[alertData.severity] || '#2196F3'}; font-weight: bold;">${alertData.severity.toUpperCase()}</span></p>
                        <p><strong>Message:</strong> ${alertData.message}</p>
                        <p><strong>Triggered At:</strong> ${new Date(alertData.triggeredAt).toLocaleString()}</p>
                        ${alertData.metadata?.detection_count ? `<p><strong>Detection Count:</strong> ${alertData.metadata.detection_count}</p>` : ''}
                        ${alertData.metadata?.detections_count ? `<p><strong>Detections:</strong> ${alertData.metadata.detections_count} objects detected</p>` : ''}
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated alert from IoT Monitoring System</p>
                    <p>Alert ID: ${alertData.alertId}</p>
                    <p>Please do not reply to this email</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

/**
 * Generate alert email text (plain text version)
 */
function generateAlertEmailText(alertData) {
    const severityEmoji = {
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🚨',
    };

    return `
${severityEmoji[alertData.severity] || 'ℹ️'} Alert: ${alertData.ruleName}

Device: ${alertData.deviceId}
Severity: ${alertData.severity.toUpperCase()}
Message: ${alertData.message}
Triggered At: ${new Date(alertData.triggeredAt).toLocaleString()}
${alertData.metadata?.detection_count ? `Detection Count: ${alertData.metadata.detection_count}\n` : ''}
${alertData.metadata?.detections_count ? `Detections: ${alertData.metadata.detections_count} objects detected\n` : ''}

Alert ID: ${alertData.alertId}

This is an automated alert from IoT Monitoring System.
Please do not reply to this email.
    `.trim();
}

module.exports = {
    generateAlertEmailHTML,
    generateAlertEmailText,
};


