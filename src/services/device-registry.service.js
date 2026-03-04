const { logger } = require("../libs/logger");
const { getCollection } = require("../libs/mongodb");

const COLLECTION = "devices";
const STALE_TIMEOUT_MS = 60 * 1000; // 60 seconds without message → stale

class DeviceRegistryService {
    constructor() {
        this.devices = new Map(); // deviceId → device doc
    }

    // ── Lifecycle ───────────────────────────────────────────────────

    async init() {
        try {
            const col = getCollection(COLLECTION);
            await col.createIndex({ deviceId: 1 }, { unique: true });

            const docs = await col.find({}).toArray();
            for (const doc of docs) {
                this.devices.set(doc.deviceId, this._normalize(doc));
            }
            logger.info({ count: this.devices.size }, "[DeviceRegistry] loaded from MongoDB");
        } catch (err) {
            logger.warn({ err: err.message }, "[DeviceRegistry] init failed, starting empty");
        }
    }

    // ── Read ────────────────────────────────────────────────────────

    getDevice(deviceId) {
        return this.devices.get(deviceId) || null;
    }

    getAllDevices() {
        return Array.from(this.devices.values()).sort((a, b) =>
            a.deviceId.localeCompare(b.deviceId)
        );
    }

    getOnlineDevices() {
        return this.getAllDevices().filter((d) => d.online);
    }

    getDeviceCount() {
        const all = this.devices.size;
        let online = 0;
        let stale = 0;
        for (const d of this.devices.values()) {
            if (d.online) online++;
            if (d.stale) stale++;
        }
        return { total: all, online, offline: all - online, stale };
    }

    // ── Write ───────────────────────────────────────────────────────

    async setOnline(deviceId, payload = {}) {
        const now = new Date();
        const existing = this.devices.get(deviceId);

        const device = {
            deviceId,
            online: true,
            stale: false,
            firmware: payload.fw || existing?.firmware || null,
            ip: payload.ip || existing?.ip || null,
            ssid: payload.ssid || existing?.ssid || null,
            heap: payload.heap ?? existing?.heap ?? null,
            autoMode: payload.auto ?? existing?.autoMode ?? false,
            intervalSec: payload.intervalSec ?? existing?.intervalSec ?? 30,
            uptime: payload.uptime ?? existing?.uptime ?? 0,
            lastSeenAt: now,
            onlineSince: existing?.online ? (existing.onlineSince || now) : now,
            firstSeenAt: existing?.firstSeenAt || now,
            imageCount: existing?.imageCount || 0,
            lastOnlinePayload: payload,
        };

        this.devices.set(deviceId, device);
        await this._persist(deviceId, device);
        return device;
    }

    async setOffline(deviceId) {
        const existing = this.devices.get(deviceId);
        if (!existing) return null;

        existing.online = false;
        existing.stale = false;
        existing.lastSeenAt = new Date();
        existing.onlineSince = null;

        this.devices.set(deviceId, existing);
        await this._persist(deviceId, existing);
        return existing;
    }

    async updateLastSeen(deviceId) {
        const existing = this.devices.get(deviceId);
        if (!existing) return;
        existing.lastSeenAt = new Date();
        existing.stale = false;
        this.devices.set(deviceId, existing);
    }

    async incrementImageCount(deviceId) {
        const existing = this.devices.get(deviceId);
        if (!existing) return;
        existing.imageCount = (existing.imageCount || 0) + 1;
        this.devices.set(deviceId, existing);
        await this._persist(deviceId, existing);
    }

    async deleteDevice(deviceId) {
        this.devices.delete(deviceId);
        try {
            const col = getCollection(COLLECTION);
            await col.deleteOne({ deviceId });
            logger.info({ deviceId }, "[DeviceRegistry] deleted");
        } catch (err) {
            logger.error({ err: err.message, deviceId }, "[DeviceRegistry] delete failed");
        }
    }

    // ── Stale checker ───────────────────────────────────────────────

    markStaleDevices(timeoutMs = STALE_TIMEOUT_MS) {
        const now = Date.now();
        let marked = 0;
        for (const [, device] of this.devices) {
            if (!device.online) continue;
            const lastSeen = device.lastSeenAt ? device.lastSeenAt.getTime() : 0;
            if (now - lastSeen > timeoutMs) {
                device.stale = true;
                marked++;
            }
        }
        if (marked > 0) {
            logger.debug({ marked }, "[DeviceRegistry] devices marked stale");
        }
        return marked;
    }

    // ── Internal ────────────────────────────────────────────────────

    _normalize(doc) {
        return {
            deviceId: doc.deviceId,
            online: doc.online || false,
            stale: doc.stale || false,
            firmware: doc.firmware || null,
            ip: doc.ip || null,
            ssid: doc.ssid || null,
            heap: doc.heap ?? null,
            autoMode: doc.autoMode ?? false,
            intervalSec: doc.intervalSec ?? 30,
            uptime: doc.uptime ?? 0,
            lastSeenAt: doc.lastSeenAt ? new Date(doc.lastSeenAt) : null,
            onlineSince: doc.onlineSince ? new Date(doc.onlineSince) : null,
            firstSeenAt: doc.firstSeenAt ? new Date(doc.firstSeenAt) : null,
            imageCount: doc.imageCount || 0,
            lastOnlinePayload: doc.lastOnlinePayload || null,
        };
    }

    async _persist(deviceId, device) {
        try {
            const col = getCollection(COLLECTION);
            const { ...doc } = device;
            doc.updatedAt = new Date();
            await col.updateOne(
                { deviceId },
                { $set: doc, $setOnInsert: { createdAt: new Date() } },
                { upsert: true }
            );
        } catch (err) {
            logger.error({ err: err.message, deviceId }, "[DeviceRegistry] persist failed");
        }
    }
}

const deviceRegistry = new DeviceRegistryService();

module.exports = deviceRegistry;
