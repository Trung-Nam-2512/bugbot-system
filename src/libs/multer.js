const multer = require("multer");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: 1,
        fileSize: 8 * 1024 * 1024 // 8MB
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image/* allowed"));
        }
        cb(null, true);
    }
});

module.exports = upload;
