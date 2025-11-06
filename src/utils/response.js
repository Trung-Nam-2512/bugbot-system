// Standardized response helpers
const success = (res, data = null, message = "Success", statusCode = 200) => {
    return res.status(statusCode).json({
        ok: true,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

const error = (res, message = "Error", statusCode = 500, details = null) => {
    return res.status(statusCode).json({
        ok: false,
        message,
        error: details || message,
        timestamp: new Date().toISOString()
    });
};

const notFound = (res, message = "Resource not found") => {
    return error(res, message, 404);
};

const badRequest = (res, message = "Bad request", details = null) => {
    return error(res, message, 400, details);
};

const unauthorized = (res, message = "Unauthorized") => {
    return error(res, message, 401);
};

const forbidden = (res, message = "Forbidden") => {
    return error(res, message, 403);
};

const internalError = (res, message = "Internal server error", details = null) => {
    return error(res, message, 500, details);
};

module.exports = {
    success,
    error,
    notFound,
    badRequest,
    unauthorized,
    forbidden,
    internalError
};
