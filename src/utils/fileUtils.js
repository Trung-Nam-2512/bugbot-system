const fs = require("fs/promises");
const path = require("path");

// Get file extension
const getFileExtension = (filename) => {
    return path.extname(filename).toLowerCase();
};

// Check if file is image
const isImageFile = (filename) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.includes(getFileExtension(filename));
};

// Get file size in human readable format
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Ensure directory exists
const ensureDir = async (dirPath) => {
    try {
        await fs.access(dirPath);
    } catch (error) {
        await fs.mkdir(dirPath, { recursive: true });
    }
};

// Get file stats safely
const getFileStats = async (filePath) => {
    try {
        return await fs.stat(filePath);
    } catch (error) {
        return null;
    }
};

// Check if file exists
const fileExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch (error) {
        return false;
    }
};

// Generate unique filename
const generateUniqueFilename = (originalName, deviceId) => {
    const timestamp = new Date();
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    const hour = String(timestamp.getHours()).padStart(2, '0');
    const minute = String(timestamp.getMinutes()).padStart(2, '0');
    const second = String(timestamp.getSeconds()).padStart(2, '0');

    const dateStr = `${year}${month}${day}`;
    const timeStr = `${hour}${minute}${second}`;
    const ext = path.extname(originalName);

    return `${dateStr}_${timeStr}_${deviceId}${ext}`;
};

// Parse filename to extract metadata
const parseFilename = (filename) => {
    const parts = filename.split('_');
    if (parts.length >= 3) {
        const dateStr = parts[0];
        const timeStr = parts[1];
        const deviceId = parts[2].replace(path.extname(parts[2]), '');

        if (dateStr.length === 8 && timeStr.length === 6) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            const hour = timeStr.substring(0, 2);
            const minute = timeStr.substring(2, 4);
            const second = timeStr.substring(4, 6);

            return {
                deviceId,
                timestamp: new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`),
                year,
                month,
                day
            };
        }
    }

    return null;
};

module.exports = {
    getFileExtension,
    isImageFile,
    formatFileSize,
    ensureDir,
    getFileStats,
    fileExists,
    generateUniqueFilename,
    parseFilename
};
