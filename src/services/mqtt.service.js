const mqtt = require("mqtt");

class MqttService {
    constructor() {
        this.client = null;
        this.prefix = process.env.MQTT_PREFIX || "BINHDUONG/ESP32CAM";
        this.lastStatus = new Map(); // deviceId -> { ts, payload }
    }

    start() {
        if (this.client) return this.client;

        const url = process.env.MQTT_URL || "mqtt://localhost:1883";
        const options = {
            username: process.env.MQTT_USER || undefined,
            password: process.env.MQTT_PASS || undefined,
            reconnectPeriod: 2000,
            keepalive: 30,
            clientId: `srv-${Math.random().toString(16).slice(2)}`
        };

        this.client = mqtt.connect(url, options);

        this.client.on("connect", () => {
            console.log("[MQTT] connected:", url);
            const sub = `${this.prefix}/+/status`;
            this.client.subscribe(sub, (err) => {
                if (err) console.error("[MQTT] subscribe error:", err);
                else console.log("[MQTT] subscribed:", sub);
            });
        });

        this.client.on("reconnect", () => console.log("[MQTT] reconnecting…"));
        this.client.on("error", (e) => console.error("[MQTT] error:", e));

        this.client.on("message", (topic, buf) => {
            try {
                const msg = buf.toString();
                const parts = topic.split("/"); // PREFIX/<deviceId>/status
                const deviceId = parts[2] || "unknown";
                let payload = msg;
                try { payload = JSON.parse(msg); } catch { }
                this.lastStatus.set(deviceId, { ts: Date.now(), payload });
            } catch (e) {
                console.error("[MQTT] message handler error:", e);
            }
        });

        return this.client;
    }

    _topicCmd(id) { return `${this.prefix}/${id}/cmd`; }

    publishCmd(deviceId, payload) {
        if (!this.client || !this.client.connected) throw new Error("mqtt_not_connected");
        const topic = this._topicCmd(deviceId);
        const body = (typeof payload === "string") ? payload : JSON.stringify(payload);
        this.client.publish(topic, body, { qos: 0, retain: false });
        return { topic, body };
    }

    // High-level commands
    capture(deviceId) { return this.publishCmd(deviceId, "capture"); }
    setAutoConfig(deviceId, enabled, seconds) {
        const payload = { auto: !!enabled };
        if (typeof seconds === "number") payload.intervalSec = Number(seconds);
        return this.publishCmd(deviceId, payload);
    }

    getStatus(deviceId) { return this.lastStatus.get(deviceId) || null; }
}

// Singleton instance
const mqttInstance = new MqttService();

module.exports = mqttInstance;
