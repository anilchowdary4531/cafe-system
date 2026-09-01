import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(backendRoot, ".env") });

export const config = {
    env: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 5000),
    host: process.env.HOST || "0.0.0.0",
    jwtSecret: process.env.JWT_SECRET || "tiffzy_super_secret_jwt_key_2026",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    databaseUrl: process.env.DATABASE_URL || "",
    corsOrigins: (process.env.CORS_ORIGINS || "*").split(",").map((s) => s.trim()),
    rateLimit: {
        maxRequests: Number(process.env.RATE_LIMIT_MAX || 100),
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
    },
    version: "1.0.0",
};

export default config;
