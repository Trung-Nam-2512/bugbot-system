import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import AppHeader from './components/AppHeader';
import AppSider from './components/AppSider';
import Dashboard from './pages/Dashboard';
import ImageGallery from './pages/ImageGallery';
import DeviceManagement from './pages/DeviceManagement';
import DeviceDetail from './pages/DeviceDetail';
import Settings from './pages/Settings';
import './App.css';

const { Content } = Layout;

function App() {
    return (
        <Layout style={{ minHeight: '100vh' }}>
            <AppSider />
            <Layout>
                <AppHeader />
                <Content className="dashboard-content">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/gallery" element={<ImageGallery />} />
                        <Route path="/devices" element={<DeviceManagement />} />
                        <Route path="/devices/:id" element={<DeviceDetail />} />
                        <Route path="/settings" element={<Settings />} />
                    </Routes>
                </Content>
            </Layout>
        </Layout>
    );
}

export default App;
