-- ClickHouse Alert History Table
-- Stores alert history for analytics and reporting

-- Create alerts table for alert history
CREATE TABLE IF NOT EXISTS iot.alerts (
    alert_id String,
    rule_id String,
    rule_name String,
    device_id String,
    severity String,  -- 'info', 'warning', 'critical'
    message String,
    triggered_at DateTime64(3, 'UTC'),
    acknowledged_at DateTime64(3, 'UTC'),
    acknowledged_by String,
    resolved_at DateTime64(3, 'UTC'),
    resolved_by String,
    status String,  -- 'active', 'acknowledged', 'resolved'
    metadata String,  -- JSON string
    created_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
    processing_date Date DEFAULT toDate(triggered_at)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(processing_date)
ORDER BY (triggered_at, device_id, severity)
TTL processing_date + INTERVAL 180 DAY  -- Keep alert history for 180 days
SETTINGS index_granularity = 8192;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_alerts_status 
ON iot.alerts (status) TYPE set(0) GRANULARITY 4;

CREATE INDEX IF NOT EXISTS idx_alerts_severity 
ON iot.alerts (severity) TYPE set(0) GRANULARITY 4;

CREATE INDEX IF NOT EXISTS idx_alerts_device 
ON iot.alerts (device_id) TYPE minmax GRANULARITY 4;

-- Create materialized view for alert statistics (hourly)
CREATE TABLE IF NOT EXISTS iot.alerts_hourly (
    device_id String,
    severity String,
    hour DateTime,
    alert_count UInt64,
    processing_date Date
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(processing_date)
ORDER BY (device_id, severity, hour)
TTL processing_date + INTERVAL 180 DAY;

-- Create materialized view to populate hourly alert stats
CREATE MATERIALIZED VIEW IF NOT EXISTS iot.alerts_hourly_mv
TO iot.alerts_hourly
AS SELECT
    device_id,
    severity,
    toStartOfHour(triggered_at) as hour,
    count() as alert_count,
    toDate(hour) as processing_date
FROM iot.alerts
WHERE status = 'active'  -- Only count active alerts
GROUP BY device_id, severity, hour;

-- Create daily alert summary table
CREATE TABLE IF NOT EXISTS iot.alerts_daily (
    device_id String,
    date Date,
    total_alerts UInt64,
    critical_count UInt64,
    warning_count UInt64,
    info_count UInt64,
    active_count UInt64,
    resolved_count UInt64
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (device_id, date)
TTL date + INTERVAL 180 DAY;

-- Note: Daily summary will be populated by application logic
-- since we need to aggregate by status and severity


