const express = require("express");
const { body, query } = require("express-validator");
const validate = require("../middlewares/validate");
const ctrl = require("../controllers/cam.mqtt.controller");

const router = express.Router();

// ── MQTT connection status ──────────────────────────────────────
router.get("/status", ctrl.getMqttStatus);

// ── Device listing ──────────────────────────────────────────────
router.get("/devices", ctrl.getDevices);
router.get("/devices/:id", ctrl.getDeviceDetail);
router.get("/devices/:id/status", ctrl.getDeviceStatus);
router.delete("/devices/:id", ctrl.deleteDevice);

// ── Device commands ─────────────────────────────────────────────
router.post("/devices/:id/capture", ctrl.capture);
router.post("/devices/:id/request-status", ctrl.requestStatus);
router.post("/devices/:id/reset", ctrl.resetDevice);
router.post("/devices/:id/restart-camera", ctrl.restartCamera);

router.post(
    "/devices/:id/auto-config",
    body("enabled").isBoolean().withMessage("enabled must be boolean"),
    body("seconds").optional().isInt({ min: 3, max: 3600 }),
    validate,
    ctrl.autoConfig
);

// ── OTA ─────────────────────────────────────────────────────────
router.post("/devices/:id/ota/check", ctrl.otaCheck);
router.post("/devices/:id/ota/update", ctrl.otaUpdate);

// ── Broadcast ───────────────────────────────────────────────────
router.post("/broadcast/capture", ctrl.broadcastCapture);

// ── Server-Sent Events (SSE) ─────────────────────────────────────
router.get("/events/stream", ctrl.sseEventsStream);

// ── Events polling ──────────────────────────────────────────────
router.get(
    "/events",
    query("since").optional().isNumeric(),
    query("deviceId").optional().isString(),
    query("limit").optional().isInt({ min: 1, max: 200 }),
    validate,
    ctrl.getEvents
);
router.get("/events/latest", ctrl.getLatestEvents);

module.exports = router;
