# Phase 3 Week 5 Day 1-2: Automated Test Script
# PowerShell script để test detection statistics endpoints

$ErrorActionPreference = "Stop"

$BACKEND_URL = $env:BACKEND_URL
if (-not $BACKEND_URL) {
    $BACKEND_URL = "http://localhost:1435"
}

$API_BASE = "$BACKEND_URL/api/cam/stats"

Write-Host "Phase 3 Week 5 Day 1-2: Detection Statistics Test" -ForegroundColor Cyan
Write-Host "=" * 60

$results = @()

# Function to make HTTP request
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Path,
        [hashtable]$QueryParams = @{}
    )
    
    Write-Host "`nTesting: $Name" -ForegroundColor Yellow
    Write-Host "  URL: $Path"
    
    try {
        $queryString = ""
        if ($QueryParams.Count -gt 0) {
            $pairs = $QueryParams.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }
            $queryString = "?" + ($pairs -join "&")
        }
        
        $url = "$Path$queryString"
        $response = Invoke-WebRequest -Uri $url -Method Get -UseBasicParsing -TimeoutSec 10
        
        if ($response.StatusCode -eq 200) {
            $data = $response.Content | ConvertFrom-Json
            
            if ($data.ok) {
                Write-Host "  [PASS] Status: $($response.StatusCode)" -ForegroundColor Green
                return @{
                    Success = $true
                    StatusCode = $response.StatusCode
                    Data = $data
                }
            } else {
                Write-Host "  [FAIL] Response ok=false" -ForegroundColor Red
                return @{
                    Success = $false
                    StatusCode = $response.StatusCode
                    Error = "ok=false"
                }
            }
        } else {
            Write-Host "  [FAIL] Status: $($response.StatusCode)" -ForegroundColor Red
            return @{
                Success = $false
                StatusCode = $response.StatusCode
            }
        }
    } catch {
        Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
        return @{
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

# Test 1: Overall Detection Stats
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
$result1 = Test-Endpoint -Name "Overall Detection Stats" -Path "$API_BASE/detections"
$results += @{
    Test = "Overall Detection Stats"
    Success = $result1.Success
}

if ($result1.Success) {
    Write-Host "  Total Detections: $($result1.Data.totalDetections)"
    Write-Host "  Total Images: $($result1.Data.totalImages)"
    Write-Host "  Avg per Image: $($result1.Data.avgDetectionsPerImage)"
}

# Test 2: Species Distribution
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
$result2 = Test-Endpoint -Name "Species Distribution" -Path "$API_BASE/species"
$results += @{
    Test = "Species Distribution"
    Success = $result2.Success
}

if ($result2.Success) {
    Write-Host "  Total Detections: $($result2.Data.totalDetections)"
    Write-Host "  Species Count: $($result2.Data.distribution.Count)"
    if ($result2.Data.distribution.Count -gt 0) {
        Write-Host "  Top Species: $($result2.Data.distribution[0].species) ($($result2.Data.distribution[0].count))"
    }
}

# Test 3: Confidence Distribution
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
$result3 = Test-Endpoint -Name "Confidence Distribution" -Path "$API_BASE/confidence"
$results += @{
    Test = "Confidence Distribution"
    Success = $result3.Success
}

if ($result3.Success) {
    Write-Host "  Avg Confidence: $($result3.Data.avgConfidence)"
    Write-Host "  Min Confidence: $($result3.Data.minConfidence)"
    Write-Host "  Max Confidence: $($result3.Data.maxConfidence)"
}

# Test 4: Detection Timeline (day)
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
$result4 = Test-Endpoint -Name "Detection Timeline (day)" -Path "$API_BASE/detections/timeline" -QueryParams @{period="day"}
$results += @{
    Test = "Detection Timeline (day)"
    Success = $result4.Success
}

if ($result4.Success) {
    Write-Host "  Period: $($result4.Data.period)"
    Write-Host "  Timeline Points: $($result4.Data.timeline.Count)"
}

# Test 5: Invalid Period
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "`nTesting: Invalid Period Parameter" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$API_BASE/detections/timeline?period=invalid" -Method Get -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    Write-Host "  [FAIL] Expected 400, got $($response.StatusCode)" -ForegroundColor Red
    $results += @{
        Test = "Invalid Period"
        Success = $false
    }
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "  [PASS] Correctly rejected invalid period" -ForegroundColor Green
        $results += @{
            Test = "Invalid Period"
            Success = $true
        }
    } else {
        Write-Host "  [FAIL] Expected 400, got $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        $results += @{
            Test = "Invalid Period"
            Success = $false
        }
    }
}

# Summary
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "=" * 60

$passed = ($results | Where-Object { $_.Success }).Count
$total = $results.Count

foreach ($result in $results) {
    $status = if ($result.Success) { "[PASS]" } else { "[FAIL]" }
    $color = if ($result.Success) { "Green" } else { "Red" }
    Write-Host "$($result.Test): $status" -ForegroundColor $color
}

Write-Host "`nTotal: $passed/$total tests passed" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })

if ($passed -eq $total) {
    Write-Host "`n[SUCCESS] All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[WARN] Some tests failed" -ForegroundColor Yellow
    exit 1
}

