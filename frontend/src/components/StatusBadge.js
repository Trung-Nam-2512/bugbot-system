import React from 'react';
import { Tag } from 'antd';
import './StatusBadge.css';

const STATUS_MAP = {
    online:  { color: 'success', text: 'Online',  dotClass: 'status-dot--online' },
    offline: { color: 'error',   text: 'Offline',  dotClass: 'status-dot--offline' },
    stale:   { color: 'warning', text: 'Stale',    dotClass: 'status-dot--stale' },
    unknown: { color: 'default', text: 'Unknown',  dotClass: 'status-dot--unknown' },
};

function resolveStatus(device) {
    if (!device) return 'unknown';
    if (device.stale) return 'stale';
    if (device.online) return 'online';
    if (device.online === false) return 'offline';
    return 'unknown';
}

const StatusBadge = ({ device, status: explicitStatus, showDot = true }) => {
    const key = explicitStatus || resolveStatus(device);
    const info = STATUS_MAP[key] || STATUS_MAP.unknown;

    return (
        <Tag color={info.color} className="status-badge">
            {showDot && <span className={`status-dot ${info.dotClass}`} />}
            {info.text}
        </Tag>
    );
};

export { resolveStatus };
export default StatusBadge;
