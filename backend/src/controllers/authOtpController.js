import { normalizePhone } from "../services/phoneService.js";
import { requestAuthOtp, verifyAuthOtp } from "../services/authOtpService.js";
import { sendSmsOtp } from "../services/smsService.js";
import { upsertCustomerAccount } from "../services/customerProfileService.js";
import { extractVerifiedIdentifier, verifyMsg91AccessToken } from "../services/msg91OtpWidgetService.js";
import {
  buildStaffLoginPayload,
  consumeStaffMagicLink,
  issueStaffSession,
} from "../services/staffSessionService.js";

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

export const buildAuthOtpController = ({ prisma, app, normalizeDbPermissions }) => {
  const sendOtp = async (req, reply) => {
    try {
      const body = req.body || {};
      const phone = normalizePhone(body.phone || "");
      const actorType = normalizeActorType(body.actorType);
      const restaurantId = Number(body.restaurantId || 0) || null;

      if (!phone) return reply.code(400).send({ message: "Phone number is required" });
      if (!ALLOWED_ACTOR_TYPES.has(actorType)) return reply.code(400).send({ message: "Invalid actorType" });

      // For staff/owner OTPs, require restaurantId to avoid ambiguity across restaurants.
      if ((actorType === "OWNER" || actorType === "STAFF") && !restaurantId) {
        return reply.code(400).send({ message: "restaurantId is required for this actorType" });
      }

      if (actorType !== "CUSTOMER") {
        const user = await resolveStaffUser({ prisma, phone, actorType, restaurantId });
        if (!user) return reply.code(404).send({ message: "Account not found or inactive" });
      }

      const otpRes = await requestAuthOtp({ prisma, phone, actorType });
      if (!otpRes.ok) return reply.code(otpRes.status).send(otpRes.payload);

      const devOtp = otpRes.devOtp || "";
      const otpToSend = otpRes.code;

      const smsRes = await sendSmsOtp({ phone, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt });
      if (process.env.NODE_ENV === "production") {
        // eslint-disable-next-line no-console
        console.log("[authOtpController] otp_delivery", { phone, actorType, smsRes });
      }
      if (smsRes && smsRes.ok === false) {
        return reply.code(502).send({ message: smsRes.error || "Failed to send OTP SMS" });
      }

      const payload = {
        message: "OTP sent",
        phone,
        actorType,
        expiresAt: otpRes.expiresAt,
      };
      if (devOtp) payload.devOtp = devOtp;
      if (process.env.NODE_ENV !== "production") {
        payload.delivery = {
          sms: smsRes ? { ok: smsRes.ok !== false, simulated: Boolean(smsRes.simulated) } : null,
        };
      }
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
        if (!okRes.ok) return reply.code(okRes.status).send(okRes.payload);
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

      return { message: "Login success", actorType, token, user: userPayload, offlineMode: false };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "OTP verification failed" });
    }
  };

  const consumeStaffLink = async (req, reply) => {
    try {
      const body = req.body || {};
      const token = String(body.token || body.staffLink || body.link || "").trim();
      if (!token) return reply.code(400).send({ message: "Staff login link is required" });

      const payload = await consumeStaffMagicLink({
        app,
        prisma,
        token,
        normalizeDbPermissions,
      });

      return payload;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(err?.statusCode || 500).send({
        message: err?.message || "Failed to open staff login link",
      });
    }
  };

  return { sendOtp, verifyOtp: verifyOtpHandler, consumeStaffLink };
};
