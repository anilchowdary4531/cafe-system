import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { classifyDbError } from "./otpService.js";

const readInt = (value, fallback) => {
  const n = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(n) ? n : fallback;
};

const OTP_LENGTH = readInt(process.env.OTP_LENGTH, 6);
const OTP_TTL_MS = readInt(process.env.OTP_TTL_MS, 5 * 60_000);
const OTP_RESEND_COOLDOWN_MS = readInt(process.env.OTP_RESEND_COOLDOWN_MS, 30_000);
const OTP_MAX_ATTEMPTS = readInt(process.env.OTP_MAX_ATTEMPTS, 5);

// Dev-friendly fallback when the auth_otps table isn't created yet.
// Keeps local /auth OTP flows usable even before Prisma migrations/db push are run.
const memoryOtpSessions = new Map(); // key -> { otpHash, expiresAt, attempts, lastSentAt }

const makeKey = ({ phone, actorType }) => `${String(actorType || "").toUpperCase()}:${String(phone || "")}`;

const isExpired = (d) => {
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? true : t <= Date.now();
};

const generateOtp = () => {
  const max = 10 ** OTP_LENGTH;
  const value = crypto.randomInt(0, max);
  return String(value).padStart(OTP_LENGTH, "0");
};

export const requestAuthOtp = async ({ prisma, phone, actorType } = {}) => {
  const normalizedActorType = String(actorType || "").trim().toUpperCase();
  const key = makeKey({ phone, actorType: normalizedActorType });

  const checkCooldown = (lastSentAt) => {
    if (!lastSentAt) return null;
    const last = new Date(lastSentAt).getTime();
    if (!Number.isNaN(last) && Date.now() - last < OTP_RESEND_COOLDOWN_MS) {
      return {
        status: 429,
        payload: {
          message: "OTP already sent recently. Please wait a moment and try again.",
        },
      };
    }
    return null;
  };

  let usedMemory = false;
  try {
    const existing = await prisma.authOtp.findUnique({
      where: { phone_actorType: { phone, actorType: normalizedActorType } },
      select: { lastSentAt: true },
    });
    const cooldown = checkCooldown(existing?.lastSentAt);
    if (cooldown) return { ok: false, ...cooldown };
  } catch (err) {
    const classified = classifyDbError(err);
    const schemaMissing = classified?.code === "P2021" || classified?.code === "schema_missing";
    if (process.env.NODE_ENV !== "production" && schemaMissing) {
      usedMemory = true;
      const existing = memoryOtpSessions.get(key);
      const cooldown = checkCooldown(existing?.lastSentAt);
      if (cooldown) return { ok: false, ...cooldown };
    } else {
      throw err;
    }
  }

  const code = generateOtp();
  const otpHash = bcrypt.hashSync(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const lastSentAt = new Date();

  if (!usedMemory) {
    try {
      await prisma.authOtp.upsert({
        where: { phone_actorType: { phone, actorType: normalizedActorType } },
        update: { otpHash, expiresAt, attempts: 0, lastSentAt },
        create: { phone, actorType: normalizedActorType, otpHash, expiresAt, attempts: 0, lastSentAt },
      });
    } catch (err) {
      const classified = classifyDbError(err);
      const schemaMissing = classified?.code === "P2021" || classified?.code === "schema_missing";
      if (process.env.NODE_ENV !== "production" && schemaMissing) {
        usedMemory = true;
      } else {
        throw err;
      }
    }
  }

  if (usedMemory) {
    memoryOtpSessions.set(key, { otpHash, expiresAt, attempts: 0, lastSentAt });
  }

  const shouldReturnDevOtp =
    process.env.NODE_ENV !== "production" &&
    String(process.env.RETURN_DEV_OTP || "true").toLowerCase() !== "false";

  return {
    ok: true,
    phone,
    actorType: normalizedActorType,
    expiresAt,
    code,
    devOtp: shouldReturnDevOtp ? code : undefined,
  };
};

export const verifyAuthOtp = async ({ prisma, phone, actorType, otp } = {}) => {
  const normalizedActorType = String(actorType || "").trim().toUpperCase();
  const key = makeKey({ phone, actorType: normalizedActorType });

  let sessionStore = "db";
  let session = null;

  try {
    session = await prisma.authOtp.findUnique({
      where: { phone_actorType: { phone, actorType: normalizedActorType } },
      select: { otpHash: true, expiresAt: true, attempts: true },
    });
  } catch (err) {
    const classified = classifyDbError(err);
    const schemaMissing = classified?.code === "P2021" || classified?.code === "schema_missing";
    if (process.env.NODE_ENV !== "production" && schemaMissing) {
      sessionStore = "memory";
      session = memoryOtpSessions.get(key) || null;
    } else {
      throw err;
    }
  }

  if (!session) return { ok: false, status: 400, payload: { message: "OTP not requested. Please request a new OTP." } };
  if (isExpired(session.expiresAt)) return { ok: false, status: 400, payload: { message: "OTP expired. Please request a new OTP." } };
  if (Number(session.attempts || 0) >= OTP_MAX_ATTEMPTS) {
    return { ok: false, status: 429, payload: { message: "Too many invalid attempts. Please request a new OTP." } };
  }

  const ok = bcrypt.compareSync(String(otp), session.otpHash);
  if (!ok) {
    if (sessionStore === "db") {
      await prisma.authOtp.update({
        where: { phone_actorType: { phone, actorType: normalizedActorType } },
        data: { attempts: { increment: 1 } },
      });
    } else {
      const next = { ...session, attempts: Number(session.attempts || 0) + 1 };
      memoryOtpSessions.set(key, next);
    }
    return { ok: false, status: 401, payload: { message: "Invalid OTP" } };
  }

  // OTP is single-use.
  if (sessionStore === "db") {
    await prisma.authOtp.delete({ where: { phone_actorType: { phone, actorType: normalizedActorType } } }).catch(() => {});
  } else {
    memoryOtpSessions.delete(key);
  }

  return { ok: true };
};

