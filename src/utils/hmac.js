const crypto = require("crypto");

function sha256Hex(buf) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

function sign(secret, deviceId, ts, imgHashHex) {
    const msg = `${deviceId}.${ts}.${imgHashHex}`;
    return crypto.createHmac("sha256", secret).update(msg).digest("hex");
}

function verifyFull(secret, deviceId, ts, imgBuf, signatureHex, skewSec = 120) {
    if (!secret) return true;                 // tắt HMAC => pass
    if (!signatureHex) return false;

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(ts)) > skewSec) return false;

    const imgHash = sha256Hex(imgBuf);
    const mac = sign(secret, deviceId, ts, imgHash);

    const a = Buffer.from(mac, "hex");
    const b = Buffer.from(signatureHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

module.exports = { sha256Hex, sign, verifyFull };
