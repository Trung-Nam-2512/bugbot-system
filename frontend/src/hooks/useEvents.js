import { useState, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import usePolling from './usePolling';

const EVENTS_POLL_INTERVAL = 3000; // 3 seconds

/**
 * Hook to fetch and auto-poll event stream.
 * Uses `since` parameter to only fetch new events each poll.
 */
const useEvents = (deviceId = null, autoRefresh = true) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const lastServerTime = useRef(null);

    const fetchEvents = useCallback(async () => {
        try {
            const params = { limit: 50 };
            if (lastServerTime.current) params.since = lastServerTime.current;
            if (deviceId) params.deviceId = deviceId;

            const response = await apiService.getEvents(params);
            const data = response.data;

            if (data.serverTime) {
                lastServerTime.current = data.serverTime;
            }

            if (data.events && data.events.length > 0) {
                setEvents((prev) => {
                    const merged = [...data.events, ...prev];
                    const seen = new Set();
                    return merged.filter((e) => {
                        if (seen.has(e.id)) return false;
                        seen.add(e.id);
                        return true;
                    }).slice(0, 100);
                });
            }
        } catch {
            // silent fail for polling
        } finally {
            setLoading(false);
        }
    }, [deviceId]);

    usePolling(fetchEvents, EVENTS_POLL_INTERVAL, autoRefresh, { immediate: true });

    const clearEvents = useCallback(() => {
        setEvents([]);
        lastServerTime.current = null;
    }, []);

    return { events, loading, clearEvents };
};

export default useEvents;
