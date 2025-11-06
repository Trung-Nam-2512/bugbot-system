# Test Label Studio Token
$envContent = Get-Content .env -Raw
if ($envContent -match "LABELSTUDIO_URL=(.+)") {
    $url = $matches[1].Trim()
} else {
    $url = "http://localhost:8082"
}

if ($envContent -match "LABELSTUDIO_API_TOKEN=(.+)") {
    $token = $matches[1].Trim()
} else {
    Write-Host "[ERROR] Token not found in .env" -ForegroundColor Red
    exit 1
}

Write-Host "=== TESTING LABEL STUDIO TOKEN ===" -ForegroundColor Green
Write-Host "URL: $url" -ForegroundColor Cyan
Write-Host "Token (first 30 chars): $($token.Substring(0, [Math]::Min(30, $token.Length)))..." -ForegroundColor Cyan
Write-Host ""

# Check if JWT token
if ($token -match "^eyJ") {
    Write-Host "[INFO] Detected JWT token (Personal Access Token)" -ForegroundColor Yellow
    Write-Host "Attempting to refresh token..." -ForegroundColor Yellow
    
    try {
        $refreshBody = @{refresh = $token} | ConvertTo-Json
        $refreshResponse = Invoke-RestMethod -Uri "$url/api/token/refresh" `
            -Method POST `
            -Body $refreshBody `
            -ContentType "application/json"
        
        if ($refreshResponse.access) {
            Write-Host "[OK] Successfully refreshed token!" -ForegroundColor Green
            $accessToken = $refreshResponse.access
            Write-Host "Access token (first 30 chars): $($accessToken.Substring(0, [Math]::Min(30, $accessToken.Length)))..." -ForegroundColor Cyan
            Write-Host ""
            
            # Test with access token
            Write-Host "Testing access token with /api/projects..." -ForegroundColor Yellow
            $headers = @{
                Authorization = "Bearer $accessToken"
                "Content-Type" = "application/json"
            }
            
            try {
                $projects = Invoke-RestMethod -Uri "$url/api/projects" -Headers $headers
                Write-Host "[OK] Access token works! Found $($projects.results.Count) projects" -ForegroundColor Green
                if ($projects.results) {
                    Write-Host "Projects:" -ForegroundColor Cyan
                    $projects.results | Select-Object -First 5 id, title | Format-Table
                }
            } catch {
                Write-Host "[ERROR] Access token test failed: $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "[ERROR] No access token in refresh response" -ForegroundColor Red
        }
    } catch {
        Write-Host "[ERROR] Token refresh failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails) {
            Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "[INFO] Legacy token format detected" -ForegroundColor Yellow
    Write-Host "Testing with Token format..." -ForegroundColor Yellow
    
    $headers = @{
        Authorization = "Token $token"
        "Content-Type" = "application/json"
    }
    
    try {
        $projects = Invoke-RestMethod -Uri "$url/api/projects" -Headers $headers
        Write-Host "[OK] Token works! Found $($projects.results.Count) projects" -ForegroundColor Green
        if ($projects.results) {
            Write-Host "Projects:" -ForegroundColor Cyan
            $projects.results | Select-Object -First 5 id, title | Format-Table
        }
    } catch {
        Write-Host "[ERROR] Token test failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails) {
            Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
}

Write-Host ""

