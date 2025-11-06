"""
Configuration for Spark Structured Streaming job
"""
import os

# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BROKERS", "localhost:19092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC_RAW", "events.raw")
KAFKA_CONSUMER_GROUP = os.getenv("KAFKA_CONSUMER_GROUP", "spark-iot-processor")

# ClickHouse Configuration
CLICKHOUSE_URL = os.getenv("CLICKHOUSE_JDBC_URL", "jdbc:clickhouse://localhost:8123/iot")
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "default")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "clickhouse123")
CLICKHOUSE_DRIVER = "com.clickhouse.jdbc.ClickHouseDriver"

# Spark Configuration
SPARK_CHECKPOINT_LOCATION = os.getenv("SPARK_CHECKPOINT_LOCATION", "/tmp/spark-checkpoints/kafka-to-clickhouse")
SPARK_PROCESSING_INTERVAL = os.getenv("SPARK_PROCESSING_INTERVAL", "10 seconds")  # Micro-batch interval

# Feature Flags
ENABLE_AGGREGATIONS = os.getenv("ENABLE_AGGREGATIONS", "true").lower() == "true"
WRITE_RAW_EVENTS = os.getenv("WRITE_RAW_EVENTS", "true").lower() == "true"
WRITE_HOURLY_AGG = os.getenv("WRITE_HOURLY_AGG", "true").lower() == "true"
WRITE_DAILY_AGG = os.getenv("WRITE_DAILY_AGG", "true").lower() == "true"
WRITE_EVENTS_AGG = os.getenv("WRITE_EVENTS_AGG", "true").lower() == "true"

# Performance Configuration
BATCH_SIZE = int(os.getenv("CLICKHOUSE_BATCH_SIZE", "1000"))
SPARK_SHUFFLE_PARTITIONS = int(os.getenv("SPARK_SHUFFLE_PARTITIONS", "3"))


