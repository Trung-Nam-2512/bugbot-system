# MQTT Integration Guide (ESP32-CAM)

Tai lieu nay mo ta day du giao tiep MQTT de tich hop Web App voi firmware hien tai.

## 1) Tong quan giao tiep

- Moi camera tu tao `deviceId` theo MAC:
  - Dinh dang: `cam-<12HEX>` (vi du `cam-A0B765DD2568`)
- MQTT `clientId` tu dong:
  - Dinh dang: `esp32-<12HEX>`
- Topic runtime theo tung thiet bi:
  - Command rieng: `BINHDUONG/ESP32CAM/<deviceId>/cmd`
  - Status rieng: `BINHDUONG/ESP32CAM/<deviceId>/status`
  - Broadcast command: `BINHDUONG/ESP32CAM/all/cmd`

## 2) Broker config hien tai (firmware)

- Host: `<your-mqtt-host>`
- Port: `<your-mqtt-port>`
- Username: `<your-mqtt-username>`
- Password: `<your-mqtt-password>`

Khuyen nghi Web App:
- Khong hardcode credentials trong frontend.
- Dat MQTT bridge/backend de quan ly auth va ACL.

## 3) Cach Web App discover camera

Subscribe wildcard:

- `BINHDUONG/ESP32CAM/+/status`

Ly do:
- Khi camera online, firmware publish goi online status (`retain=true`).
- Broker cung publish LWT offline (`retain=true`) khi mat ket noi dot ngot.
- Subscriber moi van nhan duoc trang thai gan nhat ngay sau khi subscribe.

## 4) Payload status chuan

### 4.1 Online status (retain=true)

Camera publish khi boot va moi lan MQTT reconnect:

```json
{
  "online": true,
  "device": "cam-A0B765DD2568",
  "fw": "1.2.3",
  "ip": "192.168.100.90",
  "ssid": "4G-UFI-3787",
  "heap": 192484,
  "auto": false,
  "intervalSec": 30,
  "uptime": 2
}
```

### 4.2 Offline status (LWT, retain=true)

```json
{
  "online": false,
  "device": "cam-A0B765DD2568"
}
```

## 5) Command topics

- Gui lenh cho 1 camera:
  - Publish vao: `BINHDUONG/ESP32CAM/<deviceId>/cmd`
- Gui lenh broadcast tat ca camera:
  - Publish vao: `BINHDUONG/ESP32CAM/all/cmd`

Luu y:
- Broadcast rat huu ich cho `status`.
- Han che broadcast voi `ota_update` neu khong rollout theo dot.

## 6) Command payload duoc ho tro

Firmware chap nhan ca plain text va JSON.

### 6.1 Capture

- Plain text: `capture`
- JSON: `{"cmd":"capture"}`

Ack:

```json
{"ack":"capture","busy":false}
```

### 6.2 Status

- Plain text: `status`
- JSON: `{"cmd":"status"}`

Tra ve:

```json
{
  "ack":"status",
  "device":"cam-A0B765DD2568",
  "wifi":"4G-UFI-3787",
  "ip":"192.168.100.90",
  "uptime":123,
  "free_heap":180000,
  "auto_mode":false,
  "interval_sec":30,
  "busy":false
}
```

### 6.3 Reset ESP

- Plain text: `reset`
- JSON: `{"cmd":"reset"}`

Ack truoc khi reset:

```json
{"ack":"reset","msg":"Restarting in 2 seconds..."}
```

### 6.4 Restart camera driver

- JSON/plain text: `restart_camera` / `{"cmd":"restart_camera"}`

Ack:

```json
{"ack":"restart_camera","msg":"Restarting camera..."}
```

Ket qua:

```json
{"ack":"restart_camera","result":"success"}
```

hoac

```json
{"ack":"restart_camera","result":"failed"}
```

### 6.5 OTA check/update

- `{"cmd":"ota_check"}`
- `{"cmd":"ota_update"}`

Ack:

```json
{"ack":"ota_check","current_fw":"1.2.3"}
```

```json
{"ack":"ota_update","current_fw":"1.2.3"}
```

### 6.6 Auto mode + interval

Gui JSON:

```json
{"auto":true,"intervalSec":60}
```

Response:

```json
{"ok":true,"auto":true,"intervalSec":60}
```

Gioi han:
- `intervalSec` min = `3`
- `intervalSec` max = `3600`

Neu payload khong hop le:

```json
{"warn":"unknown_cmd"}
```

## 7) Event stream camera publish

Tat ca event duoc publish vao status topic cua thiet bi.

### Capture/Upload

- `{"event":"captured","size":123456}`
- `{"event":"upload_ok"}`
- `{"event":"capture_fail","reason":"fb_null"}`
- `{"event":"upload_fail","reason":"no_wifi"}`
- `{"event":"upload_fail","reason":"server_error"}`

### OTA

- `{"event":"ota_checking"}`
- `{"event":"ota_available","current":"1.2.2","latest":"1.2.3","notes":"..."}`
- `{"event":"ota_result","result":"up_to_date","current":"1.2.3"}`
- `{"event":"ota_start","from":"1.2.2","to":"1.2.3","notes":"..."}`
- `{"event":"ota_progress","pct":45}`
- `{"event":"ota_success","version":"1.2.3"}`
- `{"event":"ota_fail","reason":"fail_download"}`

### Health/Clock

- `{"warn":"ntp_fail","ts_source":"millis"}`
- `{"warn":"low_heap","heap":19800,"uptime":7200}`

## 8) Goi y tich hop Web App

- Tao service subscribe `BINHDUONG/ESP32CAM/+/status` de nhan toan bo event.
- Map `deviceId` tu:
  - Truong `device` trong payload, hoac
  - Segment topic `BINHDUONG/ESP32CAM/<deviceId>/status`.
- Tach event theo nhom:
  - Presence: `online true/false`
  - Control ACK: `ack:*`
  - Telemetry/Event: `event:*`, `warn:*`
- Dung timeout 10-20s de danh dau camera stale neu khong co status moi.
- Khi rollout OTA nhieu cam:
  - Lam theo batch nho (5-10 cam/lần), khong update all cung luc.

## 9) Quick test script (manual)

1. Subscribe:
   - `BINHDUONG/ESP32CAM/+/status`
2. Gui lenh status cho 1 cam:
   - Topic: `BINHDUONG/ESP32CAM/<deviceId>/cmd`
   - Payload: `{"cmd":"status"}`
3. Gui capture broadcast:
   - Topic: `BINHDUONG/ESP32CAM/all/cmd`
   - Payload: `{"cmd":"capture"}`
4. Kiem tra event upload:
   - `captured` -> `upload_ok` hoac `upload_fail`

