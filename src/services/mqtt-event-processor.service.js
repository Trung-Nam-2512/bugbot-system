const { logger } = require("../libs/logger");
const { logActivity } = require("../libs/mongodb");

const MAX_EVENTS = 500;
const STALE_CHECK_INTERVAL_MS = 15 * 1000;
const STALE_TIMEOUT_MS = 60 * 1000;

class MqttEventProcessor {
    constructor() {
        this.events = [];       // ring buffer: newest at index 0
        this.staleTimer = null;
        this.mqttService = null;
        this.deviceRegistry = null;
        this.sseClients = new Set(); // NEW: Manage SSE clients
    }

    start(mqttService, deviceRegistry) {
        this.mqttService = mqttService;
        this.deviceRegistry = deviceRegistry;

        mqttService.on("device:online", (env) => this._onOnline(env));
        mqttService.on("device:offline", (env) => this._onOffline(env));
        mqttService.on("device:ack", (env) => this._onAck(env));
        mqttService.on("device:event", (env) => this._onEvent(env));
        mqttService.on("device:ota", (env) => this._onOta(env));
        mqttService.on("device:warning", (env) => this._onWarning(env));
        mqttService.on("device:config", (env) => this._onConfig(env));
        mqttService.on("device:message", (env) => this._onAnyMessage(env));

        this.staleTimer = setInterval(() => {
            deviceRegistry.markStaleDevices(STALE_TIMEOUT_MS);
        }, STALE_CHECK_INTERVAL_MS);

        logger.info("[EventProcessor] started");
    }

    stop() {
        if (this.staleTimer) {
            clearInterval(this.staleTimer);
            this.staleTimer = null;
        }
        if (this.mqttService) {
            this.mqttService.removeAllListeners();
        }
        logger.info("[EventProcessor] stopped");
    }

    // ── Event accessors (for polling API) ───────────────────────────

    getEvents({ since, deviceId, limit = 50 } = {}) {
        let result = this.events;

        if (since) {
            const sinceTs = typeof since === "number" ? since : Number(since);
            result = result.filter((e) => e.ts > sinceTs);
        }

        if (deviceId) {
            result = result.filter((e) => e.deviceId === deviceId);
        }

        return result.slice(0, Math.min(limit, MAX_EVENTS));
    }

    getLatestEvents(limit = 20) {
        return this.events.slice(0, limit);
    }

    // ── Internal handlers ───────────────────────────────────────────

    async _onOnline({ deviceId, payload }) {
        await this.deviceRegistry.setOnline(deviceId, payload);
        this._push({ deviceId, category: "presence", type: "online", payload });
        this._logActivity(deviceId, "device_online", payload);
    }

    async _onOffline({ deviceId, payload }) {
        await this.deviceRegistry.setOffline(deviceId);
        this._push({ deviceId, category: "presence", type: "offline", payload });
        this._logActivity(deviceId, "device_offline", payload);
    }

    _onAck({ deviceId, payload }) {
        this.deviceRegistry.updateLastSeen(deviceId);
        this._push({ deviceId, category: "ack", type: payload.ack, payload });
    }

    async _onEvent({ deviceId, payload }) {
        this.deviceRegistry.updateLastSeen(deviceId);
        const type = payload.event || "unknown";
        this._push({ deviceId, category: "event", type, payload });

        if (type === "upload_ok") {
            await this.deviceRegistry.incrementImageCount(deviceId);
        }

        if (type === "capture_fail" || type === "upload_fail") {
            this._logActivity(deviceId, type, payload);
        }
    }

    _onOta({ deviceId, payload }) {
        this.deviceRegistry.updateLastSeen(deviceId);
        const type = payload.event || payload.ack || "ota_unknown";
        this._push({ deviceId, category: "ota", type, payload });
        this._logActivity(deviceId, type, payload);
    }

    _onWarning({ deviceId, payload }) {
        this.deviceRegistry.updateLastSeen(deviceId);
        this._push({ deviceId, category: "warning", type: payload.warn, payload });
        this._logActivity(deviceId, `warn_${payload.warn}`, payload);
    }

    _onConfig({ deviceId, payload }) {
        this.deviceRegistry.updateLastSeen(deviceId);
        this._push({ deviceId, category: "config", type: "auto_config", payload });
    }

    _onAnyMessage({ deviceId }) {
        this.deviceRegistry.updateLastSeen(deviceId);
    }

    // ── Ring buffer ─────────────────────────────────────────────────

    _push(event) {
        const record = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            ts: Date.now(),
            ...event,
        };
        this.events.unshift(record);
        if (this.events.length > MAX_EVENTS) {
            this.events.length = MAX_EVENTS;
        }

        // Broadcast to all SSE clients
        this._broadcastSSE(record);
    }

    // ── SSE Broadcaster ─────────────────────────────────────────────

    addSSEClient(res) {
        this.sseClients.add(res);
        return () => this.sseClients.delete(res); // Return function to remove client
    }

    _broadcastSSE(data) {
        if (this.sseClients.size === 0) return;
        const msg = `data: ${JSON.stringify(data)}\n\n`;
        for (const client of this.sseClients) {
            try {
                client.write(msg);
            } catch (err) {
                this.sseClients.delete(client);
            }
        }
    }

    // ── Activity logging (fire-and-forget) ──────────────────────────

    _logActivity(deviceId, eventType, metadata) {
        logActivity(deviceId, eventType, metadata).catch((err) => {
            logger.error({ err: err.message, deviceId, eventType }, "[EventProcessor] logActivity failed");
        });
    }
}

const eventProcessor = new MqttEventProcessor();

module.exports = eventProcessor;
