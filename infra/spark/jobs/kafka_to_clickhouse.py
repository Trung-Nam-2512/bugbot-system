"""
Spark Structured Streaming Job: Kafka to ClickHouse
Reads events from Kafka topic 'events.raw' and writes to ClickHouse

Prerequisites:
- spark-sql-kafka package
- clickhouse-jdbc driver

Run:
spark-submit --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0 \
  --jars /path/to/clickhouse-jdbc.jar \
  kafka_to_clickhouse.py
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    from_json, col, to_timestamp, current_timestamp
)
from pyspark.sql.types import (
    StructType, StructField, StringType, LongType, TimestampType
)
import os

# Configuration
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BROKERS", "localhost:19092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC_RAW", "events.raw")
CLICKHOUSE_URL = os.getenv("CLICKHOUSE_JDBC_URL", "jdbc:clickhouse://localhost:8123/iot")
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "default")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "clickhouse123")

# Define schema for events.raw
event_schema = StructType([
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


def create_spark_session():
    """Create Spark session with Kafka and ClickHouse support"""
    return (
        SparkSession.builder
        .appName("IoT-Kafka-to-ClickHouse")
        .config("spark.sql.streaming.checkpointLocation", "/tmp/spark-checkpoints")
        .config("spark.sql.adaptive.enabled", "true")
        .config("spark.sql.shuffle.partitions", "3")
        .getOrCreate()
    )


def read_from_kafka(spark):
    """Read streaming data from Kafka"""
    return (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP_SERVERS)
        .option("subscribe", KAFKA_TOPIC)
        .option("startingOffsets", "latest")  # or "earliest"
        .option("failOnDataLoss", "false")
        .option("kafka.consumer.group.id", "spark-iot-processor")
        .load()
    )


def transform_events(df):
    """Transform Kafka raw data to structured events"""
    # Parse JSON value from Kafka
    parsed_df = df.select(
        from_json(col("value").cast("string"), event_schema).alias("data"),
        col("timestamp").alias("kafka_timestamp"),
        col("partition"),
        col("offset")
    )
    
    # Extract fields
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
    )
    
    return transformed_df


def write_to_clickhouse(batch_df, batch_id):
    """Write batch to ClickHouse using JDBC"""
    try:
        (
            batch_df.write
            .format("jdbc")
            .option("url", CLICKHOUSE_URL)
            .option("dbtable", "iot.events_raw")
            .option("user", CLICKHOUSE_USER)
            .option("password", CLICKHOUSE_PASSWORD)
            .option("driver", "com.clickhouse.jdbc.ClickHouseDriver")
            .option("batchsize", "1000")
            .option("isolationLevel", "NONE")
            .mode("append")
            .save()
        )
        print(f"✅ Batch {batch_id} written to ClickHouse: {batch_df.count()} rows")
    except Exception as e:
        print(f"❌ Error writing batch {batch_id} to ClickHouse: {str(e)}")


def main():
    """Main streaming job"""
    print("🚀 Starting Spark Structured Streaming: Kafka → ClickHouse")
    
    # Create Spark session
    spark = create_spark_session()
    spark.sparkContext.setLogLevel("WARN")
    
    print(f"📡 Kafka brokers: {KAFKA_BOOTSTRAP_SERVERS}")
    print(f"📊 Kafka topic: {KAFKA_TOPIC}")
    print(f"🗄️  ClickHouse: {CLICKHOUSE_URL}")
    
    # Read from Kafka
    kafka_df = read_from_kafka(spark)
    
    # Transform events
    events_df = transform_events(kafka_df)
    
    # Write to ClickHouse using foreachBatch
    query = (
        events_df.writeStream
        .foreachBatch(write_to_clickhouse)
        .outputMode("append")
        .option("checkpointLocation", "/tmp/spark-checkpoints/kafka-to-clickhouse")
        .trigger(processingTime="10 seconds")  # Micro-batch every 10 seconds
        .start()
    )
    
    print("✨ Streaming query started. Press Ctrl+C to stop.")
    query.awaitTermination()


if __name__ == "__main__":
    main()

