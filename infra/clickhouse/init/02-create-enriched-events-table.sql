-- ClickHouse table for enriched events from AI Inference Service
-- Created for Phase 3: Dashboard & Alert System

-- Create events_enriched table for AI detection data
CREATE TABLE IF NOT EXISTS iot.events_enriched (
    device_id String,
    timestamp DateTime64(3, 'UTC'),
    shot_id String,
    image_url String,
    annotated_image_url String,
    detection_count UInt32 DEFAULT 0,
    detections String,  -- JSON array of detections
    processing_time_ms UInt32,
    processed_at DateTime64(3, 'UTC'),
    inference_model String DEFAULT 'yolov8n',
    inference_version String DEFAULT '1.0.0',
    received_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
    processing_date Date DEFAULT toDate(processed_at)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(processing_date)
ORDER BY (device_id, timestamp)
TTL processing_date + INTERVAL 180 DAY  -- Keep enriched data for 180 days
SETTINGS index_granularity = 8192;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_enriched_device_timestamp 
ON iot.events_enriched (device_id, timestamp) TYPE minmax GRANULARITY 4;

CREATE INDEX IF NOT EXISTS idx_enriched_shot_id 
ON iot.events_enriched (shot_id) TYPE bloom_filter(0.01) GRANULARITY 1;

-- Create materialized view for detection statistics (hourly)
CREATE TABLE IF NOT EXISTS iot.detections_hourly (
    device_id String,
    hour DateTime,
    event_count UInt64,  -- Renamed from detection_count to avoid confusion
    total_detections UInt64,
    avg_detections_per_image Float64,
    unique_species Array(String),
    processing_date Date
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(processing_date)
ORDER BY (device_id, hour)
TTL processing_date + INTERVAL 180 DAY;

-- Create materialized view to populate hourly detection stats
CREATE MATERIALIZED VIEW IF NOT EXISTS iot.detections_hourly_mv
TO iot.detections_hourly
AS SELECT
    device_id,
    toStartOfHour(timestamp) as hour,
    count() as event_count,
    sum(detection_count) as total_detections,
    avg(detection_count) as avg_detections_per_image,
    arrayDistinct(groupArrayArray(
        JSONExtractArrayRaw(detections, '$[*].class')
    )) as unique_species,
    toDate(toStartOfHour(timestamp)) as processing_date
FROM iot.events_enriched
WHERE detection_count > 0  -- Filter by column from table
GROUP BY device_id, hour;

-- Create materialized view for species distribution (daily)
CREATE TABLE IF NOT EXISTS iot.species_distribution_daily (
    device_id String,
    date Date,
    species String,
    detection_count UInt64,
    avg_confidence Float64,
    min_confidence Float64,
    max_confidence Float64
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (device_id, date, species)
TTL date + INTERVAL 180 DAY;

-- Note: Species distribution will be populated by application logic
-- since we need to parse JSON detections array


