const isProd = process.env.NODE_ENV === "production";

export const logger = {
    info: (message, meta = {}) => {
        console.log(`[INFO] [${new Date().toISOString()}] ${message}`, isProd ? JSON.stringify(meta) : meta);
    },
    warn: (message, meta = {}) => {
        console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, isProd ? JSON.stringify(meta) : meta);
    },
    error: (message, error = {}) => {
        console.error(
            `[ERROR] [${new Date().toISOString()}] ${message}`,
            error?.stack || error?.message || error
        );
    },
    debug: (message, meta = {}) => {
        if (!isProd) {
            console.log(`[DEBUG] [${new Date().toISOString()}] ${message}`, meta);
        }
    },
};

export default logger;
