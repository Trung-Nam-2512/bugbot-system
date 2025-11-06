const os = require("os");

/**
 * Lấy địa chỉ IP của server
 * @returns {string} IP address của server
 */
function getServerIP() {
    const interfaces = os.networkInterfaces();

    // Ưu tiên các interface có IP v4 và không phải loopback
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Bỏ qua loopback và internal interfaces
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }

    // Nếu không tìm thấy, trả về localhost
    return 'localhost';
}

/**
 * Lấy tất cả IP addresses có sẵn
 * @returns {Array} Danh sách các IP addresses
 */
function getAllIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push({
                    interface: name,
                    address: iface.address,
                    family: iface.family
                });
            }
        }
    }

    return ips;
}

module.exports = {
    getServerIP,
    getAllIPs
};
