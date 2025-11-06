const path = require("path");

const cfg = {
    env: process.env.NODE_ENV || "development",
    port: parseInt(process.env.PORT) || 1435,
    token: process.env.IOT_TOKEN || "haha!2512@2003",
    uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"),
    logLevel: process.env.LOG_LEVEL || "info",
    hmacSecret: process.env.HMAC_SECRET || "hahahahuhuhhu2512"
};


module.exports = cfg;
