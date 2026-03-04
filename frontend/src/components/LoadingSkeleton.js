import React from 'react';
import { Skeleton, Card, Row, Col } from 'antd';

/**
 * Skeleton loader cho Dashboard
 */
export const DashboardSkeleton = () => (
    <div>
        <Skeleton active paragraph={{ rows: 1 }} style={{ marginBottom: 24 }} />
        
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {[1, 2, 3, 4].map(i => (
                <Col xs={24} sm={12} lg={6} key={i}>
                    <Card>
                        <Skeleton active paragraph={{ rows: 0 }} />
                    </Card>
                </Col>
            ))}
        </Row>

        <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
                <Card>
                    <Skeleton active avatar paragraph={{ rows: 4 }} />
                </Card>
            </Col>
            <Col xs={24} lg={8}>
                <Card>
                    <Skeleton active paragraph={{ rows: 6 }} />
                </Card>
            </Col>
        </Row>
    </div>
);

/**
 * Skeleton loader cho Image Gallery
 */
export const ImageGallerySkeleton = () => (
    <div>
        <Skeleton active paragraph={{ rows: 1 }} style={{ marginBottom: 16 }} />
        <Card style={{ marginBottom: 16 }}>
            <Skeleton active paragraph={{ rows: 1 }} />
        </Card>
        <Row gutter={[16, 16]}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
                <Col xs={24} sm={12} md={8} lg={6} key={i}>
                    <Card>
                        <Skeleton.Image active style={{ width: '100%', height: 200 }} />
                        <Skeleton active paragraph={{ rows: 2 }} style={{ marginTop: 16 }} />
                    </Card>
                </Col>
            ))}
        </Row>
    </div>
);

/**
 * Skeleton loader cho Device Management Table
 */
export const DeviceTableSkeleton = () => (
    <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
    </Card>
);

/**
 * Skeleton loader cho Statistics Cards
 */
export const StatsSkeleton = () => (
    <Row gutter={16}>
        {[1, 2, 3].map(i => (
            <Col span={8} key={i}>
                <Card>
                    <Skeleton active paragraph={{ rows: 0 }} />
                </Card>
            </Col>
        ))}
    </Row>
);

export default {
    Dashboard: DashboardSkeleton,
    ImageGallery: ImageGallerySkeleton,
    DeviceTable: DeviceTableSkeleton,
    Stats: StatsSkeleton
};







