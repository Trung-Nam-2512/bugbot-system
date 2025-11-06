# Check Label Studio Token

## Issue: 401 Unauthorized or 404 Not Found

If you're getting 401 or 404 errors, check:

### 1. Token Type

Label Studio has TWO types of tokens:
- **Access Token** - For API calls (what we need)
- **Refresh Token** - For refreshing access (NOT what we need)

### 2. How to Get Access Token

1. Login to Label Studio: http://localhost:8082
2. Click Avatar (top right)
3. Account & Settings
4. **Access Token** tab (NOT Refresh Token)
5. Click "Create Token" or copy existing **Access Token**

### 3. Update .env File

Make sure your `.env` file has the **Access Token**:

```env
LABELSTUDIO_URL=http://localhost:8082
LABELSTUDIO_API_TOKEN=<paste_access_token_here>
```

### 4. Test Token

```powershell
# Test if token works
$token = "your_access_token_here"
$headers = @{Authorization = "Token $token"}
Invoke-RestMethod -Uri "http://localhost:8082/api/projects" -Headers $headers
```

If this returns projects list, token is correct!

### 5. Common Issues

- **401 Unauthorized**: Wrong token type (refresh instead of access) or expired token
- **404 Not Found**: Endpoint doesn't exist (Label Studio version issue)
- **Token not loaded**: Make sure `.env` file is in `services/labeling/` directory

