# ESP32-CAM Dashboard

Dashboard quản lý và xem ảnh từ hệ thống ESP32-CAM với giao diện hiện đại sử dụng React và Ant Design.

## ✨ Tính năng chính

### 📊 Dashboard

- **Tổng quan hệ thống** với thống kê real-time
- **Hiển thị ảnh gần đây** với preview đẹp mắt
- **Trạng thái thiết bị** ESP32-CAM real-time
- **Auto-refresh** có thể bật/tắt
- **Thống kê số lượng ảnh** theo ngày

### 🖼️ Thư viện ảnh

- **Xem tất cả ảnh** từ hệ thống với grid layout
- **Tìm kiếm và lọc** theo thiết bị, ngày tháng, tên file
- **Tải về ảnh** đơn lẻ hoặc hàng loạt
- **Xem ảnh fullscreen** với modal
- **Xóa ảnh** không cần thiết
- **Phân trang và sắp xếp** linh hoạt
- **Auto-refresh** tùy chọn

### 📷 Quản lý thiết bị

- **Danh sách thiết bị** với trạng thái real-time
- **Điều khiển chụp ảnh** từ xa 1-click
- **Cấu hình tự động chụp** (bật/tắt, chu kỳ)
- **Theo dõi trạng thái** kết nối
- **Thống kê hoạt động** thiết bị
- **Auto-refresh** trạng thái

### ⚙️ Cài đặt

- **Tùy chỉnh giao diện** và hành vi
- **Cấu hình thông báo** và âm thanh
- **Thông tin hệ thống** chi tiết
- **Hướng dẫn sử dụng** đầy đủ

## 🛠️ Công nghệ sử dụng

- **Frontend**: React 18, Ant Design 5
- **State Management**: React Hooks
- **HTTP Client**: Axios
- **Real-time**: Polling (không cần WebSocket)
- **Routing**: React Router DOM
- **Date Handling**: Day.js
- **Icons**: Ant Design Icons

## 🚀 Cài đặt và chạy

### Yêu cầu hệ thống

- Node.js >= 16.0.0
- npm >= 8.0.0

### Cài đặt

```bash
cd frontend
npm install
```

### Tạo file cấu hình

```bash
# Tạo file .env
echo "REACT_APP_API_URL=http://localhost:2512" > .env
```

### Chạy development

```bash
npm start
```

Ứng dụng sẽ chạy tại `http://localhost:3000`

### Build production

```bash
npm run build
```

## 📁 Cấu trúc dự án

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── AppHeader.js          # Header với navigation
│   │   ├── AppSider.js           # Sidebar navigation
│   │   ├── DeviceStatus.js       # Component trạng thái thiết bị
│   │   └── RecentImages.js       # Component ảnh gần đây
│   ├── hooks/
│   │   └── usePolling.js         # Hook polling data
│   ├── pages/
│   │   ├── Dashboard.js          # Trang tổng quan
│   │   ├── ImageGallery.js       # Trang thư viện ảnh
│   │   ├── DeviceManagement.js   # Trang quản lý thiết bị
│   │   └── Settings.js           # Trang cài đặt
│   ├── services/
│   │   └── api.js                # API service với mock data
│   ├── utils/
│   │   └── constants.js          # Constants và config
│   ├── App.js                    # Main app component
│   ├── App.css                   # App styles
│   ├── index.js                  # Entry point
│   └── index.css                 # Global styles
├── package.json
└── README.md
```

## 🔧 Cấu hình

### Biến môi trường

Tạo file `.env` trong thư mục `frontend`:

```env
REACT_APP_API_URL=http://localhost:2512
```

### Constants

Tất cả cấu hình được quản lý trong `src/utils/constants.js`:

```javascript
export const POLLING_CONFIG = {
  DASHBOARD_INTERVAL: 30000, // 30 giây
  GALLERY_INTERVAL: 60000,   // 60 giây
  DEVICES_INTERVAL: 30000,   // 30 giây
};
```

## 📡 API Integration

### Backend Endpoints (Real)

- `GET /api/iot/mqtt/devices` - Lấy danh sách thiết bị
- `GET /api/iot/mqtt/:id/status` - Trạng thái thiết bị
- `POST /api/iot/mqtt/:id/capture` - Chụp ảnh
- `POST /api/iot/mqtt/:id/auto-config` - Cấu hình tự động

### Mock Data (Frontend)

- **Images**: Mock data dựa trên cấu trúc thư mục uploads
- **Statistics**: Thống kê mock với 3 thiết bị
- **Devices**: Mock 3 thiết bị cam-01, cam-02, cam-03

## 🎨 Tính năng UI/UX

### Responsive Design

- **Mobile-first** approach
- **Breakpoints**: xs, sm, md, lg, xl
- **Touch-friendly** trên mobile
- **Collapsible sidebar** trên mobile

### Performance

- **Polling thông minh** với auto-refresh
- **Lazy loading** ảnh
- **Pagination** cho danh sách lớn
- **Debounce** cho tìm kiếm
- **Memoization** cho components

### User Experience

- **Loading states** mượt mà
- **Error handling** thông minh
- **Toast notifications** đẹp mắt
- **Smooth animations** 300ms
- **Intuitive navigation**

## 🔄 Polling System

### Tại sao dùng Polling thay vì WebSocket?

1. **ESP32-CAM** chỉ gửi ảnh qua HTTP POST
2. **Không có real-time data stream**
3. **Đơn giản hơn** và ổn định hơn
4. **Backend chưa có WebSocket server**

### Cấu hình Polling

```javascript
// Dashboard: 30 giây
usePolling(fetchDashboardData, POLLING_CONFIG.DASHBOARD_INTERVAL, autoRefresh);

// Gallery: 60 giây (ít cần cập nhật hơn)
usePolling(fetchImages, POLLING_CONFIG.GALLERY_INTERVAL, autoRefresh);

// Devices: 30 giây
usePolling(fetchDevices, POLLING_CONFIG.DEVICES_INTERVAL, autoRefresh);
```

## 🎯 Tính năng nổi bật

### ✨ Gallery thông minh

- **Chọn nhiều ảnh** để tải về hàng loạt
- **Preview fullscreen** với modal
- **Lọc theo thiết bị, ngày, kích thước**
- **Sắp xếp** theo nhiều tiêu chí
- **Pagination** thông minh

### 📊 Dashboard trực quan

- **Cards thống kê** đẹp mắt
- **Ảnh gần đây** với hover effects
- **Trạng thái thiết bị** real-time
- **Auto-refresh** có thể tắt

### 🎛️ Điều khiển thiết bị

- **Chụp ảnh từ xa** 1-click
- **Cấu hình auto-capture** trực quan
- **Theo dõi trạng thái** real-time
- **Thống kê hoạt động**

## 🐛 Troubleshooting

### Lỗi kết nối API

- Kiểm tra backend có đang chạy không
- Kiểm tra CORS settings
- Kiểm tra URL trong `.env`

### Performance issues

- Kiểm tra số lượng ảnh hiển thị
- Sử dụng pagination
- Tối ưu image loading

### Mock data không hiển thị

- Kiểm tra console logs
- Kiểm tra API service
- Kiểm tra constants config

## 📝 Development Notes

### Code Structure

- **Components**: Tái sử dụng cao
- **Hooks**: Logic tách biệt
- **Services**: API abstraction
- **Utils**: Constants và helpers

### Best Practices

- **Error boundaries** cho error handling
- **Loading states** cho UX tốt
- **TypeScript ready** (có thể migrate sau)
- **Accessibility** compliant

## 🚀 Deployment

### Build cho production

```bash
npm run build
```

### Serve static files

```bash
# Sử dụng serve
npx serve -s build

# Hoặc copy build/ vào web server
```

### Environment variables

```bash
# Production
REACT_APP_API_URL=https://your-api-domain.com
```

## 📄 License

MIT License - Xem file LICENSE để biết thêm chi tiết.

---

**Tạo bởi**: AI Assistant  
**Phiên bản**: 1.0.0  
**Cập nhật**: 2024
