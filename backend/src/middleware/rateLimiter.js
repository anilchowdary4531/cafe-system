import config from "../core/config.js";

const hits = new Map();

export async function rateLimiter(req, reply) {
    const rawIp = req.headers["x-forwarded-for"] || req.ip || "127.0.0.1";
    const ip = (typeof rawIp === "string" ? rawIp.split(",")[0] : rawIp).trim();
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
