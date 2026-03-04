import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Switch, Button, message, Typography, Divider, Space, Row, Col, Tag, Spin } from 'antd';
import { SaveOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { apiService } from '../services/api';
import { handleApiError } from '../utils/errorHandler';

const { Title, Text } = Typography;

const Settings = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [systemInfo, setSystemInfo] = useState({
        health: null,
        stats: null,
        loading: true
    });
    const [currentUptime, setCurrentUptime] = useState(0);
    const [uptimeInitialized, setUptimeInitialized] = useState(false);

    const handleSave = async (values) => {
        try {
            setLoading(true);
            // TODO: Implement save settings API
            console.log('Settings to save:', values);
            message.success('Cài đặt đã được lưu');
        } catch (error) {
            message.error('Lỗi khi lưu cài đặt');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        form.resetFields();
        message.info('Đã reset về cài đặt mặc định');
    };

    const fetchSystemInfo = async () => {
        try {
            setSystemInfo(prev => ({ ...prev, loading: true }));

            const [healthResponse, statsResponse] = await Promise.allSettled([
                apiService.getHealth(),
                apiService.getStats()
            ]);

            const health = healthResponse.status === 'fulfilled' ? healthResponse.value.data : null;
            const stats = statsResponse.status === 'fulfilled' ? statsResponse.value.data : null;

            setSystemInfo({
                health,
                stats,
                loading: false
            });

            // Set initial uptime nếu có
            if (health?.uptime && !uptimeInitialized) {
                setCurrentUptime(health.uptime);
                setUptimeInitialized(true);
            }
        } catch (error) {
            handleApiError(error, {
                defaultMessage: 'Không thể tải thông tin hệ thống',
                showNotification: false
            });
            setSystemInfo(prev => ({ ...prev, loading: false }));
        }
    };

    useEffect(() => {
        fetchSystemInfo();
    }, []);

    // Bộ đếm thời gian thực - cập nhật mỗi giây
    useEffect(() => {
        // Chỉ chạy nếu đã khởi tạo uptime
        if (!uptimeInitialized || currentUptime <= 0) return;

        const interval = setInterval(() => {
            setCurrentUptime(prev => prev + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [uptimeInitialized]); // Chỉ chạy khi uptimeInitialized thay đổi (từ false -> true)

    const formatUptime = (seconds) => {
        if (!seconds || seconds <= 0) return '0 giây';
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const parts = [];
        if (days > 0) parts.push(`${days} ngày`);
        if (hours > 0) parts.push(`${hours} giờ`);
        if (minutes > 0) parts.push(`${minutes} phút`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs} giây`);

        return parts.join(' ');
    };

    const getEnvironment = () => {
        if (typeof window !== 'undefined') {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return { text: 'Development', color: 'blue' };
            }
            return { text: 'Production', color: 'green' };
        }
        return { text: 'Unknown', color: 'default' };
    };

    return (
        <div>
            <Title level={2}>Cài đặt hệ thống</Title>

            <Row gutter={[24, 24]}>
                <Col xs={24} lg={12}>
                    <Card title="Cài đặt chung" className="device-card">
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleSave}
                            initialValues={{
                                autoRefresh: true,
                                refreshInterval: 30,
                                maxImagesPerPage: 12,
                                enableNotifications: true,
                                enableSound: false
                            }}
                        >
                            <Form.Item
                                name="autoRefresh"
                                label="Tự động làm mới"
                                valuePropName="checked"
                            >
                                <Switch />
                            </Form.Item>

                            <Form.Item
                                name="refreshInterval"
                                label="Chu kỳ làm mới (giây)"
                                rules={[{ required: true, message: 'Vui lòng nhập chu kỳ làm mới' }]}
                            >
                                <Input type="number" min={5} max={300} />
                            </Form.Item>

                            <Form.Item
                                name="maxImagesPerPage"
                                label="Số ảnh mỗi trang"
                                rules={[{ required: true, message: 'Vui lòng nhập số ảnh mỗi trang' }]}
                            >
                                <Input type="number" min={6} max={50} />
                            </Form.Item>

                            <Divider />

                            <Form.Item
                                name="enableNotifications"
                                label="Bật thông báo"
                                valuePropName="checked"
                            >
                                <Switch />
                            </Form.Item>

                            <Form.Item
                                name="enableSound"
                                label="Bật âm thanh thông báo"
                                valuePropName="checked"
                            >
                                <Switch />
                            </Form.Item>

                            <Form.Item>
                                <Space>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        icon={<SaveOutlined />}
                                        loading={loading}
                                    >
                                        Lưu cài đặt
                                    </Button>
                                    <Button
                                        icon={<ReloadOutlined />}
                                        onClick={handleReset}
                                    >
                                        Reset
                                    </Button>
                                </Space>
                            </Form.Item>
                        </Form>
                    </Card>
                </Col>

                <Col xs={24} lg={12}>
                    <Card
                        title="Thông tin hệ thống"
                        className="device-card"
                        extra={
                            <Button
                                size="small"
                                icon={<ReloadOutlined />}
                                onClick={fetchSystemInfo}
                                loading={systemInfo.loading}
                            >
                                Làm mới
                            </Button>
                        }
                    >
                        <Spin spinning={systemInfo.loading}>
                            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                <div>
                                    <Text strong>Phiên bản:</Text>
                                    <Text style={{ marginLeft: 8 }}>1.0.0</Text>
                                </div>

                                <div>
                                    <Text strong>Môi trường:</Text>
                                    <Tag color={getEnvironment().color} style={{ marginLeft: 8 }}>
                                        {getEnvironment().text}
                                    </Tag>
                                </div>

                                <Divider />

                                {/* <div>
                                    <Text strong>Trạng thái hệ thống:</Text>
                                    {systemInfo.health ? (
                                        <Tag
                                            color="success"
                                            style={{ marginLeft: 8 }}
                                        >
                                            Hoạt động bình thường
                                        </Tag>
                                    ) : (
                                        <Text style={{ marginLeft: 8, color: '#999' }}>Đang kiểm tra...</Text>
                                    )}
                                </div>

                                <div>
                                    <Text strong>Thời gian hoạt động:</Text>
                                    {currentUptime > 0 ? (
                                        <Text style={{ marginLeft: 8, fontFamily: 'monospace', color: '#1890ff' }}>
                                            {formatUptime(currentUptime)}
                                        </Text>
                                    ) : systemInfo.health?.uptime ? (
                                        <Text style={{ marginLeft: 8 }}>
                                            {formatUptime(systemInfo.health.uptime)}
                                        </Text>
                                    ) : (
                                        <Text style={{ marginLeft: 8, color: '#999' }}>Đang tải...</Text>
                                    )}
                                </div> */}

                                {systemInfo.stats && (
                                    <>
                                        <Divider />
                                        <div>
                                            <Text strong>Thống kê hệ thống:</Text>
                                        </div>
                                        <div style={{ marginLeft: 16 }}>
                                            <Text type="secondary">• Tổng thiết bị: </Text>
                                            <Text strong>{systemInfo.stats.totalDevices || 0}</Text>
                                        </div>
                                        <div style={{ marginLeft: 16 }}>
                                            <Text type="secondary">• Thiết bị online: </Text>
                                            <Text strong style={{ color: '#52c41a' }}>
                                                {systemInfo.stats.onlineDevices || 0}
                                            </Text>
                                        </div>
                                        <div style={{ marginLeft: 16 }}>
                                            <Text type="secondary">• Tổng ảnh: </Text>
                                            <Text strong>{systemInfo.stats.totalImages || 0}</Text>
                                        </div>
                                        <div style={{ marginLeft: 16 }}>
                                            <Text type="secondary">• Ảnh hôm nay: </Text>
                                            <Text strong style={{ color: '#1890ff' }}>
                                                {systemInfo.stats.todayImages || 0}
                                            </Text>
                                        </div>
                                    </>
                                )}

                                {systemInfo.health?.services && (
                                    <>
                                        <Divider />
                                        <div>
                                            <Text strong>Dịch vụ:</Text>
                                        </div>
                                        {Object.entries(systemInfo.health.services || {}).map(([service, info]) => {
                                            const isHealthy = typeof info === 'object' ? info.healthy : info === 'ok';
                                            const label = typeof info === 'object' ? info.status : (info || 'unknown');
                                            return (
                                                <div key={service} style={{ marginLeft: 16 }}>
                                                    <Text type="secondary">• {service}: </Text>
                                                    <Tag color={isHealthy ? 'success' : 'error'} size="small">
                                                        {label}
                                                    </Tag>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </Space>
                        </Spin>
                    </Card>
                </Col>
            </Row>

            <Card title="Hỗ trợ" style={{ marginTop: 24 }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Text>
                        <strong>Hướng dẫn sử dụng:</strong>
                    </Text>
                    <ul>
                        <li>Dashboard: Xem tổng quan hệ thống và ảnh gần đây</li>
                        <li>Thư viện ảnh: Xem, tải về và quản lý tất cả ảnh</li>
                        <li>Quản lý thiết bị: Điều khiển và cấu hình ESP32-CAM</li>
                        <li>Cài đặt: Tùy chỉnh giao diện và hành vi hệ thống</li>
                    </ul>

                    <Text>
                        <strong>Liên hệ hỗ trợ:</strong>
                    </Text>
                    <Text>Email: trungnampyag@gmail.com | Phone: 0876981779</Text>
                </Space>
            </Card>
        </div>
    );
};

export default Settings;
