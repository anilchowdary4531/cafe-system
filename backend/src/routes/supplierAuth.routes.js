import {
    registerSupplier,
    verifySupplierOtp,
    loginSupplier,
    forgotSupplierPassword,
    resetSupplierPassword,
    logoutSupplier,
} from "../services/supplierAuthService.js";
import rateLimiter from "../middleware/rateLimiter.js";

export default async function supplierAuthRoutes(app) {
    const registerHandler = async (req, reply) => {
        try {
            const result = await registerSupplier(req.body || {});
            return reply.code(201).send(result);
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Registration failed" });
        }
    };

    const verifyOtpHandler = async (req, reply) => {
        try {
            const result = await verifySupplierOtp(req.body || {});
            return reply.code(200).send(result);
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "OTP verification failed" });
        }
    };

    const loginHandler = async (req, reply) => {
        try {
            const supplierData = await loginSupplier(req.body || {});
            const token = app.jwt.sign({
                supplierId: supplierData.supplierId,
                email: supplierData.email,
                phone: supplierData.phone,
                role: "SUPPLIER",
                sessionVersion: supplierData.sessionVersion,
            });

            const refreshToken = app.jwt.sign(
                { supplierId: supplierData.supplierId, role: "SUPPLIER", isRefresh: true },
                { expiresIn: "30d" }
            );

            return reply.code(200).send({
                token,
                refreshToken,
                supplier: supplierData,
                message: "Supplier login successful",
            });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Login failed" });
        }
    };

    const refreshHandler = async (req, reply) => {
        try {
            const { refreshToken } = req.body || {};
            if (!refreshToken) {
                return reply.code(400).send({ error: "Refresh token is required" });
            }

            const decoded = app.jwt.verify(refreshToken);
            if (!decoded || decoded.role !== "SUPPLIER" || !decoded.isRefresh) {
                return reply.code(401).send({ error: "Invalid refresh token" });
            }

            const newAccessToken = app.jwt.sign({
                supplierId: decoded.supplierId,
                role: "SUPPLIER",
            });

            return reply.code(200).send({ token: newAccessToken });
        } catch (err) {
            return reply.code(401).send({ error: "Invalid or expired refresh token" });
        }
    };

    const forgotPasswordHandler = async (req, reply) => {
        try {
            const result = await forgotSupplierPassword(req.body || {});
            return reply.code(200).send(result);
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to process forgot password" });
        }
    };

    const resetPasswordHandler = async (req, reply) => {
        try {
            const result = await resetSupplierPassword(req.body || {});
            return reply.code(200).send(result);
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to reset password" });
        }
    };

    const logoutHandler = async (req, reply) => {
        try {
            const { supplierId } = req.body || {};
            await logoutSupplier(supplierId);
            return reply.code(200).send({ message: "Supplier logout successful" });
        } catch (err) {
            return reply.code(500).send({ error: "Logout failed" });
        }
    };

    // Attach routes under both legacy /auth/supplier/* and API v1 /api/v1/auth/supplier/*
    const endpoints = [
        { path: "/auth/supplier/register", handler: registerHandler },
        { path: "/api/v1/auth/supplier/register", handler: registerHandler },
        { path: "/auth/supplier/verify-otp", handler: verifyOtpHandler },
        { path: "/api/v1/auth/supplier/verify-otp", handler: verifyOtpHandler },
        { path: "/auth/supplier/login", handler: loginHandler },
        { path: "/api/v1/auth/supplier/login", handler: loginHandler },
        { path: "/auth/supplier/refresh", handler: refreshHandler },
        { path: "/api/v1/auth/supplier/refresh", handler: refreshHandler },
        { path: "/auth/supplier/forgot-password", handler: forgotPasswordHandler },
        { path: "/api/v1/auth/supplier/forgot-password", handler: forgotPasswordHandler },
        { path: "/auth/supplier/reset-password", handler: resetPasswordHandler },
        { path: "/api/v1/auth/supplier/reset-password", handler: resetPasswordHandler },
        { path: "/auth/supplier/logout", handler: logoutHandler },
        { path: "/api/v1/auth/supplier/logout", handler: logoutHandler },
    ];

    for (const ep of endpoints) {
        app.post(ep.path, { preHandler: [rateLimiter] }, ep.handler);
    }
}
