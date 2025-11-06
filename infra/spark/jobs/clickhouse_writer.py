"""
ClickHouse writer module for Spark Structured Streaming
"""
from pyspark.sql import DataFrame
from config import (
    CLICKHOUSE_URL,
    CLICKHOUSE_USER,
    CLICKHOUSE_PASSWORD,
    CLICKHOUSE_DRIVER,
    BATCH_SIZE,
    WRITE_RAW_EVENTS,
    WRITE_HOURLY_AGG,
    WRITE_DAILY_AGG,
    WRITE_EVENTS_AGG,
)


def write_raw_events(batch_df: DataFrame, batch_id: int) -> bool:
    """
    Write raw events to ClickHouse events_raw table
    
    Args:
        batch_df: Batch DataFrame with event data
        batch_id: Batch ID
        
    Returns:
        bool: True if successful
    """
    if not WRITE_RAW_EVENTS:
        return True
    
    try:
        # Select only columns that exist in ClickHouse table
        raw_data = batch_df.select(
            "device_id",
            "timestamp",
            "shot_id",
            "image_url",
            "image_size",
            "image_md5",
            "mime_type",
            "firmware_version",
            "ip_address",
            "extra",
            "received_at"
        )
        
        (
            raw_data.write
            .format("jdbc")
            .option("url", CLICKHOUSE_URL)
            .option("dbtable", "iot.events_raw")
            .option("user", CLICKHOUSE_USER)
            .option("password", CLICKHOUSE_PASSWORD)
            .option("driver", CLICKHOUSE_DRIVER)
            .option("batchsize", BATCH_SIZE)
            .option("isolationLevel", "NONE")
            .mode("append")
            .save()
        )
        print(f"✅ Batch {batch_id}: Wrote {raw_data.count()} raw events to ClickHouse")
        return True
    except Exception as e:
        print(f"❌ Batch {batch_id}: Error writing raw events: {str(e)}")
        return False


def write_hourly_aggregations(batch_df: DataFrame, batch_id: int) -> bool:
    """
    Write hourly aggregations to ClickHouse events_hourly table
    
    Args:
        batch_df: Batch DataFrame with hourly aggregation data
        batch_id: Batch ID
        
    Returns:
        bool: True if successful
    """
    if not WRITE_HOURLY_AGG:
        return True
    
    try:
        # Select columns matching ClickHouse schema
        hourly_data = batch_df.select(
            "device_id",
            "hour",
            "image_count",
            "total_size",
            "avg_size",
            "unique_shots",
            "processing_date"
        )
        
        (
            hourly_data.write
            .format("jdbc")
            .option("url", CLICKHOUSE_URL)
            .option("dbtable", "iot.events_hourly")
            .option("user", CLICKHOUSE_USER)
            .option("password", CLICKHOUSE_PASSWORD)
            .option("driver", CLICKHOUSE_DRIVER)
            .option("batchsize", BATCH_SIZE)
            .option("isolationLevel", "NONE")
            .mode("append")
            .save()
        )
        print(f"✅ Batch {batch_id}: Wrote hourly aggregations to ClickHouse")
        return True
    except Exception as e:
        print(f"❌ Batch {batch_id}: Error writing hourly aggregations: {str(e)}")
        return False


def write_daily_aggregations(batch_df: DataFrame, batch_id: int) -> bool:
    """
    Write daily aggregations to ClickHouse device_stats_daily table
    
    Args:
        batch_df: Batch DataFrame with daily aggregation data
        batch_id: Batch ID
        
    Returns:
        bool: True if successful
    """
    if not WRITE_DAILY_AGG:
        return True
    
    try:
        # Select columns matching ClickHouse schema
        daily_data = batch_df.select(
            "device_id",
            "date",
            "total_images",
            "total_size_mb",
            "first_seen",
            "last_seen",
            "avg_interval_seconds"
        )
        
        (
            daily_data.write
            .format("jdbc")
            .option("url", CLICKHOUSE_URL)
            .option("dbtable", "iot.device_stats_daily")
            .option("user", CLICKHOUSE_USER)
            .option("password", CLICKHOUSE_PASSWORD)
            .option("driver", CLICKHOUSE_DRIVER)
            .option("batchsize", BATCH_SIZE)
            .option("isolationLevel", "NONE")
            .mode("append")
            .save()
        )
        print(f"✅ Batch {batch_id}: Wrote daily aggregations to ClickHouse")
        return True
    except Exception as e:
        print(f"❌ Batch {batch_id}: Error writing daily aggregations: {str(e)}")
        return False


def write_events_agg(batch_df: DataFrame, batch_id: int) -> bool:
    """
    Write aggregations to ClickHouse events_agg table
    
    Args:
        batch_df: Batch DataFrame with aggregation data
        batch_id: Batch ID
        
    Returns:
        bool: True if successful
    """
    if not WRITE_EVENTS_AGG:
        return True
    
    try:
        # Select columns matching ClickHouse schema
        agg_data = batch_df.select(
            "device_id",
            "aggregation_window",
            "window_type",
            "image_count",
            "total_size_bytes",
            "avg_size_bytes",
            "unique_shots",
            "processing_date"
        )
        
        (
            agg_data.write
            .format("jdbc")
            .option("url", CLICKHOUSE_URL)
            .option("dbtable", "iot.events_agg")
            .option("user", CLICKHOUSE_USER)
            .option("password", CLICKHOUSE_PASSWORD)
            .option("driver", CLICKHOUSE_DRIVER)
            .option("batchsize", BATCH_SIZE)
            .option("isolationLevel", "NONE")
            .mode("append")
            .save()
        )
        print(f"✅ Batch {batch_id}: Wrote events_agg to ClickHouse")
        return True
    except Exception as e:
        print(f"❌ Batch {batch_id}: Error writing events_agg: {str(e)}")
        return False


def write_batch_to_clickhouse(
    raw_events_df: DataFrame,
    hourly_agg_df: DataFrame = None,
    daily_agg_df: DataFrame = None,
    events_agg_df: DataFrame = None,
    batch_id: int = 0
) -> dict:
    """
    Write all data to ClickHouse tables
    
    Args:
        raw_events_df: Raw events DataFrame
        hourly_agg_df: Optional hourly aggregations DataFrame
        daily_agg_df: Optional daily aggregations DataFrame
        events_agg_df: Optional events_agg DataFrame
        batch_id: Batch ID
        
    Returns:
        dict: Results of write operations
    """
    results = {
        "raw_events": write_raw_events(raw_events_df, batch_id),
        "hourly_agg": True,
        "daily_agg": True,
        "events_agg": True,
    }
    
    # Write aggregations if provided
    if hourly_agg_df is not None:
        results["hourly_agg"] = write_hourly_aggregations(hourly_agg_df, batch_id)
    
    if daily_agg_df is not None:
        results["daily_agg"] = write_daily_aggregations(daily_agg_df, batch_id)
    
    if events_agg_df is not None:
        results["events_agg"] = write_events_agg(events_agg_df, batch_id)
    
    return results


