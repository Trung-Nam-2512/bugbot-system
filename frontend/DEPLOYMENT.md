# ESP32-CAM Dashboard - Deployment Guide

## 🚀 Production Deployment với Nginx

### 1. Build cho Production

```bash
# Build với relative paths (cho Nginx proxy)
npm run build:prod

# Hoặc build thông thường
npm run build
```

### 2. Cấu hình Nginx

```nginx
server {
    listen 80;
    server_name bugbot.nguyentrungnam.com;

    # Frontend build files
    root /var/www/nguyentrungnam/frontend-hydro-data;
    index index.html;

    # Uploads proxy (ảnh từ ESP32-CAM)
    location /uploads/ {
        proxy_pass http://127.0.0.1:2512;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache ảnh 1 ngày
        expires 1d;
        add_header Cache-Control "public";
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:2512;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 3. Environment Variables

#### Development (.env.local)

```bash
REACT_APP_API_URL=http://localhost:2512
```

#### Production

```bash
# Không cần set gì, sẽ sử dụng relative paths
# REACT_APP_API_URL=
```

### 4. API Endpoints

Frontend sẽ gọi các API sau:

#### Images

- `GET /api/cam/images` - List images
- `GET /api/cam/images/:id` - Get single image
- `GET /api/cam/images/:id/download` - Download image
- `DELETE /api/cam/images/:id` - Delete image

#### Statistics

- `GET /api/cam/stats` - Overall stats
- `GET /api/cam/stats/devices` - Device list
- `GET /api/cam/stats/:deviceId` - Device stats

#### Device Control

- `GET /api/iot/mqtt/devices` - Device management
- `POST /api/iot/mqtt/:id/capture` - Capture photo
- `POST /api/iot/mqtt/:id/auto-config` - Auto config

#### Upload

- `POST /api/iot/cam/upload` - Upload from ESP32

### 5. Static Files

- **Images**: `/uploads/` → proxied to backend
- **Assets**: `/static/` → served by Nginx
- **SPA**: `/` → fallback to index.html

### 6. Caching Strategy

- **Images**: 1 day cache
- **Static assets**: 1 year cache
- **API calls**: No cache
- **index.html**: No cache

### 7. Troubleshooting

#### API calls fail

- Kiểm tra backend đang chạy trên port 2512
- Kiểm tra Nginx proxy config
- Kiểm tra CORS settings

#### Images not loading

- Kiểm tra `/uploads/` location trong Nginx
- Kiểm tra backend serve static files
- Kiểm tra file permissions

#### SPA routing issues

- Đảm bảo có `try_files $uri $uri/ /index.html;`
- Kiểm tra build output có index.html

### 8. Development vs Production

| Environment | API Base URL | Usage |
|-------------|--------------|-------|
| Development | `http://localhost:2512` | Direct backend connection |
| Production | `` (empty) | Relative paths via Nginx proxy |

## 🔧 Quick Commands

```bash
# Development
npm start

# Build for production
npm run build:prod

# Test production build locally
npx serve -s build
```
