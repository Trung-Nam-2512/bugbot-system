import { useState, useCallback } from 'react';
import { apiService } from '../services/api';
import { handleApiError } from '../utils/errorHandler';
import usePolling from './usePolling';

const DETAIL_POLL_INTERVAL = 5000; // 5 seconds for detail view

/**
 * Hook to fetch and auto-poll a single device's detail + events.
 */
const useDeviceDetail = (deviceId, autoRefresh = true) => {
    const [device, setDevice] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchDetail = useCallback(async () => {
        if (!deviceId) return;
        try {
            const response = await apiService.getDeviceDetail(deviceId);
            const data = response.data;
            setDevice(data.device || null);
            setEvents(data.events || []);
            setError(null);
        } catch (err) {
            const info = handleApiError(err, { showNotification: false });
            setError(info);
        } finally {
            setLoading(false);
        }
    }, [deviceId]);

    usePolling(fetchDetail, DETAIL_POLL_INTERVAL, autoRefresh && !!deviceId, { immediate: true });

    return { device, events, loading, error, refresh: fetchDetail };
};

export default useDeviceDetail;
