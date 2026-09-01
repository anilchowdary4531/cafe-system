import config from "../core/config.js";

const hits = new Map();

export async function rateLimiter(req, reply) {
    const ip = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
    const now = Date.now();
    const windowMs = config.rateLimit.windowMs;
    const maxRequests = config.rateLimit.maxRequests;

    if (!hits.has(ip)) {
        hits.set(ip, []);
    }

    const timestamps = hits.get(ip).filter((time) => now - time < windowMs);
    timestamps.push(now);
    hits.set(ip, timestamps);

    if (timestamps.length > maxRequests) {
        return reply.code(429).send({
            error: "Too Many Requests",
            message: "Rate limit exceeded. Please try again later.",
            statusCode: 429,
        });
    }
}

export default rateLimiter;
