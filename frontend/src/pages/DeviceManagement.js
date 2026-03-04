import React, { useState } from 'react';
import {
    Card, Table, Button, Space, Typography, Modal, Form,
    InputNumber, Switch, message, Row, Col, Statistic,
} from 'antd';
import {
    CameraOutlined, PlayCircleOutlined, SettingOutlined,
    ReloadOutlined, DeleteOutlined, SendOutlined, InfoCircleOutlined,
    PoweroffOutlined, SyncOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import useDevices from '../hooks/useDevices';
import StatusBadge from '../components/StatusBadge';
import { handleApiError, formatErrorMessage } from '../utils/errorHandler';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title } = Typography;

const DeviceManagement = () => {
    const [autoRefresh, setAutoRefresh] = useState(true);
    const { devices, counts, loading, refresh } = useDevices(autoRefresh);
    const [configModalVisible, setConfigModalVisible] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [form] = Form.useForm();
    const navigate = useNavigate();

    const sendCmd = async (deviceId, label, apiFn) => {
        try {
            await apiFn();
            message.success(`"${label}" gui den ${deviceId}`);
        } catch (error) {
            message.error(formatErrorMessage(error));
        }
    };

    const handleConfig = (device) => {
        setSelectedDevice(device);
        form.setFieldsValue({
            autoEnabled: device.autoMode || false,
            intervalSeconds: device.intervalSec || 30,
        });
        setConfigModalVisible(true);
    };

    const handleConfigSubmit = async (values) => {
        try {
            await apiService.setAutoConfig(selectedDevice.deviceId, values.autoEnabled, values.intervalSeconds);
            message.success('Cap nhat cau hinh thanh cong');
            setConfigModalVisible(false);
            refresh();
        } catch (error) {
            message.error(formatErrorMessage(error));
        }
    };

    const handleDelete = (device) => {
        Modal.confirm({
            title: 'Xac nhan xoa thiet bi',
            content: (
                <div>
                    <p>Ban co chac chan muon xoa thiet bi <strong>{device.deviceId}</strong>?</p>
                    <p style={{ color: '#ff4d4f' }}>Hanh dong nay khong the hoan tac.</p>
                </div>
            ),
            okText: 'Xoa', okType: 'danger', cancelText: 'Huy',
            onOk: async () => {
                try {
                    await apiService.deleteDevice(device.deviceId);
                    message.success(`Da xoa ${device.deviceId}`);
                    refresh();
                } catch (error) {
                    handleApiError(error, { defaultMessage: 'Khong the xoa thiet bi' });
                }
            },
        });
    };

    const columns = [
        {
            title: 'Thiet bi',
            dataIndex: 'deviceId',
            key: 'deviceId',
            render: (text) => (
                <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/devices/${text}`)}>
                    <CameraOutlined style={{ marginRight: 6 }} />{text}
                </Button>
            ),
        },
        {
            title: 'Trang thai',
            key: 'status',
            width: 110,
            render: (_, record) => <StatusBadge device={record} />,
        },
        {
            title: 'Firmware',
            dataIndex: 'firmware',
            key: 'firmware',
            width: 90,
            render: (fw) => fw || '-',
        },
        {
            title: 'IP',
            dataIndex: 'ip',
            key: 'ip',
            width: 130,
            render: (ip) => ip || '-',
        },
        {
            title: 'Uptime',
            dataIndex: 'uptime',
            key: 'uptime',
            width: 90,
            render: (val) => {
                if (val == null) return '-';
                const h = Math.floor(val / 3600);
                const m = Math.floor((val % 3600) / 60);
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
            },
        },
        {
            title: 'Lan cuoi',
            dataIndex: 'lastSeenAt',
            key: 'lastSeenAt',
            width: 130,
            render: (date) => date ? dayjs(date).fromNow() : '-',
        },
        {
            title: 'Hanh dong',
            key: 'actions',
            width: 320,
            render: (_, record) => (
                <Space size={4} wrap>
                    <Button size="small" type="primary" icon={<PlayCircleOutlined />}
                        onClick={() => sendCmd(record.deviceId, 'capture', () => apiService.capturePhoto(record.deviceId))}>
                        Chup
                    </Button>
                    <Button size="small" icon={<SyncOutlined />}
                        onClick={() => sendCmd(record.deviceId, 'ota_check', () => apiService.otaCheck(record.deviceId))}>
                        OTA
                    </Button>
                    <Button size="small" icon={<SettingOutlined />} onClick={() => handleConfig(record)}>
                        Config
                    </Button>
                    <Button size="small" icon={<InfoCircleOutlined />} onClick={() => navigate(`/devices/${record.deviceId}`)}>
                        Chi tiet
                    </Button>
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
                </Space>
            ),
        },
    ];

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <Title level={2} style={{ margin: 0 }}>Quan ly thiet bi</Title>
                <Space>
                    <Button icon={<SendOutlined />}
                        onClick={() => sendCmd('all', 'broadcast capture', () => apiService.broadcastCapture())}>
                        Capture All
                    </Button>
                    <Switch checked={autoRefresh} onChange={setAutoRefresh} checkedChildren="Auto" unCheckedChildren="Manual" />
                    <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>Lam moi</Button>
                </Space>
            </div>

            {/* Stats */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card className="stats-card">
                        <Statistic title="Tong thiet bi" value={counts.total} prefix={<CameraOutlined />} valueStyle={{ color: '#1890ff' }} />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card className="stats-card">
                        <Statistic title="Online" value={counts.online} prefix={<PlayCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card className="stats-card">
                        <Statistic
                            title="Ty le online"
                            value={counts.total > 0 ? ((counts.online / counts.total) * 100).toFixed(1) : 0}
                            suffix="%" valueStyle={{ color: '#722ed1' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Table */}
            <Card>
                <Table
                    columns={columns}
                    dataSource={devices}
                    rowKey="deviceId"
                    loading={loading}
                    pagination={{
                        pageSize: 10, showSizeChanger: true, showQuickJumper: true,
                        showTotal: (total, range) => `${range[0]}-${range[1]} cua ${total} thiet bi`,
                    }}
                    onRow={(record) => ({
                        onClick: () => navigate(`/devices/${record.deviceId}`),
                        style: { cursor: 'pointer' },
                    })}
                    size="middle"
                />
            </Card>

            {/* Config modal */}
            <Modal
                title={`Cau hinh ${selectedDevice?.deviceId}`}
                open={configModalVisible}
                onCancel={() => setConfigModalVisible(false)}
                onOk={() => form.submit()}
                width={420}
            >
                <Form form={form} layout="vertical" onFinish={handleConfigSubmit}>
                    <Form.Item name="autoEnabled" label="Tu dong chup" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                    <Form.Item
                        name="intervalSeconds" label="Chu ky chup (giay)"
                        rules={[
                            { required: true, message: 'Nhap chu ky' },
                            { type: 'number', min: 3, max: 3600, message: '3 - 3600 giay' },
                        ]}
                    >
                        <InputNumber min={3} max={3600} style={{ width: '100%' }} addonAfter="giay" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default DeviceManagement;
