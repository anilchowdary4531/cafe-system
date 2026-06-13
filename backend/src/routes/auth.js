import { buildAuthOtpController } from "../controllers/authOtpController.js";
import { buildStaffPasswordResetController } from "../controllers/staffPasswordResetController.js";

export default async function authRoutes(app, deps) {
  const { prisma, normalizeDbPermissions, FRONTEND_URL } = deps;

  const controller = buildAuthOtpController({ prisma, app, normalizeDbPermissions });
  const passwordResetController = buildStaffPasswordResetController({
    prisma,
    app,
    frontendUrl: FRONTEND_URL,
  });

  app.post("/auth/send-otp", controller.sendOtp);
  app.post("/auth/verify-otp", controller.verifyOtp);
  app.post("/auth/staff-link/consume", controller.consumeStaffLink);
  app.post("/auth/staff/password/forgot", passwordResetController.requestReset);
  app.post("/auth/staff/password/reset", passwordResetController.resetPassword);
}
