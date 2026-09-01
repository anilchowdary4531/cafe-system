import prisma from "../prisma.js";
import config from "../core/config.js";

export default async function healthRoutes(app) {
    const checkHealth = async (req, reply) => {
        let dbStatus = "healthy";
        try {
            await prisma.$queryRaw`SELECT 1`;
        } catch {
            dbStatus = "unhealthy";
        }

        const isHealthy = dbStatus === "healthy";
        const statusCode = isHealthy ? 200 : 503;

        return reply.code(statusCode).send({
            status: isHealthy ? "ok" : "degraded",
            timestamp: new Date().toISOString(),
            version: config.version,
            environment: config.env,
            uptimeSeconds: Math.floor(process.uptime()),
            services: {
                database: dbStatus,
            },
        });
    };

    app.get("/health", checkHealth);
    app.get("/api/v1/health", checkHealth);
}
