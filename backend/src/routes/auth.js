import { buildAuthOtpController } from "../controllers/authOtpController.js";
import {
  staffForgotPasswordRateLimiter,
  staffVerifyOtpRateLimiter,
  staffResetPasswordRateLimiter,
} from "../middleware/rateLimiter.js";
import {
  refreshStaffSession,
  invalidateStaffSession,
} from "../services/staffSessionService.js";

export default async function authRoutes(app, deps) {
  const { prisma, normalizeDbPermissions, onOtpGenerated } = deps;

  const controller = buildAuthOtpController({ prisma, app, normalizeDbPermissions, onOtpGenerated });

  app.post("/auth/send-otp", controller.sendOtp);
  app.post("/auth/verify-otp", controller.verifyOtp);
  app.post("/auth/staff-link/consume", controller.consumeStaffLink);
  app.post("/auth/staff-login-link", controller.consumeStaffLoginLink);
  app.post("/api/auth/staff-login-link", controller.consumeStaffLoginLink);

  // Staff Session Refresh & Invalidation (72-Hour Offline Grace Architecture)
  const handleStaffRefresh = async (req, reply) => {
    try {
      const refreshToken =
        req.body?.refreshToken ||
        req.headers?.["x-refresh-token"] ||
        (req.cookies ? req.cookies?.refreshToken : null);

      if (!refreshToken) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Refresh token is required",
          code: "REFRESH_TOKEN_REQUIRED",
        });
      }

      const refreshed = await refreshStaffSession({
        prisma,
        app,
        refreshToken,
        normalizeDbPermissions,
      });

      return reply.code(200).send({
        message: "Staff session refreshed successfully",
        ...refreshed,
      });
    } catch (err) {
      const statusCode = err.statusCode || 401;
      return reply.code(statusCode).send({
        statusCode,
        error: statusCode === 403 ? "Forbidden" : "Unauthorized",
        message: err.message || "Failed to refresh staff session",
        code: err.code || "REFRESH_FAILED",
      });
    }
  };

  const handleStaffLogout = async (req, reply) => {
    try {
      let staffId = null;

      // Extract user id from Authorization header if present
      const authHeader = req.headers?.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const rawToken = authHeader.slice(7).trim();
          const decoded = app.jwt.verify(rawToken);
          if (decoded?.id) staffId = decoded.id;
        } catch {
          // Token may already be expired; try refreshToken fallback
        }
      }

      // If not resolved from access token, attempt from refresh token
      if (!staffId) {
        const refreshToken =
          req.body?.refreshToken ||
          req.headers?.["x-refresh-token"] ||
          (req.cookies ? req.cookies?.refreshToken : null);
        if (refreshToken) {
          try {
            const decoded = app.jwt.verify(refreshToken);
            if (decoded?.id) staffId = decoded.id;
          } catch {
            // Invalid/expired token record
          }
        }
      }

      if (staffId) {
        await invalidateStaffSession({ prisma, userId: staffId });
      }

      return reply.code(200).send({
        message: "Staff logout successful",
      });
    } catch (err) {
      req.log.warn({ err: err?.message || err }, "staff_logout_error");
      return reply.code(200).send({
        message: "Staff logout successful",
      });
    }
  };

  app.post("/auth/staff/refresh", handleStaffRefresh);
  app.post("/api/auth/staff/refresh", handleStaffRefresh);
  app.post("/auth/refresh", handleStaffRefresh);
  app.post("/api/auth/refresh", handleStaffRefresh);

  app.post("/auth/staff/logout", handleStaffLogout);
  app.post("/api/auth/staff/logout", handleStaffLogout);
  app.post("/auth/logout", handleStaffLogout);
  app.post("/api/auth/logout", handleStaffLogout);

  // Phase 3B-2: Staff & Owner Forgot Password / OTP Recovery Endpoints
  const forgotOpts = { preHandler: [staffForgotPasswordRateLimiter] };
  const verifyOpts = { preHandler: [staffVerifyOtpRateLimiter] };
  const resetOpts = { preHandler: [staffResetPasswordRateLimiter] };

  app.post("/auth/forgot-password", forgotOpts, controller.forgotPassword);
  app.post("/api/auth/forgot-password", forgotOpts, controller.forgotPassword);

  app.post("/auth/forgot-password/verify-otp", verifyOpts, controller.verifyForgotPasswordOtp);
  app.post("/api/auth/forgot-password/verify-otp", verifyOpts, controller.verifyForgotPasswordOtp);

  app.post("/auth/forgot-password/reset", resetOpts, controller.resetPasswordWithToken);
  app.post("/api/auth/forgot-password/reset", resetOpts, controller.resetPasswordWithToken);
}
