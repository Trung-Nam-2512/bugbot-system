# Nginx Configuration Templates

**Mục đích:** Nginx config templates cho từng service với domain setup

---

## 📋 FILES

- `frontend.conf` - Frontend Dashboard + API proxy
- `label.conf` - Label Studio
- `minio.conf` - MinIO Console (protected)
- `kafka.conf` - Redpanda Console (protected)
- `ai.conf` - AI Inference Service (protected)
- `clickhouse.conf` - ClickHouse (protected)

---

## 🚀 USAGE

### **1. Copy Configs to Nginx**

```bash
# Copy configs to Nginx sites-available
sudo cp nginx-configs/*.conf /etc/nginx/sites-available/

# Enable configs
sudo ln -s /etc/nginx/sites-available/frontend.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/label.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/minio.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/kafka.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/ai.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/clickhouse.conf /etc/nginx/sites-enabled/
```

### **2. Update Domain Names**

**QUAN TRỌNG:** Thay `yourdomain.com` bằng domain thực tế của bạn trong TẤT CẢ files:

```bash
# Replace domain in all configs
sudo sed -i 's/yourdomain.com/YOUR_ACTUAL_DOMAIN/g' /etc/nginx/sites-available/*.conf
```

### **3. Update SSL Certificate Paths**

**QUAN TRỌNG:** Update SSL certificate paths sau khi get certificates:

```bash
# Certificates thường ở:
# /etc/letsencrypt/live/DOMAIN_NAME/fullchain.pem
# /etc/letsencrypt/live/DOMAIN_NAME/privkey.pem
```

### **4. Test & Reload**

```bash
# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 🔧 CUSTOMIZATION

### **Frontend Path**

Update `root` path trong `frontend.conf`:

```nginx
root /var/www/bugbot/frontend/build;  # Update path này
```

### **Basic Auth**

File `.htpasswd` location:

```nginx
auth_basic_user_file /etc/nginx/.htpasswd;  # Default location
```

### **Ports**

Tất cả configs đã dùng ports mới (1440-1448):
- Frontend API proxy: `127.0.0.1:1435`
- Label Studio: `127.0.0.1:1447`
- MinIO Console: `127.0.0.1:1441`
- Redpanda Console: `127.0.0.1:1440`
- AI Inference: `127.0.0.1:1446`
- ClickHouse: `127.0.0.1:1443`

---

## 📚 REFERENCES

- **Domain Setup Guide:** `DOMAIN_SETUP_GUIDE.md`
- **Port Mapping:** `PORT_MAPPING.md`

---

**Last Updated:** 2025-11-06

