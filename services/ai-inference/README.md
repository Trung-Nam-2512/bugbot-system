# AI Inference Service

Microservice cho AI inference (YOLOv8) từ Kafka events.

## 🎯 Mục Tiêu

- Consume events từ Kafka topic `events.raw`
- Download images từ MinIO
- Run YOLOv8 inference
- Annotate images với detections
- Upload annotated images to MinIO
- Publish enriched events to Kafka topic `events.enriched`

## 🏗️ Architecture

```
Kafka (events.raw)
    ↓
Consumer Service
    ↓
Download Image (MinIO)
    ↓
YOLOv8 Inference
    ↓
Annotate Image
    ↓
Upload Annotated Image (MinIO)
    ↓
Publish Enriched Event (Kafka events.enriched)
```

## 📋 Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Download YOLO Model

```bash
# YOLO sẽ tự động download khi chạy lần đầu
# Hoặc download manually:
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env với config của bạn
```

### 4. Run Service

```bash
# Development
python main.py

# Production
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 🐳 Docker

```bash
# Build
docker build -t ai-inference:latest .

# Run
docker run -p 8000:8000 --env-file .env ai-inference:latest
```

## 📊 API Endpoints

- `GET /` - Service info
- `GET /health` - Health check
- `GET /health/liveness` - Liveness probe
- `GET /health/readiness` - Readiness probe
- `GET /stats` - Service statistics

## 🔧 Configuration

See `.env.example` for all configuration options.

## 📝 Notes

- Model: YOLOv8n (nano) - lightweight, fast
- Device: CPU by default (có thể dùng CUDA nếu có GPU)
- Confidence threshold: 0.25 (configurable)

## 🚀 Next Steps

- [ ] Add model selection (n/s/m/l/x)
- [ ] Add GPU support
- [ ] Add batch inference
- [ ] Add metrics/observability




