const express = require("express");
const notificationsController = require("../controllers/notifications.controller");

const router = express.Router();

// In-app notifications
router.get("/", notificationsController.getNotifications);
router.get("/unread", notificationsController.getUnreadCount);
router.post("/:id/read", notificationsController.markAsRead);
router.post("/read-all", notificationsController.markAllAsRead);
router.delete("/:id", notificationsController.deleteNotification);

module.exports = router;


