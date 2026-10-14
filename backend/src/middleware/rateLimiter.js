import config from "../core/config.js";

export function createRateLimiter(options = {}) {
    const hits = options.hitsMap || new Map();
    const windowMs = options.windowMs ?? config.rateLimit.windowMs;
    const maxRequests = options.maxRequests ?? config.rateLimit.maxRequests;
    const message = options.message || "Rate limit exceeded. Please try again later.";

    const limiter = async function (req, reply) {
        const rawIp = req.headers["x-forwarded-for"] || req.ip || "127.0.0.1";
        const ip = (typeof rawIp === "string" ? rawIp.split(",")[0] : rawIp).trim();
        const now = Date.now();

        if (!hits.has(ip)) {
            hits.set(ip, []);
        }

        const timestamps = hits.get(ip).filter((time) => now - time < windowMs);
        timestamps.push(now);
        hits.set(ip, timestamps);

        if (timestamps.length > maxRequests) {
            return reply.code(429).send({
                error: "Too Many Requests",
                message,
                statusCode: 429,
            });
        }
    };

    limiter.reset = () => hits.clear();
    limiter.hits = hits;
    return limiter;
}

export const staffLoginRateLimiter = createRateLimiter({
    windowMs: Number(process.env.STAFF_LOGIN_RATE_LIMIT_WINDOW_MS || 60_000),
    maxRequests: Number(process.env.STAFF_LOGIN_RATE_LIMIT_MAX || 5),
    message: "Too many login attempts. Please try again later.",
});

export const staffForgotPasswordRateLimiter = createRateLimiter({
    windowMs: Number(process.env.STAFF_FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS || 15 * 60_000),
    maxRequests: Number(process.env.STAFF_FORGOT_PASSWORD_RATE_LIMIT_MAX || 5),
    message: "Too many password recovery attempts. Please try again later.",
});

export const staffVerifyOtpRateLimiter = createRateLimiter({
    windowMs: Number(process.env.STAFF_VERIFY_OTP_RATE_LIMIT_WINDOW_MS || 15 * 60_000),
    maxRequests: Number(process.env.STAFF_VERIFY_OTP_RATE_LIMIT_MAX || 10),
    message: "Too many verification attempts. Please try again later.",
});

export const staffResetPasswordRateLimiter = createRateLimiter({
    windowMs: Number(process.env.STAFF_RESET_PASSWORD_RATE_LIMIT_WINDOW_MS || 15 * 60_000),
    maxRequests: Number(process.env.STAFF_RESET_PASSWORD_RATE_LIMIT_MAX || 5),
    message: "Too many password reset attempts. Please try again later.",
});

export const rateLimiter = createRateLimiter();
export default rateLimiter;

