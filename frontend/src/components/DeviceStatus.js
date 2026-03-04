import React from 'react';
import { Card, Typography, List, Button, Space, message } from 'antd';
import { CameraOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import StatusBadge from './StatusBadge';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Text } = Typography;

const DeviceStatus = ({ devices }) => {
    const navigate = useNavigate();

    const handleCapture = async (deviceId) => {
        try {
            await apiService.capturePhoto(deviceId);
            message.success(`Da gui lenh chup anh den ${deviceId}`);
        } catch {
            message.error('Khong the gui lenh chup anh');
        }
    };

    return (
        <Card
            title={<Title level={4} style={{ margin: 0 }}>Trang thai thiet bi</Title>}
            className="device-card"
        >
            <List
                dataSource={devices}
                renderItem={(device) => (
                    <List.Item
                        actions={[
                            <Button
                                type="primary" size="small" icon={<PlayCircleOutlined />}
                                onClick={() => handleCapture(device.deviceId)}
                                key="capture"
                            >
                                Chup
                            </Button>,
                        ]}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/devices/${device.deviceId}`)}
                    >
                        <List.Item.Meta
                            avatar={<CameraOutlined style={{ fontSize: 20, color: device.online ? '#52c41a' : '#d9d9d9' }} />}
                            title={
                                <Space>
                                    <Text strong>{device.deviceId}</Text>
                                    <StatusBadge device={device} />
                                </Space>
                            }
                            description={
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {device.lastSeenAt ? dayjs(device.lastSeenAt).fromNow() : 'Chua ket noi'}
                                    {device.firmware && ` | FW ${device.firmware}`}
                                </Text>
                            }
                        />
                    </List.Item>
                )}
            />
        </Card>
    );
};

export default DeviceStatus;
