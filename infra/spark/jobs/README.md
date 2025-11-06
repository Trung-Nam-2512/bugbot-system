# Spark Structured Streaming Jobs

This directory contains Spark Structured Streaming jobs for processing IoT events.

## Job: kafka_to_clickhouse.py

Reads events from Kafka topic `events.raw` and writes them to ClickHouse for analytics.

### Architecture

```
ESP32-CAM → Backend → Kafka (events.raw) → Spark Streaming → ClickHouse
```

### Prerequisites

1. **Spark 3.5+ with Scala 2.12**
2. **Kafka connector**: `spark-sql-kafka-0-10_2.12:3.5.0`
3. **ClickHouse JDBC driver**: Download from [ClickHouse GitHub](https://github.com/ClickHouse/clickhouse-java/releases)

### Running the Job

#### Local Mode (for testing)

```bash
spark-submit \
  --master local[*] \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0 \
  --jars ./clickhouse-jdbc-0.4.6-all.jar \
  --conf spark.sql.streaming.checkpointLocation=/tmp/spark-checkpoints \
  kafka_to_clickhouse.py
```

#### Docker Mode

```bash
# Start Spark with Docker Compose profile
docker-compose --profile spark up -d

# Copy the job to Spark container
docker cp kafka_to_clickhouse.py spark:/opt/spark-jobs/

# Execute the job
docker exec -it spark spark-submit \
  --master local[*] \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0 \
  /opt/spark-jobs/kafka_to_clickhouse.py
```

#### Cluster Mode

```bash
spark-submit \
  --master spark://spark-master:7077 \
  --deploy-mode cluster \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0 \
  --jars /path/to/clickhouse-jdbc.jar \
  --conf spark.executor.memory=2g \
  --conf spark.executor.cores=2 \
  kafka_to_clickhouse.py
```

### Environment Variables

Set these before running:

```bash
export KAFKA_BROKERS=localhost:19092
export KAFKA_TOPIC_RAW=events.raw
export CLICKHOUSE_JDBC_URL=jdbc:clickhouse://localhost:8123/iot
export CLICKHOUSE_USER=default
export CLICKHOUSE_PASSWORD=clickhouse123
```

### Monitoring

- **Spark UI**: http://localhost:4040 (when running locally)
- **Kafka Console**: http://localhost:8080
- View streaming query metrics in Spark UI

### Configuration

Edit the job file to customize:

- `processingTime`: Micro-batch interval (default: 10 seconds)
- `startingOffsets`: "earliest" or "latest"
- `batchsize`: JDBC batch size for ClickHouse writes

### Troubleshooting

1. **Connection refused**: Ensure Kafka and ClickHouse are running
2. **Class not found**: Check that JDBC driver is in classpath
3. **Checkpoint errors**: Clear checkpoint directory: `rm -rf /tmp/spark-checkpoints`

## Alternative: Using Backend Direct Insert

If you prefer not to use Spark, enable direct ClickHouse insertion in the backend:

```bash
# In .env file
CLICKHOUSE_DIRECT_INSERT=true
```

This will make the Node.js backend write directly to ClickHouse on each upload.

