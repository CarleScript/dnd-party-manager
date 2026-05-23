export const sendError = (callback, message) => {
    if (typeof callback === 'function') {
        callback({ status: 'error', message });
    }
};

export const sendSuccess = (callback, data = {}) => {
    if (typeof callback === 'function') {
        callback({ status: 'ok', ...data });
    }
};