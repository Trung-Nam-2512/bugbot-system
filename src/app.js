const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

// Import routes
const uploadRoutes = require("./routes/upload.routes");    // NEW: streaming upload
const healthRoutes = require("./routes/health.routes");    // NEW: health checks
const camRoutes = require("./routes/cam.routes");          // upload ảnh (legacy)
const camMqttRoutes = require("./routes/cam.mqtt.routes"); // điều khiển MQTT
const imagesRoutes = require("./routes/images.routes");    // quản lý ảnh
const statsRoutes = require("./routes/stats.routes");      // thống kê

// Import middleware
const logger = require("./middlewares/logger");

const app = express();

// Security middleware
app.use(helmet());

// CORS Configuration - Whitelist specific origins
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
            ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
            : [];

        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            return callback(null, true);
        }

        // In development, allow localhost
        if (process.env.NODE_ENV !== 'production') {
            if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
                return callback(null, true);
            }
        }

        // Check if origin is in whitelist
        // If no CORS_ALLOWED_ORIGINS set, allow all (for development/testing)
        // WARNING: In production, this is insecure - should set CORS_ALLOWED_ORIGINS
        if (allowedOrigins.length === 0) {
            if (process.env.NODE_ENV === 'production') {
                console.warn('⚠️  WARNING: CORS_ALLOWED_ORIGINS not set in production! Allowing all origins (INSECURE)');
            }
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Shot-Id', 'X-Signature', 'X-Firmware-Version']
};

app.use(cors(corsOptions));

// Rate Limiting
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes default
const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

const generalLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMaxRequests,
    message: { ok: false, error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health checks and SSE stream (long-lived connections)
        return req.path === '/api/health'
            || req.path === '/api/health/live'
            || req.path === '/api/health/ready'
            || req.path === '/api/iot/mqtt/events/stream';
    }
});

// Upload endpoint rate limiting (stricter)
const uploadRateLimitWindowMs = parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || '3600000', 10); // 1 hour default
const uploadRateLimitMaxRequests = parseInt(process.env.UPLOAD_RATE_LIMIT_MAX_REQUESTS || '50', 10);

const uploadLimiter = rateLimit({
    windowMs: uploadRateLimitWindowMs,
    max: uploadRateLimitMaxRequests,
    message: { ok: false, error: 'Too many upload requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limiting
app.use('/api/', generalLimiter);

// Logging middleware
app.use(logger);

// Body parsing middleware
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// API Routes - Streaming First Architecture
app.use("/api/upload", uploadLimiter, uploadRoutes);      // NEW: Streaming upload (MinIO + Kafka) - with stricter rate limit
app.use("/api/health", healthRoutes);      // NEW: Comprehensive health checks

// Legacy routes (kept for backward compatibility)
app.use("/api/iot/cam", camRoutes);        // Upload ảnh từ ESP32 (legacy)
app.use("/api/iot/mqtt", camMqttRoutes);   // Điều khiển MQTT
app.use("/api/cam/images", imagesRoutes);  // Quản lý ảnh (list, get, delete, download)
app.use("/api/cam/stats", statsRoutes);    // Thống kê và devices

// 404 handler
app.use((req, res) => res.status(404).json({ ok: false, error: "not_found" }));

// Error handler
app.use((err, req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ ok: false, error: err.message || "server_error" });
});

module.exports = app;
