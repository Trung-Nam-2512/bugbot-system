-- ClickHouse initialization script
-- Database for IoT analytics

-- Create events_raw table for raw image metadata
CREATE TABLE IF NOT EXISTS iot.events_raw (
    event_id UUID DEFAULT generateUUIDv4(),
    device_id String,
    timestamp DateTime64(3, 'UTC'),
    shot_id String,
    image_url String,
    image_size UInt64,
    image_md5 String,
    mime_type String DEFAULT 'image/jpeg',
    firmware_version String,
    ip_address String,
    extra String,  -- JSON string for flexible metadata
    received_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
    processing_date Date DEFAULT toDate(received_at)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(processing_date)
ORDER BY (device_id, timestamp)
TTL processing_date + INTERVAL 90 DAY  -- Keep data for 90 days
SETTINGS index_granularity = 8192;

-- Create materialized view for hourly aggregations
CREATE TABLE IF NOT EXISTS iot.events_hourly (
    device_id String,
    hour DateTime,
    image_count UInt64,
    total_size UInt64,
    avg_size Float64,
    unique_shots UInt64,
    processing_date Date
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(processing_date)
ORDER BY (device_id, hour)
TTL processing_date + INTERVAL 180 DAY;  -- Keep aggregated data longer

-- Create materialized view to populate hourly aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS iot.events_hourly_mv
TO iot.events_hourly
AS SELECT
    device_id,
    toStartOfHour(timestamp) as hour,
    count() as image_count,
    sum(image_size) as total_size,
    avg(image_size) as avg_size,
    uniq(shot_id) as unique_shots,
    toDate(hour) as processing_date
FROM iot.events_raw
GROUP BY device_id, hour;

-- Create daily statistics table
CREATE TABLE IF NOT EXISTS iot.device_stats_daily (
    device_id String,
    date Date,
    total_images UInt64,
    total_size_mb Float64,
    first_seen DateTime,
    last_seen DateTime,
    avg_interval_seconds Float64
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (device_id, date);

-- Create materialized view for daily stats
CREATE MATERIALIZED VIEW IF NOT EXISTS iot.device_stats_daily_mv
TO iot.device_stats_daily
AS SELECT
    device_id,
    toDate(timestamp) as date,
    count() as total_images,
    sum(image_size) / 1024 / 1024 as total_size_mb,
    min(timestamp) as first_seen,
    max(timestamp) as last_seen,
    if(count() > 1, 
       dateDiff('second', min(timestamp), max(timestamp)) / (count() - 1), 
       0) as avg_interval_seconds
FROM iot.events_raw
GROUP BY device_id, date;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_device_timestamp 
ON iot.events_raw (device_id, timestamp) TYPE minmax GRANULARITY 4;

CREATE INDEX IF NOT EXISTS idx_shot_id 
ON iot.events_raw (shot_id) TYPE bloom_filter(0.01) GRANULARITY 1;

-- Create events_agg table for general aggregations
-- This table can store various aggregation types with flexible window types
CREATE TABLE IF NOT EXISTS iot.events_agg (
    device_id String,
    aggregation_window DateTime,  -- hour or day
    window_type String,            -- 'hourly' or 'daily'
    image_count UInt64,
    total_size_bytes UInt64,
    avg_size_bytes Float64,
    unique_shots UInt64,
    processing_date Date
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(processing_date)
ORDER BY (device_id, aggregation_window, window_type)
TTL processing_date + INTERVAL 180 DAY;  -- Keep aggregated data longer

-- Create materialized view for events_agg (can be populated by Spark or ClickHouse)
-- Note: This MV can be optional if Spark writes directly to events_agg
-- Uncomment if you want ClickHouse to auto-populate from events_raw
-- CREATE MATERIALIZED VIEW IF NOT EXISTS iot.events_agg_mv
-- TO iot.events_agg
-- AS SELECT
--     device_id,
--     toStartOfHour(timestamp) as aggregation_window,
--     'hourly' as window_type,
--     count() as image_count,
--     sum(image_size) as total_size_bytes,
--     avg(image_size) as avg_size_bytes,
--     uniq(shot_id) as unique_shots,
--     toDate(aggregation_window) as processing_date
-- FROM iot.events_raw
-- GROUP BY device_id, aggregation_window;

