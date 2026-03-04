import { message, notification } from 'antd';

/**
 * Hiển thị error message dựa trên error object từ API
 * @param {Error} error - Error object từ axios
 * @param {Object} options - Options cho error handling
 * @param {boolean} options.showNotification - Có hiển thị notification không (default: true)
 * @param {string} options.defaultMessage - Message mặc định nếu không có error message
 * @param {Function} options.onError - Callback khi có error
 */
export const handleApiError = (error, options = {}) => {
    const {
        showNotification = true,
        defaultMessage = 'Đã xảy ra lỗi',
        onError
    } = options;

    const errorInfo = error?.errorInfo || {
        title: 'Lỗi',
        message: error?.message || defaultMessage,
        type: 'unknown'
    };

    // Log error trong development
    if (process.env.NODE_ENV === 'development') {
        console.error('[Error Handler]', errorInfo, error);
    }

    // Callback nếu có
    if (onError) {
        onError(error, errorInfo);
    }

    // Hiển thị notification nếu được yêu cầu
    if (showNotification) {
        // Sử dụng notification cho các lỗi quan trọng
        if (errorInfo.type === 'server_error' || errorInfo.type === 'server_unavailable') {
            notification.error({
                message: errorInfo.title,
                description: errorInfo.message,
                duration: 5,
                placement: 'topRight'
            });
        } else {
            // Sử dụng message cho các lỗi thông thường
            message.error(errorInfo.message, 3);
        }
    }

    return errorInfo;
};

/**
 * Tạo retry function cho API calls
 * @param {Function} apiCall - Function gọi API
 * @param {number} maxRetries - Số lần retry tối đa (default: 3)
 * @param {number} delay - Delay giữa các lần retry (ms, default: 1000)
 */
export const withRetry = async (apiCall, maxRetries = 3, delay = 1000) => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            lastError = error;
            
            // Không retry cho một số lỗi
            const errorInfo = error?.errorInfo || {};
            if (errorInfo.type === 'bad_request' || 
                errorInfo.type === 'unauthorized' || 
                errorInfo.type === 'forbidden' ||
                errorInfo.type === 'not_found') {
                throw error;
            }
            
            // Nếu chưa hết số lần retry
            if (attempt < maxRetries) {
                const waitTime = delay * Math.pow(2, attempt); // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} after ${waitTime}ms`);
                }
            }
        }
    }
    
    throw lastError;
};

/**
 * Format error message cho user-friendly display
 */
export const formatErrorMessage = (error) => {
    if (!error) return 'Đã xảy ra lỗi không xác định';
    
    const errorInfo = error?.errorInfo || {};
    return errorInfo.message || error.message || 'Đã xảy ra lỗi';
};







