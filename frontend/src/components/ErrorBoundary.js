import React from 'react';
import { Result, Button } from 'antd';
import { ReloadOutlined, HomeOutlined } from '@ant-design/icons';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo
        });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    minHeight: '60vh',
                    padding: '20px'
                }}>
                    <Result
                        status="500"
                        title="Đã xảy ra lỗi"
                        subTitle="Xin lỗi, đã xảy ra lỗi không mong muốn. Vui lòng thử lại."
                        extra={[
                            <Button 
                                type="primary" 
                                key="reload"
                                icon={<ReloadOutlined />}
                                onClick={this.handleReset}
                            >
                                Tải lại trang
                            </Button>,
                            <Button 
                                key="home"
                                icon={<HomeOutlined />}
                                onClick={() => window.location.href = '/'}
                            >
                                Về trang chủ
                            </Button>
                        ]}
                    >
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div style={{ 
                                marginTop: 20, 
                                padding: 16, 
                                background: '#f5f5f5', 
                                borderRadius: 4,
                                textAlign: 'left',
                                maxHeight: 300,
                                overflow: 'auto'
                            }}>
                                <pre style={{ margin: 0, fontSize: 12 }}>
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </div>
                        )}
                    </Result>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;







