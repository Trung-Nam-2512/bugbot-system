const express = require("express");
const router = express.Router();
const statsController = require("../controllers/stats.controller");
const detectionStatsController = require("../controllers/detection-stats.controller");

// GET /api/cam/stats - Get overall statistics
router.get("/", statsController.getStats);

// GET /api/cam/stats/devices - Get all devices (must come before /:deviceId)
router.get("/devices", statsController.getDevices);

// Phase 3: Detection Statistics Endpoints (must come before /:deviceId)
// GET /api/cam/stats/detections - Get overall detection statistics
router.get("/detections", detectionStatsController.getDetectionsStats);

// GET /api/cam/stats/species - Get species distribution
router.get("/species", detectionStatsController.getSpeciesStats);

// GET /api/cam/stats/confidence - Get confidence distribution
router.get("/confidence", detectionStatsController.getConfidenceStats);

// GET /api/cam/stats/detections/timeline - Get detection timeline
router.get("/detections/timeline", detectionStatsController.getDetectionsTimeline);

// GET /api/cam/stats/:deviceId - Get statistics for specific device (must be last)
router.get("/:deviceId", statsController.getDeviceStats);

module.exports = router;
