import { buildAuthOtpController } from "../controllers/authOtpController.js";
import {
  staffForgotPasswordRateLimiter,
  staffVerifyOtpRateLimiter,
  staffResetPasswordRateLimiter,
} from "../middleware/rateLimiter.js";

export default async function authRoutes(app, deps) {
  const { prisma, normalizeDbPermissions, onOtpGenerated } = deps;

  const controller = buildAuthOtpController({ prisma, app, normalizeDbPermissions, onOtpGenerated });

  app.post("/auth/send-otp", controller.sendOtp);
  app.post("/auth/verify-otp", controller.verifyOtp);
  app.post("/auth/staff-link/consume", controller.consumeStaffLink);
  app.post("/auth/staff-login-link", controller.consumeStaffLoginLink);
  app.post("/api/auth/staff-login-link", controller.consumeStaffLoginLink);

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
