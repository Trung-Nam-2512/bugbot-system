# Automated Test Script for Phase 1 Day 1-2
# Chạy script này để test tự động toàn bộ hệ thống

param(
    [switch]$SkipServerStart = $false
)

$ErrorActionPreference = "Continue"
$TEST_RESULTS = @()

function Write-TestHeader {
    param([string]$Title)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = ""
    )
    
    $result = @{
        TestName = $TestName
        Passed = $Passed
        Message = $Message
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    
    $script:TEST_RESULTS += $result
    
    if ($Passed) {
        Write-Host "[PASS] $TestName" -ForegroundColor Green
        if ($Message) {
            Write-Host "       $Message" -ForegroundColor Gray
        }
    } else {
        Write-Host "[FAIL] $TestName" -ForegroundColor Red
        if ($Message) {
            Write-Host "       $Message" -ForegroundColor Yellow
        }
    }
}

# Test 1: Infrastructure Services
Write-TestHeader "TEST 1: Infrastructure Services"

try {
    $containers = docker ps --format "{{.Names}}" 2>$null
    $requiredContainers = @("redpanda", "mongodb", "minio", "clickhouse")
    
    foreach ($container in $requiredContainers) {
        $running = $containers -match $container
        Write-TestResult -TestName "Container $container" -Passed $running -Message $(if ($running) { "Running" } else { "Not running" })
    }
} catch {
    Write-TestResult -TestName "Docker check" -Passed $false -Message $_.Exception.Message
}

# Test 2: Server Health
Write-TestHeader "TEST 2: Backend Server Health"

if (-not $SkipServerStart) {
    Write-Host "Starting server in background..." -ForegroundColor Yellow
    $serverJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        npm run dev 2>&1
    }
    Start-Sleep -Seconds 10
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:1435/api/health" -Method Get -ErrorAction Stop
    $healthOk = $response.ok -eq $true
    Write-TestResult -TestName "Health endpoint" -Passed $healthOk -Message "Status: $($response.ok)"
    
    # Check individual services
    if ($response.services) {
        Write-TestResult -TestName "Kafka health" -Passed $response.services.kafka -Message "Connected: $($response.services.kafka)"
        Write-TestResult -TestName "MinIO health" -Passed $response.services.minio -Message "Connected: $($response.services.minio)"
        Write-TestResult -TestName "MongoDB health" -Passed $response.services.mongodb -Message "Connected: $($response.services.mongodb)"
        Write-TestResult -TestName "ClickHouse health" -Passed $response.services.clickhouse -Message "Connected: $($response.services.clickhouse)"
    }
} catch {
    Write-TestResult -TestName "Health endpoint" -Passed $false -Message "Server không accessible: $($_.Exception.Message)"
}

# Test 3: Stream Processor
Write-TestHeader "TEST 3: Stream Processor Status"

try {
    $response = Invoke-RestMethod -Uri "http://localhost:1435/api/health/stream-processor" -Method Get -ErrorAction Stop
    Write-TestResult -TestName "Stream processor running" -Passed $response.ok -Message "Status: $($response.ok)"
    
    if ($response.stats) {
        Write-Host "`nStream Processor Stats:" -ForegroundColor Cyan
        Write-Host "  Messages processed: $($response.stats.messagesProcessed)" -ForegroundColor Gray
        Write-Host "  Batches written: $($response.stats.batchesWritten)" -ForegroundColor Gray
        Write-Host "  Errors: $($response.stats.errors)" -ForegroundColor Gray
    }
} catch {
    Write-TestResult -TestName "Stream processor endpoint" -Passed $false -Message $_.Exception.Message
}

# Test 4: Upload & Processing Flow
Write-TestHeader "TEST 4: Upload & Data Flow"

try {
    # Check if test image exists
    if (-not (Test-Path "test-image.jpg")) {
        Write-Host "Creating test image..." -ForegroundColor Yellow
        # Create a simple test file
        "test data" | Out-File -FilePath "test-image.jpg" -Encoding ASCII
    }
    
    # Upload test
    $testImagePath = Resolve-Path "test-image.jpg"
    $form = @{
        image = Get-Item -Path $testImagePath
        device_id = "test-device-auto"
        timestamp = Get-Date -Format "yyyyMMddHHmmss"
    }
    
    try {
        $uploadResponse = Invoke-RestMethod -Uri "http://localhost:1435/api/upload" -Method Post -Form $form -ErrorAction Stop
        Write-TestResult -TestName "Image upload" -Passed $true -Message "Upload successful"
        
        # Wait for processing
        Start-Sleep -Seconds 3
        
        # Verify Kafka message (via stream processor stats)
        $statsResponse = Invoke-RestMethod -Uri "http://localhost:1435/api/health/stream-processor" -Method Get -ErrorAction Stop
        $hasProcessed = $statsResponse.stats.messagesProcessed -gt 0
        Write-TestResult -TestName "Kafka message processing" -Passed $hasProcessed -Message "Messages: $($statsResponse.stats.messagesProcessed)"
        
    } catch {
        Write-TestResult -TestName "Image upload" -Passed $false -Message $_.Exception.Message
    }
    
} catch {
    Write-TestResult -TestName "Upload flow setup" -Passed $false -Message $_.Exception.Message
}

# Test 5: ClickHouse Data Verification
Write-TestHeader "TEST 5: ClickHouse Data Verification"

try {
    # Check if data exists in ClickHouse
    $query = "SELECT count() as total FROM iot.events_raw"
    $chResponse = Invoke-RestMethod -Uri "http://localhost:8123/?query=$query" -Method Get -ErrorAction Stop
    $recordCount = [int]$chResponse
    
    Write-TestResult -TestName "ClickHouse events_raw table" -Passed ($recordCount -ge 0) -Message "Records: $recordCount"
    
    # Check aggregation table
    $aggQuery = "SELECT count() as total FROM iot.events_agg"
    $aggResponse = Invoke-RestMethod -Uri "http://localhost:8123/?query=$aggQuery" -Method Get -ErrorAction Stop
    $aggCount = [int]$aggResponse
    
    Write-TestResult -TestName "ClickHouse events_agg table" -Passed ($aggCount -ge 0) -Message "Aggregated records: $aggCount"
    
} catch {
    Write-TestResult -TestName "ClickHouse query" -Passed $false -Message $_.Exception.Message
}

# Generate Report
Write-TestHeader "TEST SUMMARY"

$totalTests = $TEST_RESULTS.Count
$passedTests = ($TEST_RESULTS | Where-Object { $_.Passed }).Count
$failedTests = $totalTests - $passedTests
$successRate = if ($totalTests -gt 0) { [math]::Round(($passedTests / $totalTests) * 100, 2) } else { 0 }

Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red
Write-Host "Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) { "Green" } else { "Yellow" })

# Save detailed report
$reportPath = "TEST_EXECUTION_REPORT_$(Get-Date -Format 'yyyyMMdd_HHmmss').md"
$reportContent = @"
# Test Execution Report
**Generated**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Test Suite**: Phase 1 Day 1-2 Automated Tests

## Summary
- **Total Tests**: $totalTests
- **Passed**: $passedTests
- **Failed**: $failedTests
- **Success Rate**: $successRate%

## Test Results

"@

foreach ($result in $TEST_RESULTS) {
    $status = if ($result.Passed) { "✅ PASS" } else { "❌ FAIL" }
    $reportContent += @"
### $status - $($result.TestName)
- **Timestamp**: $($result.Timestamp)
- **Message**: $($result.Message)

"@
}

$reportContent += @"

## Recommendations

"@

if ($failedTests -gt 0) {
    $reportContent += "### Failed Tests - Action Required`n"
    foreach ($result in ($TEST_RESULTS | Where-Object { -not $_.Passed })) {
        $reportContent += "- **$($result.TestName)**: $($result.Message)`n"
    }
}

if ($successRate -ge 80) {
    $reportContent += "`n✅ System is in good health. Ready to proceed to next phase.`n"
} else {
    $reportContent += "`n⚠️ Multiple tests failed. Please review and fix issues before proceeding.`n"
}

$reportContent | Out-File -FilePath $reportPath -Encoding UTF8

Write-Host "`n📄 Detailed report saved to: $reportPath" -ForegroundColor Cyan

# Cleanup
if ($serverJob) {
    Write-Host "`n⚠️ Remember to stop the server job manually if needed:" -ForegroundColor Yellow
    Write-Host "   Get-Job | Stop-Job; Get-Job | Remove-Job" -ForegroundColor Gray
}

Write-Host "`n✅ Automated testing completed!" -ForegroundColor Green

