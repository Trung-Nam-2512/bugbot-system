const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

// Health check endpoint
router.get('/', healthController.healthCheck);

// Liveness probe (K8s)
router.get('/live', healthController.livenessProbe);

// Readiness probe (K8s)
router.get('/ready', healthController.readinessProbe);

// Stream processor stats
router.get('/stream-processor', healthController.streamProcessorStats);

module.exports = router;
