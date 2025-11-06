#!/bin/bash
# ==============================================
# Test Execution Script - Phase 1 Day 1-2
# ==============================================

set -e

echo "🧪 Starting Test Execution - Phase 1 Week 1 Day 1-2"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((FAILED++))
    fi
    echo ""
}

# Function to check if service is running
check_service() {
    local service=$1
    local command=$2
    
    echo "Checking $service..."
    if eval "$command" > /dev/null 2>&1; then
        print_result 0 "$service is running"
        return 0
    else
        print_result 1 "$service is NOT running"
        return 1
    fi
}

# ==============================================
# TC001: Infrastructure Health Check
# ==============================================
echo "📋 TC001: Infrastructure Health Check"
echo "--------------------------------------"

check_service "Kafka/Redpanda" "docker exec redpanda rpk cluster info"
check_service "ClickHouse" "docker exec clickhouse clickhouse-client --query 'SELECT 1'"
check_service "MongoDB" "docker exec mongodb mongosh --eval 'db.runCommand({ ping: 1 })' --quiet"
check_service "MinIO" "docker exec minio mc --help"

# ==============================================
# TC002: Backend Health Check
# ==============================================
echo "📋 TC002: Backend Health Check"
echo "--------------------------------------"

echo "Checking backend health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:1435/api/health || echo "ERROR")

if echo "$HEALTH_RESPONSE" | grep -q '"ok":true'; then
    print_result 0 "Backend health check"
else
    print_result 1 "Backend health check"
    echo "Response: $HEALTH_RESPONSE"
fi

# ==============================================
# TC003: Stream Processor Health
# ==============================================
echo "📋 TC003: Stream Processor Health"
echo "--------------------------------------"

echo "Checking stream processor health..."
STREAM_HEALTH=$(curl -s http://localhost:1435/api/health/stream-processor || echo "ERROR")

if echo "$STREAM_HEALTH" | grep -q '"ok":true'; then
    print_result 0 "Stream processor is healthy"
    echo "Stats: $(echo $STREAM_HEALTH | jq '.stats' 2>/dev/null || echo 'N/A')"
else
    print_result 1 "Stream processor is NOT healthy"
    echo "Response: $STREAM_HEALTH"
fi

# ==============================================
# TC004: Batch Processing Test (Small)
# ==============================================
echo "📋 TC004: Batch Processing Test (10 events)"
echo "--------------------------------------"

echo "Running test script with 10 events..."
if node scripts/test-stream-processor.js 10; then
    print_result 0 "Batch processing (10 events)"
else
    print_result 1 "Batch processing (10 events)"
fi

# ==============================================
# TC005: Verify ClickHouse Data
# ==============================================
echo "📋 TC005: Verify ClickHouse Data"
echo "--------------------------------------"

echo "Checking events in ClickHouse..."
EVENT_COUNT=$(docker exec clickhouse clickhouse-client --query "SELECT COUNT(*) FROM iot.events_raw" 2>/dev/null || echo "0")

if [ "$EVENT_COUNT" -gt 0 ]; then
    print_result 0 "Events found in ClickHouse (count: $EVENT_COUNT)"
    
    echo "Recent events:"
    docker exec clickhouse clickhouse-client --query \
        "SELECT device_id, timestamp, image_size FROM iot.events_raw ORDER BY timestamp DESC LIMIT 5" \
        --format PrettyCompact 2>/dev/null || echo "Error querying"
else
    print_result 1 "No events in ClickHouse"
fi

# ==============================================
# TC006: Check Materialized Views
# ==============================================
echo "📋 TC006: Check Materialized Views"
echo "--------------------------------------"

echo "Checking hourly aggregations..."
HOURLY_COUNT=$(docker exec clickhouse clickhouse-client --query \
    "SELECT COUNT(*) FROM iot.events_hourly" 2>/dev/null || echo "0")

if [ "$HOURLY_COUNT" -gt 0 ]; then
    print_result 0 "Hourly aggregations found (count: $HOURLY_COUNT)"
    
    echo "Recent hourly aggregations:"
    docker exec clickhouse clickhouse-client --query \
        "SELECT device_id, hour, image_count FROM iot.events_hourly ORDER BY hour DESC LIMIT 5" \
        --format PrettyCompact 2>/dev/null || echo "Error querying"
else
    print_result 1 "No hourly aggregations found"
fi

echo "Checking daily stats..."
DAILY_COUNT=$(docker exec clickhouse clickhouse-client --query \
    "SELECT COUNT(*) FROM iot.device_stats_daily" 2>/dev/null || echo "0")

if [ "$DAILY_COUNT" -gt 0 ]; then
    print_result 0 "Daily stats found (count: $DAILY_COUNT)"
else
    print_result 1 "No daily stats found (might be ok if data is recent)"
fi

# ==============================================
# TC007: Performance Test (Medium)
# ==============================================
echo "📋 TC007: Performance Test (100 events)"
echo "--------------------------------------"

echo "Running test script with 100 events..."
START_TIME=$(date +%s)

if node scripts/test-stream-processor.js 100; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    print_result 0 "Performance test (100 events in ${DURATION}s)"
    
    if [ $DURATION -lt 30 ]; then
        echo -e "${GREEN}⚡ Good performance!${NC}"
    elif [ $DURATION -lt 60 ]; then
        echo -e "${YELLOW}⚠️  Acceptable performance${NC}"
    else
        echo -e "${RED}⚠️  Slow performance!${NC}"
    fi
else
    print_result 1 "Performance test failed"
fi

# ==============================================
# TC008: Consumer Lag Check
# ==============================================
echo "📋 TC008: Consumer Lag Check"
echo "--------------------------------------"

echo "Checking consumer group lag..."
if docker exec redpanda rpk group describe iot-backend-processor 2>/dev/null; then
    print_result 0 "Consumer group info retrieved"
else
    print_result 1 "Could not retrieve consumer group info"
fi

# ==============================================
# TC009: Stream Processor Stats
# ==============================================
echo "📋 TC009: Stream Processor Final Stats"
echo "--------------------------------------"

echo "Getting final stats..."
FINAL_STATS=$(curl -s http://localhost:1435/api/health/stream-processor)

if [ $? -eq 0 ]; then
    print_result 0 "Retrieved stream processor stats"
    echo "$FINAL_STATS" | jq '.stats' 2>/dev/null || echo "$FINAL_STATS"
else
    print_result 1 "Could not retrieve stats"
fi

# ==============================================
# Summary
# ==============================================
echo ""
echo "=================================================="
echo "📊 Test Execution Summary"
echo "=================================================="
echo ""
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo ""
    echo "✅ Phase 1 Week 1 Day 1-2: COMPLETED"
    echo "📝 Report generated in TEST_REPORT_PHASE1_DAY1-2.md"
    echo "🚀 Ready to proceed to Day 3-4"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed!${NC}"
    echo ""
    echo "Please review the failures above and fix issues before proceeding."
    echo "📝 Update TEST_REPORT_PHASE1_DAY1-2.md with actual results"
    exit 1
fi


