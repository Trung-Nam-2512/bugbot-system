const express = require("express");
const alertsController = require("../controllers/alerts.controller");

const router = express.Router();

// Alert Rules
router.get("/rules", alertsController.getAlertRules);
router.get("/rules/:id", alertsController.getAlertRule);
router.post("/rules", alertsController.createAlertRule);
router.put("/rules/:id", alertsController.updateAlertRule);
router.delete("/rules/:id", alertsController.deleteAlertRule);

// Alert History
router.get("/", alertsController.getAlerts);
router.get("/stats", alertsController.getAlertStats);
router.get("/:id", alertsController.getAlert);
router.post("/:id/acknowledge", alertsController.acknowledgeAlert);
router.post("/:id/resolve", alertsController.resolveAlert);

module.exports = router;


