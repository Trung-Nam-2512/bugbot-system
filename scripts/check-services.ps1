# Check all services status

Write-Host "Checking Services Status..." -ForegroundColor Cyan
Write-Host "=" * 60

$services = @()

# Check ClickHouse
Write-Host "`n1. ClickHouse..." -ForegroundColor Yellow
try {
    $result = docker exec clickhouse clickhouse-client --password=clickhouse123 --query "SELECT 1" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] ClickHouse running" -ForegroundColor Green
        $services += @{Name="ClickHouse"; Status="OK"}
    } else {
        Write-Host "   [FAIL] ClickHouse not responding" -ForegroundColor Red
        $services += @{Name="ClickHouse"; Status="FAIL"}
    }
} catch {
    Write-Host "   [FAIL] ClickHouse error: $_" -ForegroundColor Red
    $services += @{Name="ClickHouse"; Status="FAIL"}
}

# Check Kafka/Redpanda
Write-Host "`n2. Kafka/Redpanda..." -ForegroundColor Yellow
try {
    $result = docker exec redpanda rpk topic list 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Kafka/Redpanda running" -ForegroundColor Green
        $services += @{Name="Kafka"; Status="OK"}
    } else {
        Write-Host "   [FAIL] Kafka/Redpanda not responding" -ForegroundColor Red
        $services += @{Name="Kafka"; Status="FAIL"}
    }
} catch {
    Write-Host "   [FAIL] Kafka error: $_" -ForegroundColor Red
    $services += @{Name="Kafka"; Status="FAIL"}
}

# Check MinIO
Write-Host "`n3. MinIO..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9001" -Method Get -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   [OK] MinIO running" -ForegroundColor Green
    $services += @{Name="MinIO"; Status="OK"}
} catch {
    Write-Host "   [FAIL] MinIO not responding" -ForegroundColor Red
    $services += @{Name="MinIO"; Status="FAIL"}
}

# Check Backend
Write-Host "`n4. Backend API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:1435/api/health" -Method Get -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   [OK] Backend running" -ForegroundColor Green
        $services += @{Name="Backend"; Status="OK"}
    } else {
        Write-Host "   [FAIL] Backend returned $($response.StatusCode)" -ForegroundColor Red
        $services += @{Name="Backend"; Status="FAIL"}
    }
} catch {
    Write-Host "   [FAIL] Backend not responding" -ForegroundColor Red
    $services += @{Name="Backend"; Status="FAIL"}
}

# Check AI Inference Service
Write-Host "`n5. AI Inference Service..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -Method Get -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   [OK] AI Inference Service running" -ForegroundColor Green
        $services += @{Name="AI Inference"; Status="OK"}
    } else {
        Write-Host "   [WARN] AI Inference Service returned $($response.StatusCode)" -ForegroundColor Yellow
        $services += @{Name="AI Inference"; Status="WARN"}
    }
} catch {
    Write-Host "   [WARN] AI Inference Service not responding (optional for testing)" -ForegroundColor Yellow
    $services += @{Name="AI Inference"; Status="WARN"}
}

# Summary
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "Services Summary:" -ForegroundColor Cyan
foreach ($service in $services) {
    $color = switch ($service.Status) {
        "OK" { "Green" }
        "WARN" { "Yellow" }
        default { "Red" }
    }
    Write-Host "  $($service.Name): $($service.Status)" -ForegroundColor $color
}

$okCount = ($services | Where-Object { $_.Status -eq "OK" }).Count
$totalCritical = ($services | Where-Object { $_.Name -ne "AI Inference" }).Count

if ($okCount -eq $totalCritical) {
    Write-Host "`n[SUCCESS] All critical services running!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[WARN] Some services not running" -ForegroundColor Yellow
    exit 1
}

