import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const readInt = (value, fallback) => {
  const n = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(n) ? n : fallback;
};

const OTP_LENGTH = readInt(process.env.OTP_LENGTH, 6);
const OTP_TTL_MS = readInt(process.env.OTP_TTL_MS, 5 * 60_000);
const OTP_RESEND_COOLDOWN_MS = readInt(process.env.OTP_RESEND_COOLDOWN_MS, 30_000);
const OTP_MAX_ATTEMPTS = readInt(process.env.OTP_MAX_ATTEMPTS, 5);

// Dev-friendly fallback when the OTP table isn't created yet.
// This keeps local OTP flows usable even before Prisma `db push` is run.
const memoryOtpSessions = new Map(); // phone -> { otpHash, expiresAt, attempts, lastSentAt }

const isExpired = (d) => {
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? true : t <= Date.now();
};

export const classifyDbError = (err) => {
  const code = String(err?.code || "");
  const message = String(err?.message || "");

  // Prisma error codes (common ones we hit during local setup).
  if (code === "P1001") {
    return {
      status: 503,
      message: "Database is unreachable. Start Postgres and verify DATABASE_URL (host/port 5432).",
      code,
    };
  }
  if (code === "P1000") {
    return {
      status: 503,
      message: "Database authentication failed. Verify DATABASE_URL username/password.",
      code,
    };
  }
  if (code === "P2021" || message.toLowerCase().includes("does not exist")) {
    return {
      status: 500,
      message: "Database schema is not ready. Run `cd backend && npm run db:push` once, then retry.",
      code: code || "schema_missing",
    };
  }

  return null;
};

export const generateOtp = () => {
  const max = 10 ** OTP_LENGTH;
  const value = crypto.randomInt(0, max);
  return String(value).padStart(OTP_LENGTH, "0");
};

export const requestOtp = async ({ prisma, phone } = {}) => {
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
    const existing = await prisma.customerOtp.findUnique({
      where: { phone },
      select: { lastSentAt: true },
    });
    const cooldown = checkCooldown(existing?.lastSentAt);
    if (cooldown) return { ok: false, ...cooldown };
  } catch (err) {
    const classified = classifyDbError(err);
    const schemaMissing = classified?.code === "P2021" || classified?.code === "schema_missing";
    if (process.env.NODE_ENV !== "production" && schemaMissing) {
      usedMemory = true;
      const existing = memoryOtpSessions.get(phone);
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
      await prisma.customerOtp.upsert({
        where: { phone },
        update: { otpHash, expiresAt, attempts: 0, lastSentAt },
        create: { phone, otpHash, expiresAt, attempts: 0, lastSentAt },
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
    memoryOtpSessions.set(phone, { otpHash, expiresAt, attempts: 0, lastSentAt });
  }

  const shouldReturnDevOtp =
    process.env.NODE_ENV !== "production" &&
    String(process.env.RETURN_DEV_OTP || "true").toLowerCase() !== "false";

  return {
    ok: true,
    phone,
    expiresAt,
    code,
    devOtp: shouldReturnDevOtp ? code : undefined,
  };
};

export const verifyOtp = async ({ prisma, phone, otp } = {}) => {
  let sessionStore = "db";
  let session = null;

  try {
    session = await prisma.customerOtp.findUnique({
      where: { phone },
      select: { otpHash: true, expiresAt: true, attempts: true },
    });
  } catch (err) {
    const classified = classifyDbError(err);
    const schemaMissing = classified?.code === "P2021" || classified?.code === "schema_missing";
    if (process.env.NODE_ENV !== "production" && schemaMissing) {
      sessionStore = "memory";
      session = memoryOtpSessions.get(phone) || null;
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
      await prisma.customerOtp.update({
        where: { phone },
        data: { attempts: { increment: 1 } },
      });
    } else {
      const next = { ...session, attempts: Number(session.attempts || 0) + 1 };
      memoryOtpSessions.set(phone, next);
    }
    return { ok: false, status: 401, payload: { message: "Invalid OTP" } };
  }

  // OTP is single-use.
  if (sessionStore === "db") {
    await prisma.customerOtp.delete({ where: { phone } }).catch(() => {});
  } else {
    memoryOtpSessions.delete(phone);
  }

  return { ok: true };
};
