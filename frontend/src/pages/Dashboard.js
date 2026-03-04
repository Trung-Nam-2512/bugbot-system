import React, { useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Switch, Button, Space, message } from 'antd';
import {
    CameraOutlined, PictureOutlined, CheckCircleOutlined,
    ReloadOutlined, WarningOutlined, SendOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import useDevices from '../hooks/useDevices';
import useSSE from '../hooks/useSSE';
import DeviceCard from '../components/DeviceCard';
import EventFeed from '../components/EventFeed';
import RecentImages from '../components/RecentImages';
import { handleApiError } from '../utils/errorHandler';
import { DashboardSkeleton } from '../components/LoadingSkeleton';

const { Title } = Typography;

const Dashboard = () => {
    const [autoRefresh, setAutoRefresh] = useState(true);
    const { devices, counts, loading, refresh } = useDevices(autoRefresh); // Tạm giữ cập nhật Device List 10s/lần
    const { events, connected, error } = useSSE(); // NEW: Realtime SSE events (No polling)
    const navigate = useNavigate();

    const handleCapture = async (deviceId) => {
        try {
            await apiService.capturePhoto(deviceId);
            message.success(`Da gui lenh chup anh den ${deviceId}`);
        } catch (error) {
            handleApiError(error, { defaultMessage: 'Khong the gui lenh chup anh' });
        }
    };

    const handleBroadcastCapture = async () => {
        try {
            await apiService.broadcastCapture();
            message.success('Da gui lenh chup anh den tat ca thiet bi');
        } catch (error) {
            handleApiError(error, { defaultMessage: 'Khong the gui broadcast' });
        }
    };

    if (loading && devices.length === 0) {
        return <DashboardSkeleton />;
    }

    return (
        <div>
            {/* Page header */}
            <div className="page-header">
                <Title level={2} style={{ margin: 0 }}>Tong quan he thong</Title>
                <Space>
                    <Button icon={<SendOutlined />} onClick={handleBroadcastCapture}>
                        Capture All
                    </Button>
                    <Switch
                        checked={connected}
                        disabled
                        checkedChildren="SSE On"
                        unCheckedChildren="Offline"
                    />
                    <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
                        Lam moi
                    </Button>
                </Space>
            </div>

            {/* Stats cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="stats-card">
                        <Statistic
                            title="Tong thiet bi"
                            value={counts.total}
                            prefix={<CameraOutlined style={{ color: '#1890ff' }} />}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="stats-card">
                        <Statistic
                            title="Online"
                            value={counts.online}
                            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="stats-card">
                        <Statistic
                            title="Offline"
                            value={counts.offline}
                            prefix={<PictureOutlined style={{ color: '#ff4d4f' }} />}
                            valueStyle={{ color: '#ff4d4f' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="stats-card">
                        <Statistic
                            title="Stale"
                            value={counts.stale}
                            prefix={<WarningOutlined style={{ color: '#faad14' }} />}
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Device grid + Event feed */}
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                    <Title level={4} style={{ marginBottom: 16 }}>Thiet bi</Title>
                    {devices.length === 0 ? (
                        <Card><p style={{ textAlign: 'center', color: '#999' }}>Chua co thiet bi nao</p></Card>
                    ) : (
                        <Row gutter={[12, 12]}>
                            {devices.map((device) => (
                                <Col xs={24} sm={12} xl={8} key={device.deviceId}>
                                    <DeviceCard
                                        device={device}
                                        onCapture={handleCapture}
                                        onDetail={(id) => navigate(`/devices/${id}`)}
                                    />
                                </Col>
                            ))}
                        </Row>
                    )}
                </Col>

                <Col xs={24} lg={8}>
                    <EventFeed events={events} title="Event Feed" maxHeight={520} />
                </Col>
            </Row>
        </div>
    );
};

export default Dashboard;
