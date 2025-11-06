const cfg = require("../config");

module.exports = function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    
    // Log full error details (for debugging)
    if (cfg.env !== "test") {
        console.error('Error Handler:', {
            message: err.message,
            stack: cfg.env === 'development' ? err.stack : undefined,
            status: status,
            path: req.path,
            method: req.method
        });
    }
    
    // Don't expose internal error details in production
    let errorMessage = "server_error";
    
    if (cfg.env === 'development') {
        // Development: show actual error message
        errorMessage = err.message || "server_error";
    } else if (status < 500) {
        // Client errors (4xx): safe to show
        errorMessage = err.message || "client_error";
    } else {
        // Server errors (5xx): generic message only
        errorMessage = "Internal server error";
    }
    
    res.status(status).json({
        ok: false,
        error: errorMessage
    });
};
