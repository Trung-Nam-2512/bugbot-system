const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");

const router = express.Router();

// Dashboard overview
router.get("/overview", dashboardController.getDashboardOverview);
router.get("/stats", dashboardController.getDashboardStats);

// Alerts for dashboard
router.get("/alerts/recent", dashboardController.getRecentAlerts);
router.get("/alerts/summary", dashboardController.getAlertsSummary);

// Rules for dashboard
router.get("/rules/active", dashboardController.getActiveRules);

module.exports = router;







