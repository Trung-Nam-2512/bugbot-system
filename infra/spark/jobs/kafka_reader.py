"""
Kafka reader module for Spark Structured Streaming
"""
from pyspark.sql import SparkSession
from config import (
    KAFKA_BOOTSTRAP_SERVERS,
    KAFKA_TOPIC,
    KAFKA_CONSUMER_GROUP,
)


def read_from_kafka(spark: SparkSession):
    """
    Read streaming data from Kafka topic
    
    Args:
        spark: SparkSession instance
        
    Returns:
        DataFrame: Kafka streaming DataFrame
    """
    return (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP_SERVERS)
        .option("subscribe", KAFKA_TOPIC)
        .option("startingOffsets", "latest")  # Use "earliest" for backfill
        .option("failOnDataLoss", "false")
        .option("kafka.consumer.group.id", KAFKA_CONSUMER_GROUP)
        .load()
    )


