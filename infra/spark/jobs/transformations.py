"""
Data transformations for IoT events
"""
from pyspark.sql import DataFrame
from pyspark.sql.functions import (
    from_json, col, to_timestamp, window, 
    to_date, hour, minute, second
)
from pyspark.sql.types import (
    StructType, StructField, StringType, LongType, TimestampType
)

# Define schema for events.raw topic
EVENT_SCHEMA = StructType([
    StructField("device_id", StringType(), False),
    StructField("timestamp", StringType(), False),
    StructField("shot_id", StringType(), True),
    StructField("image_url", StringType(), False),
    StructField("image_size", LongType(), False),
    StructField("image_md5", StringType(), False),
    StructField("mime_type", StringType(), True),
    StructField("firmware_version", StringType(), True),
    StructField("ip_address", StringType(), True),
    StructField("extra", StringType(), True),
    StructField("received_at", StringType(), True),
])


def transform_events(kafka_df: DataFrame) -> DataFrame:
    """
    Transform Kafka raw data to structured events
    
    Args:
        kafka_df: Raw Kafka DataFrame
        
    Returns:
        DataFrame: Transformed events DataFrame
    """
    # Parse JSON value from Kafka
    parsed_df = kafka_df.select(
        from_json(col("value").cast("string"), EVENT_SCHEMA).alias("data"),
        col("timestamp").alias("kafka_timestamp"),
        col("partition"),
        col("offset")
    )
    
    # Extract fields and convert timestamps
    transformed_df = parsed_df.select(
        col("data.device_id"),
        to_timestamp(col("data.timestamp")).alias("timestamp"),
        col("data.shot_id"),
        col("data.image_url"),
        col("data.image_size"),
        col("data.image_md5"),
        col("data.mime_type"),
        col("data.firmware_version"),
        col("data.ip_address"),
        col("data.extra"),
        to_timestamp(col("data.received_at")).alias("received_at"),
        col("kafka_timestamp"),
        col("partition"),
        col("offset")
    ).filter(
        col("data.device_id").isNotNull() & 
        col("timestamp").isNotNull()
    )  # Filter out invalid records
    
    return transformed_df


def add_aggregation_columns(df: DataFrame) -> DataFrame:
    """
    Add columns useful for aggregations (hour, date, etc.)
    
    Args:
        df: Events DataFrame
        
    Returns:
        DataFrame: DataFrame with additional aggregation columns
    """
    return df.withColumn(
        "processing_date", to_date(col("timestamp"))
    )


