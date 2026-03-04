import { useEffect, useRef, useCallback } from 'react';

/**
 * Polling hook with visibility API pause.
 * Automatically pauses when the browser tab is not visible.
 *
 * @param {Function} callback - async function to call each interval
 * @param {number}   delay    - interval in ms (null to disable)
 * @param {boolean}  enabled  - enable/disable polling
 * @param {object}   options  - { immediate: bool } call immediately on mount
 */
const usePolling = (callback, delay = 30000, enabled = true, options = {}) => {
    const { immediate = false } = options;
    const savedCallback = useRef();
    const intervalRef = useRef();
    const visibleRef = useRef(true);

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    const startInterval = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (!enabled || delay === null) return;

        intervalRef.current = setInterval(() => {
            if (visibleRef.current && savedCallback.current) {
                savedCallback.current();
            }
        }, delay);
    }, [delay, enabled]);

    // Visibility change: pause/resume
    useEffect(() => {
        const handleVisibility = () => {
            visibleRef.current = !document.hidden;
            if (!document.hidden && savedCallback.current && enabled) {
                savedCallback.current();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [enabled]);

    // Start / restart interval when delay or enabled changes
    useEffect(() => {
        startInterval();
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [startInterval]);

    // Immediate first call
    useEffect(() => {
        if (immediate && enabled && savedCallback.current) {
            savedCallback.current();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return intervalRef.current;
};

export default usePolling;
