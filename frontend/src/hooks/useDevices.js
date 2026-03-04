import { useState, useCallback } from 'react';
import { apiService } from '../services/api';
import { handleApiError } from '../utils/errorHandler';
import usePolling from './usePolling';
import { POLLING_CONFIG } from '../utils/constants';

/**
 * Hook to fetch and auto-poll device list from registry.
 */
const useDevices = (autoRefresh = true) => {
    const [devices, setDevices] = useState([]);
    const [counts, setCounts] = useState({ total: 0, online: 0, offline: 0, stale: 0 });
    const [loading, setLoading] = useState(true);

    const fetchDevices = useCallback(async () => {
        try {
            const response = await apiService.getDevices();
            const data = response.data;
            setDevices(data.devices || []);
            setCounts({
                total: data.total || 0,
                online: data.online || 0,
                offline: data.offline || 0,
                stale: data.stale || 0,
            });
        } catch (error) {
            handleApiError(error, { defaultMessage: 'Khong the tai danh sach thiet bi', showNotification: false });
        } finally {
            setLoading(false);
        }
    }, []);

    usePolling(fetchDevices, POLLING_CONFIG.DEVICES_INTERVAL, autoRefresh, { immediate: true });

    return { devices, counts, loading, refresh: fetchDevices };
};

export default useDevices;
