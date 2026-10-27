import bcrypt from "bcryptjs";
import { normalizePhone } from "../services/phoneService.js";
import { requestAuthOtp, verifyAuthOtp } from "../services/authOtpService.js";
import { sendSmsOtp } from "../services/smsService.js";
import { sendWhatsAppOtp } from "../services/msg91WhatsAppService.js";
import { sendEmailOtp } from "../services/emailService.js";
import { upsertCustomerAccount } from "../services/customerProfileService.js";
import { extractVerifiedIdentifier, verifyMsg91AccessToken } from "../services/msg91OtpWidgetService.js";
import {
  buildStaffLoginPayload,
  consumeStaffLoginToken,
  consumeStaffMagicLink,
  issueStaffSession,
} from "../services/staffSessionService.js";
import { logAuditEvent } from "../services/auditLogService.js";

const ALLOWED_ACTOR_TYPES = new Set(["CUSTOMER", "OWNER", "STAFF", "SUPER_ADMIN"]);

const normalizeActorType = (raw) => String(raw || "CUSTOMER").trim().toUpperCase();

const resolveStaffUser = async ({ prisma, phone, actorType, restaurantId }) => {
  const where = {
    phone,
    isActive: true,
    ...(restaurantId ? { restaurantId } : {}),
    ...(actorType === "SUPER_ADMIN" ? { role: "SUPER_ADMIN" } : {}),
    ...(actorType === "OWNER" ? { role: "OWNER" } : {}),
    ...(actorType === "STAFF" ? { role: { notIn: ["SUPER_ADMIN", "OWNER"] } } : {}),
  };

  return await prisma.user.findFirst({
    where,
    include: {
      restaurant: true,
      staffAccess: { select: { permissions: true, role: true } },
    },
    orderBy: { id: "asc" },
  });
};

export const buildAuthOtpController = ({ prisma, app, normalizeDbPermissions, onOtpGenerated }) => {
  const sendOtp = async (req, reply) => {
    try {
      const body = req.body || {};
      const phone = normalizePhone(body.phone || "");
      const actorType = normalizeActorType(body.actorType);
      const restaurantId = Number(body.restaurantId || 0) || null;
      let email = String(body.email || "").trim().toLowerCase();

      if (!phone) return reply.code(400).send({ message: "Phone number is required" });
      if (!ALLOWED_ACTOR_TYPES.has(actorType)) return reply.code(400).send({ message: "Invalid actorType" });

      // For staff/owner OTPs, require restaurantId to avoid ambiguity across restaurants.
      if ((actorType === "OWNER" || actorType === "STAFF") && !restaurantId) {
        return reply.code(400).send({ message: "restaurantId is required for this actorType" });
      }

      let user = null;
      if (actorType !== "CUSTOMER") {
        user = await resolveStaffUser({ prisma, phone, actorType, restaurantId });
        if (!user) return reply.code(404).send({ message: "Account not found or inactive" });
        if (!email && user.email) email = String(user.email).trim().toLowerCase();
      }

      const otpRes = await requestAuthOtp({ prisma, phone, actorType });
      if (!otpRes.ok) return reply.code(otpRes.status).send(otpRes.payload);

      const devOtp = otpRes.devOtp || "";
      const otpToSend = otpRes.code;

      const [whatsAppRes, smsRes, emailRes] = await Promise.all([
        sendWhatsAppOtp({ phone, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }),
        sendSmsOtp({ phone, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }),
        email ? sendEmailOtp({ email, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }) : Promise.resolve(null),
      ]);

      if (process.env.NODE_ENV === "production") {
        // eslint-disable-next-line no-console
        console.log("[authOtpController] otp_delivery", {
          phone,
          actorType,
          whatsAppRes: whatsAppRes ? { ok: whatsAppRes.ok !== false, status: whatsAppRes.status } : null,
          smsRes: smsRes ? { ok: smsRes.ok !== false } : null,
          emailRes: emailRes ? { ok: emailRes.ok !== false } : null,
        });
      }

      const deliveredByWhatsApp = Boolean(whatsAppRes && whatsAppRes.ok !== false && !whatsAppRes.skipped);
      const deliveredBySms = Boolean(smsRes && smsRes.ok !== false && !smsRes.skipped);
      const deliveredByEmail = Boolean(emailRes && emailRes.ok !== false && !emailRes.skipped);
      const delivered = deliveredByWhatsApp || deliveredBySms || deliveredByEmail;

      if (!delivered) {
        const waErr = whatsAppRes && whatsAppRes.ok === false ? whatsAppRes.error : null;
        const smsErr = smsRes && smsRes.ok === false ? smsRes.error : null;
        const emailErr = emailRes && emailRes.ok === false ? emailRes.error : null;
        return reply.code(502).send({ message: waErr || smsErr || emailErr || "Failed to send OTP" });
      }

      if (user) {
        await logAuditEvent({
          prisma,
          restaurantId: user.restaurantId,
          branchId: user.branchId,
          actor: { id: user.id, name: user.name, role: user.role },
          action: "AUTH_OTP_SENT",
          entity: "OTP",
          entityId: user.id,
          status: "SUCCESS",
          severity: "INFO",
          details: { channel: deliveredByWhatsApp ? "whatsapp" : (deliveredBySms ? "sms" : "email") },
          req,
        });
      }

      const payload = {
        message: "OTP sent",
        phone,
        email: email || null,
        actorType,
        expiresAt: otpRes.expiresAt,
        delivery: {
          whatsApp: whatsAppRes ? { ok: whatsAppRes.ok !== false, simulated: Boolean(whatsAppRes.simulated) } : null,
          sms: smsRes ? { ok: smsRes.ok !== false, simulated: Boolean(smsRes.simulated) } : null,
          email: emailRes ? { ok: emailRes.ok !== false, simulated: Boolean(emailRes.simulated), skipped: Boolean(emailRes.skipped) } : null,
        },
      };
      if (devOtp && process.env.NODE_ENV !== "production") payload.devOtp = devOtp;
      return payload;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to send OTP" });
    }
  };

  const verifyOtpHandler = async (req, reply) => {
    try {
      const body = req.body || {};
      const phone = normalizePhone(body.phone || "");
      const accessToken = String(body.accessToken || body.access_token || "").trim();
      const otp = String(body.otp || "").trim();
      const actorType = normalizeActorType(body.actorType);
      const restaurantId = Number(body.restaurantId || 0) || null;

      if (!phone) return reply.code(400).send({ message: "Phone number is required" });
      if (!accessToken && !otp) return reply.code(400).send({ message: "OTP (or accessToken) is required" });
      if (!ALLOWED_ACTOR_TYPES.has(actorType)) return reply.code(400).send({ message: "Invalid actorType" });

      if ((actorType === "OWNER" || actorType === "STAFF") && !restaurantId) {
        return reply.code(400).send({ message: "restaurantId is required for this actorType" });
      }

      if (accessToken) {
        const verified = await verifyMsg91AccessToken({ accessToken });
        if (!verified.ok) return reply.code(verified.status).send(verified.payload);

        const identifier = extractVerifiedIdentifier(verified.data);
        const verifiedDigits = identifier.replace(/[^\d]/g, "");
        const normalizedVerifiedPhone =
          verifiedDigits.length > 10 && verifiedDigits.startsWith("91") ? verifiedDigits.slice(2) : verifiedDigits;

        if (normalizedVerifiedPhone && normalizePhone(normalizedVerifiedPhone) !== phone) {
          return reply.code(401).send({ message: "OTP verification mismatch. Please retry with the same phone number." });
        }
      } else {
        const okRes = await verifyAuthOtp({ prisma, phone, actorType, otp });
        if (!okRes.ok) {
          if (actorType !== "CUSTOMER") {
            const staffUser = await resolveStaffUser({ prisma, phone, actorType, restaurantId });
            const isExp = String(okRes.payload?.message || "").toLowerCase().includes("expired");
            await logAuditEvent({
              prisma,
              restaurantId: staffUser?.restaurantId || restaurantId,
              branchId: staffUser?.branchId || null,
              actor: staffUser ? { id: staffUser.id, name: staffUser.name, role: staffUser.role } : null,
              action: isExp ? "AUTH_OTP_EXPIRED" : "AUTH_OTP_FAILED",
              entity: "OTP",
              entityId: staffUser?.id || 0,
              status: "FAILURE",
              severity: "WARN",
              details: { reason: isExp ? "EXPIRED" : "INVALID_OR_EXPIRED" },
              req,
            });
          }
          return reply.code(okRes.status).send(okRes.payload);
        }
      }

      if (actorType === "CUSTOMER") {
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const account = await upsertCustomerAccount({ prisma, phone, name, email });

        const token = app.jwt.sign(
          {
            type: "customer",
            phone,
            customerAccountId: account.id,
          },
          { expiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || "30d" }
        );

        return { message: "Login success", actorType, token, customer: account };
      }

      const user = await resolveStaffUser({ prisma, phone, actorType, restaurantId });
      if (!user) return reply.code(401).send({ message: "Account not found or inactive" });

      const { userPayload, effectiveRole } = buildStaffLoginPayload({ user, normalizeDbPermissions });
      const { token, sessionVersion } = await issueStaffSession({ prisma, app, user, effectiveRole });
      userPayload.sessionVersion = sessionVersion;

      await logAuditEvent({
        prisma,
        restaurantId: user.restaurantId,
        branchId: user.branchId,
        actor: { id: user.id, name: user.name, role: user.role },
        action: "AUTH_OTP_VERIFIED",
        entity: "OTP",
        entityId: user.id,
        status: "SUCCESS",
        severity: "INFO",
        req,
      });

      return { message: "Login success", actorType, token, user: userPayload, offlineMode: false };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "OTP verification failed" });
    }
  };


  const consumeStaffLoginLink = async (req, reply) => {
    try {
      const body = req.body || {};
      const token = String(body.token || body.loginToken || "").trim();
      if (!token) return reply.code(400).send({ message: "Staff login link token is required" });

      const payload = await consumeStaffLoginToken({
        prisma,
        app,
        token,
        normalizeDbPermissions,
        req,
      });

      await logAuditEvent({
        prisma,
        restaurantId: payload.restaurantId,
        actor: { id: payload.user.id, name: payload.user.name, role: payload.user.role },
        action: "STAFF_LOGIN_LINK_SUCCESS",
        entity: "STAFF",
        entityId: payload.user.id,
        status: "SUCCESS",
        severity: "INFO",
        details: { role: payload.user.role, tokenId: payload.tokenId },
        req,
      });

      return payload;
    } catch (err) {
      const statusCode = err?.statusCode || 500;
      if (statusCode === 401 || statusCode === 403) {
        await logAuditEvent({
          prisma,
          action: "STAFF_LOGIN_LINK_REJECTED",
          entity: "STAFF",
          status: "FAILED",
          severity: "WARN",
          details: { error: err?.message, statusCode },
          req,
        });
      }
      return reply.code(statusCode).send({
        message: err?.message || "Failed to authenticate with staff login link",
      });
    }
  };

  const consumeStaffLink = async (req, reply) => {
    return reply.code(403).send({
      message: "Passwordless magic link login has been discontinued. Please log in with your email and password.",
    });
  };

  const forgotPassword = async (req, reply) => {
    try {
      const body = req.body || {};
      const email = String(body.email || "").trim().toLowerCase();
      const phone = body.phone ? normalizePhone(body.phone) : "";
      const restaurantId = Number(body.restaurantId || 0) || null;

      if (!email && !phone) {
        return reply.code(400).send({ message: "Email or phone number is required" });
      }

      const GENERIC_RESPONSE = {
        message: "If an account exists, recovery instructions have been sent.",
      };

      let user = null;
      if (email) {
        user = await prisma.user.findUnique({
          where: { email },
          include: { restaurant: true },
        });
      } else if (phone) {
        const users = await prisma.user.findMany({
          where: { phone },
          include: { restaurant: true },
        });
        if (restaurantId) {
          user = users.find((u) => u.restaurantId === restaurantId) || null;
        } else if (users.length === 1) {
          user = users[0];
        }
      }

      const isEligibleRole =
        user &&
        (user.role === "SUPER_ADMIN" ||
          ["OWNER", "MANAGER", "WAITER", "CHEF", "CASHIER", "STAFF"].includes(String(user.role || "").toUpperCase()));
      const isTenantMatch = !restaurantId || user?.restaurantId === restaurantId || user?.role === "SUPER_ADMIN";

      if (!user || user.isActive === false || !isEligibleRole || !isTenantMatch) {
        // Prevent account enumeration: return identical generic response
        return reply.code(200).send(GENERIC_RESPONSE);
      }

      const recoveryIdentifier = user.email.toLowerCase();
      const otpRes = await requestAuthOtp({
        prisma,
        phone: recoveryIdentifier,
        actorType: "STAFF_PASSWORD_RESET",
      });

      if (!otpRes.ok) {
        if (otpRes.status === 429) {
          return reply.code(429).send(otpRes.payload);
        }
        return reply.code(200).send(GENERIC_RESPONSE);
      }

      const otpCode = otpRes.code;

      const deliveryPromises = [
        sendEmailOtp({ email: user.email, otp: otpCode, expiresAt: otpRes.expiresAt }),
      ];
      if (user.phone) {
        deliveryPromises.push(sendWhatsAppOtp({ phone: user.phone, otp: otpCode, expiresAt: otpRes.expiresAt }));
        deliveryPromises.push(sendSmsOtp({ phone: user.phone, otp: otpCode, expiresAt: otpRes.expiresAt }));
      }
      await Promise.allSettled(deliveryPromises);

      if (typeof onOtpGenerated === "function") {
        onOtpGenerated({ email: user.email, phone: user.phone, otp: otpCode, expiresAt: otpRes.expiresAt });
      }

      await logAuditEvent({
        prisma,
        restaurantId: user.restaurantId,
        actor: { id: user.id, name: user.name, role: user.role },
        action: "AUTH_PASSWORD_RESET_REQUESTED",
        entity: "USER",
        entityId: user.id,
        status: "SUCCESS",
        severity: "INFO",
        details: { channel: "email" },
        req,
      });

      await logAuditEvent({
        prisma,
        restaurantId: user.restaurantId,
        actor: { id: user.id, name: user.name, role: user.role },
        action: "AUTH_OTP_SENT",
        entity: "OTP",
        entityId: user.id,
        status: "SUCCESS",
        severity: "INFO",
        details: { channel: "email" },
        req,
      });

      return reply.code(200).send(GENERIC_RESPONSE);
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to process forgot password request" });
    }
  };

  const verifyForgotPasswordOtp = async (req, reply) => {
    try {
      const body = req.body || {};
      const email = String(body.email || "").trim().toLowerCase();
      const otp = String(body.otp || "").trim();

      if (!email || !otp) {
        return reply.code(400).send({ message: "Email and verification code are required." });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, role: true, restaurantId: true, sessionVersion: true, isActive: true },
      });

      const verifyRes = await verifyAuthOtp({
        prisma,
        phone: email,
        actorType: "STAFF_PASSWORD_RESET",
        otp,
      });

      if (!verifyRes.ok) {
        const isExp = String(verifyRes.payload?.message || "").toLowerCase().includes("expired");
        if (isExp) {
          await logAuditEvent({
            prisma,
            restaurantId: user?.restaurantId || null,
            actor: user ? { id: user.id, name: user.name, role: user.role } : null,
            action: "AUTH_OTP_EXPIRED",
            entity: "OTP",
            entityId: user?.id || 0,
            status: "FAILURE",
            severity: "WARN",
            details: { reason: "EXPIRED" },
            req,
          });
        } else {
          await logAuditEvent({
            prisma,
            restaurantId: user?.restaurantId || null,
            actor: user ? { id: user.id, name: user.name, role: user.role } : null,
            action: "AUTH_OTP_FAILED",
            entity: "OTP",
            entityId: user?.id || 0,
            status: "FAILURE",
            severity: "WARN",
            details: { reason: "INVALID_OR_EXPIRED" },
            req,
          });
        }

        return reply.code(verifyRes.status || 400).send({
          message: verifyRes.payload?.message || "Invalid or expired verification code.",
        });
      }

      if (!user || user.isActive === false) {
        await logAuditEvent({
          prisma,
          restaurantId: user?.restaurantId || null,
          actor: user ? { id: user.id, name: user.name, role: user.role } : null,
          action: "AUTH_OTP_FAILED",
          entity: "OTP",
          entityId: user?.id || 0,
          status: "FAILURE",
          severity: "WARN",
          details: { reason: "USER_INACTIVE_OR_NOT_FOUND" },
          req,
        });

        return reply.code(400).send({ message: "Invalid or expired verification code." });
      }

      await logAuditEvent({
        prisma,
        restaurantId: user.restaurantId,
        actor: { id: user.id, name: user.name, role: user.role },
        action: "AUTH_OTP_VERIFIED",
        entity: "OTP",
        entityId: user.id,
        status: "SUCCESS",
        severity: "INFO",
        details: { channel: "email" },
        req,
      });

      const resetToken = app.jwt.sign(
        {
          purpose: "STAFF_PASSWORD_RESET",
          userId: user.id,
          email: user.email,
          restaurantId: user.restaurantId,
          sessionVersion: user.sessionVersion,
        },
        { expiresIn: "15m" }
      );

      return reply.code(200).send({
        message: "Verification code accepted.",
        resetToken,
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to verify verification code" });
    }
  };

  const resetPasswordWithToken = async (req, reply) => {
    try {
      const body = req.body || {};
      const rawToken =
        body.resetToken ||
        (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, "") : null);
      const newPassword = String(body.newPassword || "").trim();
      const restaurantId = body.restaurantId ? Number(body.restaurantId) : null;

      if (!rawToken || !newPassword) {
        return reply.code(400).send({ message: "Reset token and new password are required." });
      }

      let decoded;
      try {
        decoded = app.jwt.verify(rawToken);
      } catch (err) {
        return reply.code(401).send({ message: "Reset token has expired or is invalid." });
      }

      if (decoded?.purpose !== "STAFF_PASSWORD_RESET" || !decoded?.userId) {
        return reply.code(401).send({ message: "Invalid reset token." });
      }

      if (newPassword.length < 6) {
        return reply.code(400).send({ message: "New password must be at least 6 characters long." });
      }

      const user = await prisma.user.findUnique({
        where: { id: Number(decoded.userId) },
        select: { id: true, name: true, role: true, restaurantId: true, sessionVersion: true, isActive: true },
      });

      if (!user || user.isActive === false) {
        return reply.code(401).send({ message: "Account is inactive or not found." });
      }

      if (restaurantId && user.restaurantId && restaurantId !== user.restaurantId) {
        return reply.code(403).send({ message: "Tenant mismatch. Password reset denied." });
      }

      if (Number(user.sessionVersion) !== Number(decoded.sessionVersion)) {
        return reply.code(401).send({ message: "Reset token has already been used or session expired." });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          sessionVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lastFailedLoginAt: null,
          lockedUntil: null,
        },
      });

      await logAuditEvent({
        prisma,
        restaurantId: user.restaurantId,
        actor: { id: user.id, name: user.name, role: user.role },
        action: "AUTH_PASSWORD_RESET_COMPLETED",
        entity: "USER",
        entityId: user.id,
        status: "SUCCESS",
        severity: "INFO",
        req,
      });

      await logAuditEvent({
        prisma,
        restaurantId: user.restaurantId,
        actor: { id: user.id, name: user.name, role: user.role },
        action: "AUTH_SESSION_INVALIDATED",
        entity: "USER",
        entityId: user.id,
        status: "SUCCESS",
        severity: "INFO",
        details: { reason: "PASSWORD_RESET" },
        req,
      });

      return reply.code(200).send({
        success: true,
        message: "Password has been successfully reset. Please log in with your new password.",
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to reset password" });
    }
  };

  return {
    sendOtp,
    verifyOtp: verifyOtpHandler,
    consumeStaffLink,
    consumeStaffLoginLink,
    forgotPassword,
    verifyForgotPasswordOtp,
    resetPasswordWithToken,
  };
};
