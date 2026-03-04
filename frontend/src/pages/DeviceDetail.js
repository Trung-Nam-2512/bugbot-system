import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card, Typography, Descriptions, Button, Space, Row, Col,
    Switch, InputNumber, message, Divider, Result, Spin, Tag, Progress,
} from 'antd';
import {
    ArrowLeftOutlined, CameraOutlined, ReloadOutlined,
    PoweroffOutlined, SyncOutlined, CloudUploadOutlined,
    WifiOutlined, SettingOutlined,
} from '@ant-design/icons';
import { apiService } from '../services/api';
import useDeviceDetail from '../hooks/useDeviceDetail';
import StatusBadge from '../components/StatusBadge';
import EventFeed from '../components/EventFeed';
import { handleApiError } from '../utils/errorHandler';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Text } = Typography;

const DeviceDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { device, events, loading, error, refresh } = useDeviceDetail(id);

    const [cmdLoading, setCmdLoading] = useState({});
    const [autoEnabled, setAutoEnabled] = useState(false);
    const [intervalSec, setIntervalSec] = useState(30);

    // Sync auto config when device loads
    React.useEffect(() => {
        if (device) {
            setAutoEnabled(device.autoMode || false);
            setIntervalSec(device.intervalSec || 30);
        }
    }, [device]);

    const sendCommand = async (name, apiFn) => {
        setCmdLoading((prev) => ({ ...prev, [name]: true }));
        try {
            await apiFn();
            message.success(`Lenh "${name}" da gui thanh cong`);
            setTimeout(refresh, 1000);
        } catch (err) {
            handleApiError(err, { defaultMessage: `Khong the gui lenh "${name}"` });
        } finally {
            setCmdLoading((prev) => ({ ...prev, [name]: false }));
        }
    };

    const handleAutoConfig = async () => {
        setCmdLoading((prev) => ({ ...prev, autoConfig: true }));
        try {
            await apiService.setAutoConfig(id, autoEnabled, intervalSec);
            message.success('Cau hinh auto da cap nhat');
        } catch (err) {
            handleApiError(err, { defaultMessage: 'Khong the cap nhat cau hinh' });
        } finally {
            setCmdLoading((prev) => ({ ...prev, autoConfig: false }));
        }
    };

    if (loading && !device) {
        return <div style={{ textAlign: 'center', paddingTop: 100 }}><Spin size="large" /></div>;
    }

    if (error || !device) {
        return (
            <Result
                status="404"
                title="Khong tim thay thiet bi"
                subTitle={`Thiet bi "${id}" khong ton tai trong he thong.`}
                extra={<Button type="primary" onClick={() => navigate('/devices')}>Quay lai</Button>}
            />
        );
    }

    const otaEvents = events.filter((e) => e.category === 'ota');
    const latestOta = otaEvents.length > 0 ? otaEvents[0] : null;
    const otaProgress = latestOta?.payload?.pct;

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/devices')} />
                    <CameraOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                    <Title level={3} style={{ margin: 0 }}>{device.deviceId}</Title>
                    <StatusBadge device={device} />
                </Space>
                <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>Lam moi</Button>
            </div>

            <Row gutter={[16, 16]}>
                {/* Info panel */}
                <Col xs={24} lg={14}>
                    <Card title="Thong tin thiet bi" size="small">
                        <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
                            <Descriptions.Item label="Device ID">{device.deviceId}</Descriptions.Item>
                            <Descriptions.Item label="Trang thai">
                                <StatusBadge device={device} />
                            </Descriptions.Item>
                            <Descriptions.Item label="Firmware">
                                <Tag color="blue">{device.firmware || 'N/A'}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="IP">{device.ip || 'N/A'}</Descriptions.Item>
                            <Descriptions.Item label="SSID">
                                <Space><WifiOutlined />{device.ssid || 'N/A'}</Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Free Heap">
                                {device.heap != null ? `${(device.heap / 1024).toFixed(1)} KB` : 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Uptime">
                                {device.uptime != null ? formatUptime(device.uptime) : 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Anh da chup">{device.imageCount || 0}</Descriptions.Item>
                            <Descriptions.Item label="Lan cuoi thay">
                                {device.lastSeenAt ? dayjs(device.lastSeenAt).fromNow() : 'Chua biet'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Online tu">
                                {device.onlineSince ? dayjs(device.onlineSince).format('DD/MM/YYYY HH:mm') : 'N/A'}
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>

                    {/* Control panel */}
                    <Card title="Dieu khien" size="small" style={{ marginTop: 16 }}>
                        <Space wrap>
                            <Button
                                type="primary"
                                icon={<CameraOutlined />}
                                loading={cmdLoading.capture}
                                onClick={() => sendCommand('capture', () => apiService.capturePhoto(id))}
                            >
                                Chup anh
                            </Button>
                            <Button
                                icon={<SyncOutlined />}
                                loading={cmdLoading.status}
                                onClick={() => sendCommand('status', () => apiService.requestStatus(id))}
                            >
                                Request Status
                            </Button>
                            <Button
                                icon={<ReloadOutlined />}
                                loading={cmdLoading.restartCamera}
                                onClick={() => sendCommand('restart_camera', () => apiService.restartCamera(id))}
                            >
                                Restart Camera
                            </Button>
                            <Button
                                danger
                                icon={<PoweroffOutlined />}
                                loading={cmdLoading.reset}
                                onClick={() => sendCommand('reset', () => apiService.resetDevice(id))}
                            >
                                Reset ESP
                            </Button>
                        </Space>
                    </Card>

                    {/* Auto config */}
                    <Card title={<Space><SettingOutlined /> Cau hinh Auto Capture</Space>} size="small" style={{ marginTop: 16 }}>
                        <Space align="center" wrap>
                            <Text>Auto:</Text>
                            <Switch checked={autoEnabled} onChange={setAutoEnabled} />
                            <Divider type="vertical" />
                            <Text>Interval:</Text>
                            <InputNumber
                                min={3} max={3600}
                                value={intervalSec}
                                onChange={setIntervalSec}
                                addonAfter="giay"
                                style={{ width: 140 }}
                            />
                            <Button
                                type="primary"
                                loading={cmdLoading.autoConfig}
                                onClick={handleAutoConfig}
                            >
                                Luu
                            </Button>
                        </Space>
                    </Card>

                    {/* OTA */}
                    <Card title={<Space><CloudUploadOutlined /> OTA Firmware</Space>} size="small" style={{ marginTop: 16 }}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Space>
                                <Button
                                    icon={<SyncOutlined />}
                                    loading={cmdLoading.otaCheck}
                                    onClick={() => sendCommand('ota_check', () => apiService.otaCheck(id))}
                                >
                                    Check Update
                                </Button>
                                <Button
                                    type="primary"
                                    icon={<CloudUploadOutlined />}
                                    loading={cmdLoading.otaUpdate}
                                    onClick={() => sendCommand('ota_update', () => apiService.otaUpdate(id))}
                                >
                                    Update Firmware
                                </Button>
                            </Space>
                            {latestOta && (
                                <div style={{ marginTop: 8 }}>
                                    <Text type="secondary">
                                        Latest OTA event: <Tag>{latestOta.type}</Tag>
                                        {dayjs(latestOta.ts).fromNow()}
                                    </Text>
                                    {typeof otaProgress === 'number' && (
                                        <Progress percent={otaProgress} status="active" style={{ marginTop: 8 }} />
                                    )}
                                </div>
                            )}
                        </Space>
                    </Card>
                </Col>

                {/* Event timeline */}
                <Col xs={24} lg={10}>
                    <EventFeed
                        events={events}
                        title={`Events - ${device.deviceId}`}
                        maxHeight={700}
                        showDevice={false}
                    />
                </Col>
            </Row>
        </div>
    );
};

function formatUptime(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
}

export default DeviceDetail;
