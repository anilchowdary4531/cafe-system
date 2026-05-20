import { buildAuthOtpController } from "../controllers/authOtpController.js";

export default async function authRoutes(app, deps) {
  const { prisma, normalizeDbPermissions } = deps;

  const controller = buildAuthOtpController({ prisma, app, normalizeDbPermissions });

  app.post("/auth/send-otp", controller.sendOtp);
  app.post("/auth/verify-otp", controller.verifyOtp);
}

