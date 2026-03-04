import React from 'react';
import { Card, Typography, Row, Col, Image, Button, Space, Tag } from 'antd';
import { DownloadOutlined, EyeOutlined, CalendarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const RecentImages = ({ images }) => {
    const navigate = useNavigate();

    const handleDownload = (image) => {
        const link = document.createElement('a');
        link.href = image.url;
        link.download = image.filename || `image_${image.id}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleViewImage = (image) => {
        // Open image in new tab
        window.open(image.url, '_blank');
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('vi-VN');
    };

    return (
        <Card
            title={
                <Space>
                    <Title level={4} style={{ margin: 0 }}>Ảnh gần đây</Title>
                    <Button
                        type="link"
                        onClick={() => navigate('/gallery')}
                        style={{ padding: 0 }}
                    >
                        Xem tất cả
                    </Button>
                </Space>
            }
            className="image-gallery"
        >
            {images.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Text type="secondary">Chưa có ảnh nào</Text>
                </div>
            ) : (
                <Row gutter={[16, 16]}>
                    {images.map((image) => (
                        <Col xs={24} sm={12} md={8} key={image.id}>
                            <Card
                                className="image-card"
                                hoverable
                                cover={
                                    <div style={{ position: 'relative' }}>
                                        <Image
                                            src={image.url}
                                            alt={image.filename}
                                            style={{ height: 200, objectFit: 'cover' }}
                                            preview={false}
                                        />
                                        <div style={{ position: 'absolute', top: 8, right: 8 }}>
                                            <Space>
                                                <Button
                                                    type="primary"
                                                    size="small"
                                                    icon={<EyeOutlined />}
                                                    onClick={() => handleViewImage(image)}
                                                />
                                                <Button
                                                    size="small"
                                                    icon={<DownloadOutlined />}
                                                    onClick={() => handleDownload(image)}
                                                />
                                            </Space>
                                        </div>
                                    </div>
                                }
                            >
                                <Card.Meta
                                    title={
                                        <Text ellipsis style={{ fontSize: '14px' }}>
                                            {image.filename || `Image ${image.id}`}
                                        </Text>
                                    }
                                    description={
                                        <Space direction="vertical" size={4}>
                                            <Space>
                                                <CalendarOutlined />
                                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                                    {formatDate(image.createdAt)}
                                                </Text>
                                            </Space>
                                            <Space>
                                                <Tag color="blue" size="small">
                                                    {image.deviceId}
                                                </Tag>
                                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                                    {image.size ? `${(image.size / 1024).toFixed(1)} KB` : ''}
                                                </Text>
                                            </Space>
                                        </Space>
                                    }
                                />
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}
        </Card>
    );
};

export default RecentImages;
