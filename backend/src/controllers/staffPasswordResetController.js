import bcrypt from "bcryptjs";
import { sendPasswordResetEmail } from "../services/emailService.js";
import {
  buildStaffPasswordResetToken,
  buildStaffPasswordResetUrl,
  getStaffPasswordResetExpiresIn,
  isStaffPasswordResetToken,
} from "../services/staffPasswordResetService.js";
import { isSchemaMissingDbError } from "../services/dbError.js";

const MIN_PASSWORD_LENGTH = 6;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export const buildStaffPasswordResetController = ({ prisma, app, frontendUrl }) => {
  const requestReset = async (req, reply) => {
    try {
      const body = req.body || {};
      const email = normalizeEmail(body.email || body.username || "");

      if (!email) return reply.code(400).send({ message: "Email address is required" });

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          isActive: true,
          restaurantId: true,
          branchId: true,
        },
      });

      if (!user || user.isActive === false) {
        return reply.code(404).send({ message: "Account not found or inactive" });
      }

      const token = buildStaffPasswordResetToken({ app, user });
      const resetUrl = buildStaffPasswordResetUrl({ frontendUrl, token, email: user.email });
      const expiresIn = getStaffPasswordResetExpiresIn();
      const emailRes = await sendPasswordResetEmail({ email: user.email, resetUrl, expiresIn });

      if (emailRes?.ok === false) {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.warn("[staffPasswordResetController] password reset email failed in non-production", emailRes.error || emailRes);
        } else {
          return reply.code(502).send({ message: emailRes.error || "Failed to send password reset email" });
        }
      }

      if (process.env.NODE_ENV === "production" && emailRes?.skipped) {
        return reply.code(502).send({ message: emailRes.error || "Failed to send password reset email" });
      }

      const payload = {
        message: "Password reset email sent",
        email: user.email,
      };

      if (process.env.NODE_ENV !== "production") {
        payload.devResetLink = resetUrl;
        payload.delivery = {
          email: emailRes ? { ok: emailRes.ok !== false, simulated: Boolean(emailRes.simulated), skipped: Boolean(emailRes.skipped) } : null,
        };
      }

      return payload;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to request password reset" });
    }
  };

  const resetPassword = async (req, reply) => {
    try {
      const body = req.body || {};
      const token = String(body.token || body.resetToken || "").trim();
      const password = String(body.password || body.newPassword || "").trim();

      if (!token) return reply.code(400).send({ message: "Reset token is required" });
      if (!password) return reply.code(400).send({ message: "New password is required" });
      if (password.length < MIN_PASSWORD_LENGTH) {
        return reply.code(400).send({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      }

      let decoded;
      try {
        decoded = await app.jwt.verify(token);
      } catch {
        return reply.code(401).send({ message: "Invalid or expired password reset link" });
      }

      if (!isStaffPasswordResetToken(decoded)) {
        return reply.code(401).send({ message: "Invalid password reset link" });
      }

      const userId = Number(decoded?.staffUserId || 0);
      if (!userId) return reply.code(401).send({ message: "Invalid password reset link" });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          isActive: true,
          sessionVersion: true,
          restaurantId: true,
          branchId: true,
        },
      });

      if (!user) return reply.code(404).send({ message: "Account not found or inactive" });
      if (user.isActive === false) {
        return reply.code(403).send({ message: "Account is disabled. Contact owner/admin." });
      }

      const decodedEmail = normalizeEmail(decoded?.email || "");
      if (decodedEmail && decodedEmail !== normalizeEmail(user.email)) {
        return reply.code(401).send({ message: "Invalid password reset link" });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            sessionVersion: { increment: 1 },
          },
          select: { id: true },
        });
      } catch (err) {
        if (!isSchemaMissingDbError(err)) throw err;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
          },
          select: { id: true },
        });
      }

      return {
        message: "Password updated successfully",
        email: user.email,
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to reset password" });
    }
  };

  return {
    requestReset,
    resetPassword,
  };
};
