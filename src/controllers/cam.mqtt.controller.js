const mqtt = require("../services/mqtt.service");
const fs = require("fs/promises");
const path = require("path");
const cfg = require("../config");

// Get all devices
async function getDevices(req, res, next) {
    try {
        const devices = await getAllDevices();
        res.json({ ok: true, devices });
    } catch (e) {
        next(e);
    }
}

// Capture photo
async function capture(req, res, next) {
    try {
        const { id } = req.params;
        const sent = mqtt.capture(id);
        res.json({ ok: true, sent });
    } catch (e) {
        next(e);
    }
}

// Configure auto capture
async function autoConfig(req, res, next) {
    try {
        const { id } = req.params;
        const { enabled, seconds } = req.body; // enabled: boolean, seconds: optional number
        const sent = mqtt.setAutoConfig(id, enabled, seconds);
        res.json({ ok: true, sent });
    } catch (e) {
        next(e);
    }
}

// Get device status
async function status(req, res, next) {
    try {
        const { id } = req.params;
        const devices = await getAllDevices();
        const device = devices.find(d => d.id === id);

        if (!device) {
            return res.status(404).json({ ok: false, error: "Device not found" });
        }

        res.json({ ok: true, deviceId: id, status: device.status, lastUpdate: device.lastUpdate });
    } catch (e) {
        next(e);
    }
}

// Helper function to get all devices
async function getAllDevices() {
    const devices = [];
    const uploadDir = cfg.uploadDir;

    try {
        const deviceDirs = await fs.readdir(uploadDir, { withFileTypes: true });

        for (const deviceDir of deviceDirs) {
            if (!deviceDir.isDirectory()) continue;

            const deviceId = deviceDir.name;
            
            // Lọc bỏ các device test (cam-test, cam-test-fixed, hoặc bất kỳ device nào chứa "test")
            if (deviceId.toLowerCase().includes('test')) {
                continue;
            }
            
            const devicePath = path.join(uploadDir, deviceId);

            // Get last image timestamp for this device
            let lastUpdate = null;
            let imageCount = 0;

            try {
                // Get all year directories
                const yearDirs = await fs.readdir(devicePath, { withFileTypes: true });

                for (const yearDir of yearDirs) {
                    if (!yearDir.isDirectory()) continue;

                    const yearPath = path.join(devicePath, yearDir.name);
                    const monthDirs = await fs.readdir(yearPath, { withFileTypes: true });

                    for (const monthDir of monthDirs) {
                        if (!monthDir.isDirectory()) continue;

                        const monthPath = path.join(yearPath, monthDir.name);
                        const dayDirs = await fs.readdir(monthPath, { withFileTypes: true });

                        for (const dayDir of dayDirs) {
                            if (!dayDir.isDirectory()) continue;

                            const dayPath = path.join(monthPath, dayDir.name);
                            const files = await fs.readdir(dayPath);

                            for (const file of files) {
                                if (file.endsWith('.jpg') || file.endsWith('.jpeg')) {
                                    imageCount++;
                                    const filePath = path.join(dayPath, file);
                                    const stats = await fs.stat(filePath);

                                    if (!lastUpdate || stats.mtime > lastUpdate) {
                                        lastUpdate = stats.mtime;
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn(`Error reading device directory ${deviceId}:`, err);
            }

            // Determine device status based on last update
            let status = 'offline';
            if (lastUpdate) {
                const timeDiff = Date.now() - new Date(lastUpdate).getTime();
                if (timeDiff < 5 * 60 * 1000) { // 5 minutes
                    status = 'online';
                } else if (timeDiff < 30 * 60 * 1000) { // 30 minutes
                    status = 'warning';
                }
            }

            devices.push({
                id: deviceId,
                status,
                lastUpdate,
                imageCount,
                autoEnabled: false, // Mock data - can be stored in config file
                intervalSeconds: 30 // Mock data
            });
        }

        return devices.sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
        console.error('Error reading devices directory:', error);
        return [];
    }
}

// Delete device
async function deleteDevice(req, res, next) {
    try {
        const { id } = req.params;
        const devicePath = path.join(cfg.uploadDir, id);

        // Check if device directory exists
        try {
            await fs.access(devicePath);
        } catch (err) {
            return res.status(404).json({ ok: false, error: "Device not found" });
        }

        // Delete device directory recursively
        await fs.rm(devicePath, { recursive: true, force: true });

        res.json({ ok: true, message: `Device ${id} deleted successfully` });
    } catch (e) {
        next(e);
    }
}

module.exports = { getDevices, capture, autoConfig, status, deleteDevice };
