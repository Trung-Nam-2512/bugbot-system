import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <BrowserRouter>
                <ConfigProvider locale={viVN}>
                    <App />
                </ConfigProvider>
            </BrowserRouter>
        </ErrorBoundary>
    </React.StrictMode>
);
