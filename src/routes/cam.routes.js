const express = require("express");
const multer = require("multer");
const ctrl = require("../controllers/cam.controller");

const router = express.Router();

// Dùng memoryStorage -> nhận file trong req.file.buffer
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// Firmware gửi field tên "file" (khớp HttpUploader)
router.post("/upload", upload.single("file"), ctrl.upload);

module.exports = router;
