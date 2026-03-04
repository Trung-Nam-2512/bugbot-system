const mqtt = require("mqtt");
const { EventEmitter } = require("events");
const { logger } = require("../libs/logger");

/**
 * MQTT Service for ESP32-CAM communication.
 *
 * Emitted events (all receive { deviceId, payload, topic, ts }):
 *   "device:online"   – camera published online status (retain)
 *   "device:offline"  – LWT offline or online===false
 *   "device:ack"      – command acknowledgment (ack field present)
 *   "device:event"    – capture / upload events (event field)
 *   "device:ota"      – OTA-related events (event starts with "ota_")
 *   "device:warning"  – health / clock warnings (warn field)
 *   "device:config"   – auto-mode config response (ok field)
 *   "device:unknown"  – unclassified payload
 *   "device:message"  – every single message (raw, for logging)
 */
class MqttService extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.prefix = process.env.MQTT_PREFIX || "BINHDUONG/ESP32CAM";
        this.lastStatus = new Map();
    }

    start() {
        if (this.client) return this.client;

        const url = process.env.MQTT_BROKER || "mqtt://localhost:1883";
        const options = {
            username: process.env.MQTT_USERNAME || undefined,
            password: process.env.MQTT_PASSWORD || undefined,
            reconnectPeriod: 2000,
            keepalive: 30,
            clientId: `srv-${Math.random().toString(16).slice(2)}`,
        };

        this.client = mqtt.connect(url, options);

        this.client.on("connect", () => {
            logger.info({ url }, "[MQTT] connected");
            const sub = `${this.prefix}/+/status`;
            this.client.subscribe(sub, { qos: 1 }, (err) => {
                if (err) logger.error({ err }, "[MQTT] subscribe error");
                else logger.info({ topic: sub }, "[MQTT] subscribed");
            });
        });

        this.client.on("reconnect", () => logger.info("[MQTT] reconnecting..."));
        this.client.on("offline", () => logger.warn("[MQTT] client offline"));
        this.client.on("error", (e) => logger.error({ err: e.message }, "[MQTT] error"));

        this.client.on("message", (topic, buf) => {
            try {
                this._handleMessage(topic, buf);
            } catch (e) {
                logger.error({ err: e.message, topic }, "[MQTT] message handler error");
            }
        });

        return this.client;
    }

    // ── Message classification ──────────────────────────────────────

    _handleMessage(topic, buf) {
        const raw = buf.toString();
        const parts = topic.split("/");
        const deviceId = parts[parts.length - 2] || "unknown";

        let payload = raw;
        try { payload = JSON.parse(raw); } catch { /* plain text */ }

        const ts = Date.now();
        const envelope = { deviceId, payload, topic, ts };

        this.lastStatus.set(deviceId, { ts, payload });
        this.emit("device:message", envelope);

        if (typeof payload !== "object" || payload === null) {
            this.emit("device:unknown", envelope);
            return;
        }

        // Presence: online / offline
        if ("online" in payload) {
            this.emit(payload.online ? "device:online" : "device:offline", envelope);
            return;
        }

        // Command ACK
        if ("ack" in payload) {
            if (typeof payload.ack === "string" && payload.ack.startsWith("ota")) {
                this.emit("device:ota", envelope);
            }
            this.emit("device:ack", envelope);
            return;
        }

        // Telemetry / event
        if ("event" in payload) {
            const evt = payload.event;
            if (typeof evt === "string" && evt.startsWith("ota_")) {
                this.emit("device:ota", envelope);
            } else {
                this.emit("device:event", envelope);
            }
            return;
        }

        // Health / clock warnings
        if ("warn" in payload) {
            this.emit("device:warning", envelope);
            return;
        }

        // Auto-config response
        if ("ok" in payload) {
            this.emit("device:config", envelope);
            return;
        }

        this.emit("device:unknown", envelope);
    }

    // ── Command helpers ─────────────────────────────────────────────

    _topicCmd(id) {
        return `${this.prefix}/${id}/cmd`;
    }

    publishCmd(deviceId, payload, opts = {}) {
        if (!this.client || !this.client.connected) {
            throw new Error("mqtt_not_connected");
        }
        const topic = this._topicCmd(deviceId);
        const body = typeof payload === "string" ? payload : JSON.stringify(payload);
        const qos = opts.qos ?? 0;
        this.client.publish(topic, body, { qos, retain: false });
        logger.debug({ topic, body }, "[MQTT] published cmd");
        return { topic, body };
    }

    capture(deviceId) {
        return this.publishCmd(deviceId, "capture");
    }

    requestStatus(deviceId) {
        return this.publishCmd(deviceId, { cmd: "status" });
    }

    reset(deviceId) {
        return this.publishCmd(deviceId, { cmd: "reset" });
    }

    restartCamera(deviceId) {
        return this.publishCmd(deviceId, { cmd: "restart_camera" });
    }

    otaCheck(deviceId) {
        return this.publishCmd(deviceId, { cmd: "ota_check" });
    }

    otaUpdate(deviceId) {
        return this.publishCmd(deviceId, { cmd: "ota_update" });
    }

    setAutoConfig(deviceId, enabled, seconds) {
        const payload = { auto: !!enabled };
        if (typeof seconds === "number") payload.intervalSec = Number(seconds);
        return this.publishCmd(deviceId, payload);
    }

    broadcastCmd(payload) {
        return this.publishCmd("all", payload);
    }

    broadcastCapture() {
        return this.broadcastCmd("capture");
    }

    // ── Status helpers ──────────────────────────────────────────────

    getLastStatus(deviceId) {
        return this.lastStatus.get(deviceId) || null;
    }

    isConnected() {
        return this.client !== null && this.client.connected === true;
    }

    stop() {
        if (this.client) {
            this.client.end(true);
            this.client = null;
            logger.info("[MQTT] client stopped");
        }
        this.removeAllListeners();
    }
}

const mqttInstance = new MqttService();

module.exports = mqttInstance;
