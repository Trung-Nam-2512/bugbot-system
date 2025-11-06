"""
Aggregation functions for IoT events
"""
from pyspark.sql import DataFrame
from pyspark.sql.functions import (
    window, count, sum as spark_sum, avg, 
    min as spark_min, max as spark_max,
    to_date, dateDiff, when, col, toStartOfHour, toDate, lit
)


def calculate_hourly_aggregations(events_df: DataFrame) -> DataFrame:
    """
    Calculate hourly aggregations per device
    
    Args:
        events_df: Events DataFrame with timestamp column
        
    Returns:
        DataFrame: Hourly aggregations DataFrame
    """
    # Use watermark for late data handling
    events_with_watermark = events_df.withWatermark("timestamp", "1 hour")
    
    hourly_agg = events_with_watermark.groupBy(
        window("timestamp", "1 hour").alias("window"),
        "device_id"
    ).agg(
        count("*").alias("image_count"),
        spark_sum("image_size").alias("total_size_bytes"),
        avg("image_size").alias("avg_size_bytes"),
        spark_max("image_size").alias("max_size_bytes"),
        spark_min("image_size").alias("min_size_bytes"),
    ).select(
        col("device_id"),
        col("window.start").alias("aggregation_window"),
        lit("hourly").alias("window_type"),
        col("image_count"),
        col("total_size_bytes"),
        col("avg_size_bytes"),
        toDate(col("window.start")).alias("processing_date")
    )
    
    return hourly_agg


def calculate_daily_aggregations(events_df: DataFrame) -> DataFrame:
    """
    Calculate daily aggregations per device
    
    Args:
        events_df: Events DataFrame with timestamp column
        
    Returns:
        DataFrame: Daily aggregations DataFrame
    """
    # Use watermark for late data handling
    events_with_watermark = events_df.withWatermark("timestamp", "1 day")
    
    daily_agg = events_with_watermark.groupBy(
        to_date("timestamp").alias("date"),
        "device_id"
    ).agg(
        count("*").alias("total_images"),
        spark_sum("image_size").alias("total_size_bytes"),
        spark_min("timestamp").alias("first_seen"),
        spark_max("timestamp").alias("last_seen"),
    ).withColumn(
        "avg_interval_seconds",
        when(
            col("total_images") > 1,
            dateDiff("second", col("first_seen"), col("last_seen")) / (col("total_images") - 1)
        ).otherwise(0)
    ).select(
        col("device_id"),
        col("date"),
        col("total_images"),
        (col("total_size_bytes") / 1024 / 1024).alias("total_size_mb"),
        col("first_seen"),
        col("last_seen"),
        col("avg_interval_seconds")
    )
    
    return daily_agg


def prepare_events_agg(events_df: DataFrame, window_type: str = "hourly") -> DataFrame:
    """
    Prepare events_agg table data (flexible window type)
    
    Args:
        events_df: Events DataFrame
        window_type: 'hourly' or 'daily'
        
    Returns:
        DataFrame: Aggregated data for events_agg table
    """
    if window_type == "hourly":
        agg_df = events_df.withWatermark("timestamp", "1 hour").groupBy(
            toStartOfHour("timestamp").alias("aggregation_window"),
            "device_id"
        ).agg(
            count("*").alias("image_count"),
            spark_sum("image_size").alias("total_size_bytes"),
            avg("image_size").alias("avg_size_bytes"),
        )
    else:  # daily
        agg_df = events_df.withWatermark("timestamp", "1 day").groupBy(
            to_date("timestamp").alias("aggregation_window"),
            "device_id"
        ).agg(
            count("*").alias("image_count"),
            spark_sum("image_size").alias("total_size_bytes"),
            avg("image_size").alias("avg_size_bytes"),
        )
    
    # Add window_type and processing_date
    result = agg_df.select(
        col("device_id"),
        col("aggregation_window"),
        lit(window_type).alias("window_type"),
        col("image_count"),
        col("total_size_bytes"),
        col("avg_size_bytes"),
        toDate(col("aggregation_window")).alias("processing_date")
    )
    
    return result

