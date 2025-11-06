const express = require("express");
const { body } = require("express-validator");
const validate = require("../middlewares/validate");
const ctrl = require("../controllers/cam.mqtt.controller");

const router = express.Router();

// router.use((req,_res,next)=>{ console.log("[MQTT ROUTER]", req.method, req.url); next(); });

// GET /api/iot/mqtt/devices - Get all devices (moved from stats)
router.get("/devices", ctrl.getDevices);

// POST /api/iot/mqtt/:id/capture - Capture photo
router.post("/:id/capture", ctrl.capture);

// POST /api/iot/mqtt/:id/auto-config - Configure auto capture
router.post(
    "/:id/auto-config",
    body("enabled").isBoolean().withMessage("enabled must be boolean"),
    body("seconds").optional().isInt({ min: 3, max: 3600 }),
    validate,
    ctrl.autoConfig
);

// GET /api/iot/mqtt/:id/status - Get device status
router.get("/:id/status", ctrl.status);

// DELETE /api/iot/mqtt/:id - Delete device
router.delete("/:id", ctrl.deleteDevice);

module.exports = router;
