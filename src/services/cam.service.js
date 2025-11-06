const fsp = require("fs/promises");
const path = require("path");
const { mkdirp } = require("mkdirp");
const crypto = require("crypto");
const cfg = require("../config");
const { utcStamp, dayFolder } = require("../utils/filenames");
const { verifyFull, sha256Hex } = require("../utils/hmac");

async function saveUpload({ device_id, ts, extraRaw, fileBuf, mimetype, signature }) {
    if (!verifyFull(cfg.hmacSecret, device_id, ts, fileBuf, signature)) {
        const e = new Error("bad_signature"); e.status = 401; throw e;
    }

    const day = dayFolder(); // UTC
    const dir = path.join(cfg.uploadDir, day, device_id);
    await mkdirp(dir);

    const base = `${utcStamp()}_${device_id}`;
    const jpgPath = path.join(dir, `${base}.jpg`);
    const jsonPath = path.join(dir, `${base}.json`);

    await fsp.writeFile(jpgPath, fileBuf);

    let extra = {};
    try { extra = extraRaw ? JSON.parse(extraRaw) : {}; } catch { extra = { raw: extraRaw }; }

    const meta = {
        device_id,
        ts: Number(ts || Date.now()),
        receivedAt: new Date().toISOString(),
        size: fileBuf.length,
        mime: mimetype,
        checksum: { algo: "sha256", value: sha256Hex(fileBuf) },
        extra
    };
    await fsp.writeFile(jsonPath, JSON.stringify(meta, null, 2));

    return { jpgPath, jsonPath };
}

module.exports = { saveUpload };
