const getApiBaseUrl = () => {
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }
    if (typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return 'http://localhost:1435/api';
    }
    return '/api';
};

export const API_CONFIG = {
    BASE_URL: getApiBaseUrl(),
    TIMEOUT: 10000,
};

export const POLLING_CONFIG = {
    DASHBOARD_INTERVAL: 10000,  // 10s – device cards + stats
    GALLERY_INTERVAL: 60000,    // 60s – image gallery
    DEVICES_INTERVAL: 10000,    // 10s – device table
    EVENTS_INTERVAL: 3000,      // 3s  – event feed
    DETAIL_INTERVAL: 5000,      // 5s  – device detail page
};

export const PAGINATION_CONFIG = {
    DEFAULT_PAGE_SIZE: 12,
    PAGE_SIZE_OPTIONS: ['6', '12', '24', '48'],
    SHOW_SIZE_CHANGER: true,
    SHOW_QUICK_JUMPER: true,
};

export const IMAGE_CONFIG = {
    MAX_FILE_SIZE: 8 * 1024 * 1024,
    ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png'],
    THUMBNAIL_HEIGHT: 200,
    PREVIEW_MAX_HEIGHT: '80vh',
};

export const DEVICE_CONFIG = {
    AUTO_CAPTURE_MIN_INTERVAL: 3,
    AUTO_CAPTURE_MAX_INTERVAL: 3600,
    DEFAULT_INTERVAL: 30,
};

export const UI_CONFIG = {
    ANIMATION_DURATION: 300,
    NOTIFICATION_DURATION: 4.5,
    DEBOUNCE_DELAY: 500,
};
