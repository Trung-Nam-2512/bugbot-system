# Fix MQTT Service - mqtt_not_connected Error

## 🎯 Vấn đề

Backend báo lỗi `mqtt_not_connected` khi gọi API `/api/iot/mqtt/cam-02/capture`:

```
Error: mqtt_not_connected
    at MqttService.publishCmd (/app/src/services/mqtt.service.js:55:59)
    at MqttService.capture (/app/src/services/mqtt.service.js:63:37)
```

**Nguyên nhân:**
- `MQTT_ENABLED=false` trong `docker-compose.yml`
- MQTT service không được khởi động
- Nhưng route vẫn được expose và được gọi từ frontend
- Controller không check MQTT status trước khi gọi

---

## ✅ Giải pháp đã áp dụng

### 1. **Sửa Controller để check MQTT status**

Đã thêm check trong `src/controllers/cam.mqtt.controller.js`:
- Check `MQTT_ENABLED` trước khi gọi MQTT service
- Check MQTT client connection status
- Return error message rõ ràng nếu MQTT không available

### 2. **Error Messages**

Bây giờ API sẽ trả về error message rõ ràng thay vì crash:
- `503 Service Unavailable` nếu MQTT không enabled
- `503 Service Unavailable` nếu MQTT không connected
- Error message hướng dẫn cách fix

---

## 🔧 Cách sử dụng MQTT

### **Option 1: Enable MQTT (nếu cần điều khiển ESP32-CAM qua MQTT)**

Thêm vào `.env` hoặc `docker-compose.yml`:

```bash
MQTT_ENABLED=true
MQTT_BROKER=mqtt://<host>:<port>
MQTT_USERNAME=<username>
MQTT_PASSWORD=<password>
MQTT_PREFIX=BINHDUONG/ESP32CAM
```

Sau đó restart backend:
```bash
docker-compose restart backend
```

### **Option 2: Disable MQTT Routes (nếu không cần MQTT)**

Nếu không cần điều khiển ESP32-CAM qua MQTT, có thể:
1. Giữ `MQTT_ENABLED=false` (như hiện tại)
2. Frontend sẽ nhận error message rõ ràng thay vì crash
3. Hoặc có thể ẩn MQTT controls trong frontend nếu MQTT không available

---

## 📋 Checklist

### **Nếu muốn dùng MQTT:**
- [ ] Set `MQTT_ENABLED=true`
- [ ] Set `MQTT_BROKER` (ví dụ: `mqtt://<host>:<port>`)
- [ ] Set `MQTT_USERNAME` và `MQTT_PASSWORD`
- [ ] Set `MQTT_PREFIX` (ví dụ: `BINHDUONG/ESP32CAM`)
- [ ] Restart backend
- [ ] Kiểm tra logs: `docker-compose logs backend | grep MQTT`
- [ ] Test API: `POST /api/iot/mqtt/cam-02/capture`

### **Nếu không cần MQTT:**
- [ ] Giữ `MQTT_ENABLED=false` (như hiện tại)
- [ ] Frontend sẽ nhận error message thay vì crash
- [ ] Có thể ẩn MQTT controls trong frontend

---

## 🔍 Kiểm tra MQTT Status

### **Check MQTT connection trong logs:**

```bash
docker-compose logs backend | grep MQTT
```

**Nếu MQTT connected, sẽ thấy:**
```
[MQTT] connected: mqtt://<host>:<port>
[MQTT] subscribed: BINHDUONG/ESP32CAM/+/status
```

**Nếu MQTT không connected, sẽ thấy:**
```
[MQTT] error: <error message>
[MQTT] reconnecting…
```

### **Test MQTT API:**

```bash
# Test capture
curl -X POST http://localhost:1435/api/iot/mqtt/cam-02/capture

# Nếu MQTT enabled và connected:
{"ok":true,"sent":{"topic":"BINHDUONG/ESP32CAM/cam-02/cmd","body":"capture"}}

# Nếu MQTT không enabled:
{"ok":false,"error":"MQTT service is not enabled. Set MQTT_ENABLED=true and configure MQTT_URL, MQTT_USER, MQTT_PASS"}

# Nếu MQTT enabled nhưng không connected:
{"ok":false,"error":"MQTT service is not connected. Please check MQTT configuration and connection."}
```

---

## 🚨 Troubleshooting

### **MQTT không connect được**

**Nguyên nhân:**
- MQTT broker không accessible
- Credentials sai
- Network/firewall block

**Giải pháp:**
1. Test MQTT connection từ server:
   ```bash
   # Test MQTT connection
   docker run --rm --network bugbot_iot_network eclipse-mosquitto mosquitto_pub -h <host> -p <port> -u <username> -P <password> -t test/topic -m "test"
   ```
2. Kiểm tra `MQTT_BROKER` có đúng không
3. Kiểm tra `MQTT_USERNAME` và `MQTT_PASSWORD`
4. Kiểm tra firewall/network

### **MQTT connected nhưng không nhận được messages**

**Nguyên nhân:**
- MQTT_PREFIX không đúng
- Topic format không match
- ESP32-CAM không publish đúng topic

**Giải pháp:**
1. Kiểm tra MQTT_PREFIX trong .env
2. Kiểm tra ESP32-CAM publish topic format
3. Xem logs để debug: `docker-compose logs backend | grep MQTT`

---

## 📚 Code Changes

### Files đã sửa:

1. **`src/controllers/cam.mqtt.controller.js`**
   - Thêm check `MQTT_ENABLED` trong `capture()`
   - Thêm check `MQTT_ENABLED` trong `autoConfig()`
   - Thêm check MQTT client connection status
   - Return error message rõ ràng thay vì crash

---

## 🎯 Tóm tắt

**Vấn đề:** MQTT service không được enable nhưng route vẫn được gọi → crash

**Giải pháp:** 
- ✅ Controller check MQTT status trước khi gọi
- ✅ Return error message rõ ràng thay vì crash
- ✅ Hướng dẫn cách enable MQTT nếu cần

**Kết quả:**
- ✅ Backend không còn crash khi MQTT không available
- ✅ Frontend nhận error message rõ ràng
- ✅ Có thể enable MQTT dễ dàng khi cần

---

**Last Updated:** 2025-11-06







