import crypto from "crypto";
const DEFAULT_STAFF_LINK_EXPIRES_IN = process.env.STAFF_LOGIN_LINK_EXPIRES_IN || "30d";
const STAFF_MAGIC_LINK_PURPOSE = "STAFF_MAGIC_LINK";

const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

export const inferRoleFromDesignation = (designation) => {
  const text = String(designation || "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, " ");

  if (!text) return null;

  if (text.includes("STEWARD")) return "STEWARD";
  if (text.includes("CLEANER")) return "CLEANER";
  if (text.includes("SWIPER")) return "SWIPER";
  if (text.includes("CASHIER")) return "CASHIER";
  if (text.includes("SERVER") || text.includes("WAITER")) {
    return "WAITER";
  }

  if (text.includes("CHEF")) return "CHEF";
  if (text.includes("MANAGER")) return "MANAGER";
  if (text.includes("OWNER")) return "OWNER";
  if (text.includes("SUPER ADMIN")) return "SUPER_ADMIN";

  return null;
};

const getEffectiveStaffRole = (user) => {
  const baseRole = String(user?.role || "STAFF").toUpperCase();
  if (baseRole === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (baseRole && baseRole !== "STAFF") return baseRole;

  return inferRoleFromDesignation(user?.designation) || baseRole || "STAFF";
};

export const buildStaffLoginPayload = ({ user, normalizeDbPermissions }) => {
  const effectiveRole = getEffectiveStaffRole(user);
  const mustChangePassword = Boolean(user?.mustChangePassword);

  let access = null;
  if (effectiveRole !== "SUPER_ADMIN" && !mustChangePassword) {
    access = typeof normalizeDbPermissions === "function" ? normalizeDbPermissions(user?.staffAccess?.permissions, effectiveRole) : (user?.staffAccess?.permissions || null);
  }

  const userPayload = { ...user, role: effectiveRole, access, mustChangePassword };
  delete userPayload.password;
  delete userPayload.failedLoginAttempts;
  delete userPayload.lastFailedLoginAt;
  delete userPayload.lockedUntil;
  if (userPayload.staffAccess !== undefined) delete userPayload.staffAccess;

  return { userPayload, effectiveRole };
};

export const DEFAULT_STAFF_JWT_EXPIRES_IN = "12h";

export const issueStaffSession = async ({ prisma, app, user, effectiveRole }) => {
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true, mustChangePassword: true },
  });

  const sessionVersion = Number(updated.sessionVersion || 0);
  const mustChangePassword = Boolean(user?.mustChangePassword ?? updated.mustChangePassword);
  const expiresIn = process.env.STAFF_JWT_EXPIRES_IN || DEFAULT_STAFF_JWT_EXPIRES_IN;
  const token = app.jwt.sign(
    {
      id: user.id,
      phone: user.phone || "",
      role: effectiveRole,
      restaurantId: user.restaurantId || null,
      branchId: user.branchId || null,
      sessionVersion,
      mustChangePassword,
    },
    { expiresIn }
  );

  return { token, sessionVersion };
};

export const buildStaffMagicLinkToken = ({ app, user, expiresIn = DEFAULT_STAFF_LINK_EXPIRES_IN }) =>
  app.jwt.sign(
    {
      purpose: STAFF_MAGIC_LINK_PURPOSE,
      staffUserId: user.id,
      restaurantId: user.restaurantId || null,
      branchId: user.branchId || null,
    },
    { expiresIn }
  );

export const buildStaffMagicLinkUrl = ({ frontendUrl, token }) => {
  const base = trimSlash(frontendUrl);
  const path = `/login?mode=staff&staffLink=${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
};

export const consumeStaffMagicLink = async () => {
  const err = new Error("Passwordless login is disabled. Please log in with your email and password.");
  err.statusCode = 403;
  throw err;
};


const STAFF_LOGIN_PURPOSE = "STAFF_LOGIN";
const STAFF_LOGIN_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export const hashStaffLoginToken = (token) =>
  crypto.createHash("sha256").update(String(token || "").trim()).digest("hex");

const isMissingTableError = (err) =>
  err?.code === "P2021" ||
  String(err?.message || "").includes("does not exist in the current database") ||
  String(err?.message || "").includes("relation \"staff_login_tokens\" does not exist");

export const ensureStaffLoginTokensTable = async (prisma) => {
  if (!prisma || typeof prisma.$executeRawUnsafe !== "function") return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "staff_login_tokens" (
        "id" SERIAL NOT NULL,
        "staff_id" INTEGER NOT NULL,
        "restaurant_id" INTEGER NOT NULL,
        "token_hash" TEXT NOT NULL,
        "purpose" TEXT NOT NULL DEFAULT 'STAFF_LOGIN',
        "expires_at" TIMESTAMP(3) NOT NULL,
        "used_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" INTEGER,
        CONSTRAINT "staff_login_tokens_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "staff_login_tokens_token_hash_key" ON "staff_login_tokens"("token_hash");
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "staff_login_tokens_token_hash_idx" ON "staff_login_tokens"("token_hash");
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "staff_login_tokens_staff_id_idx" ON "staff_login_tokens"("staff_id");
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "staff_login_tokens_restaurant_id_idx" ON "staff_login_tokens"("restaurant_id");
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "staff_login_tokens_expires_at_idx" ON "staff_login_tokens"("expires_at");
    `).catch(() => {});

    // Safe foreign key setup (tolerating differences between "users"/"restaurants" and "User"/"Restaurant")
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_login_tokens_staff_id_fkey') THEN
          BEGIN
            ALTER TABLE "staff_login_tokens" ADD CONSTRAINT "staff_login_tokens_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          EXCEPTION WHEN OTHERS THEN
            BEGIN
              ALTER TABLE "staff_login_tokens" ADD CONSTRAINT "staff_login_tokens_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END;
        END IF;
      END $$;
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_login_tokens_restaurant_id_fkey') THEN
          BEGIN
            ALTER TABLE "staff_login_tokens" ADD CONSTRAINT "staff_login_tokens_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          EXCEPTION WHEN OTHERS THEN
            BEGIN
              ALTER TABLE "staff_login_tokens" ADD CONSTRAINT "staff_login_tokens_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END;
        END IF;
      END $$;
    `).catch(() => {});
  } catch (err) {
    console.error("[staffSessionService] Failed to ensure staff_login_tokens table:", err?.message);
  }
};

export const generateStaffLoginToken = async ({
  prisma,
  staffId,
  restaurantId,
  createdBy = null,
  frontendUrl = "",
}) => {
  const staff = await prisma.user.findUnique({
    where: { id: Number(staffId) },
    select: { id: true, restaurantId: true, isActive: true, role: true, name: true, email: true },
  });

  if (!staff || Number(staff.restaurantId) !== Number(restaurantId)) {
    const err = new Error("Staff user not found in this restaurant");
    err.statusCode = 404;
    throw err;
  }

  if (staff.isActive === false) {
    const err = new Error("Cannot generate login link for disabled staff member");
    err.statusCode = 400;
    throw err;
  }

  // Invalidate any previously generated, unconsumed login tokens for this staff member (with self-healing retry)
  try {
    await prisma.staffLoginToken.updateMany({
      where: {
        staffId: Number(staffId),
        restaurantId: Number(restaurantId),
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      await ensureStaffLoginTokensTable(prisma);
      await prisma.staffLoginToken.updateMany({
        where: {
          staffId: Number(staffId),
          restaurantId: Number(restaurantId),
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });
    } else {
      throw err;
    }
  }

  // Generate cryptographically secure random token (256 bits entropy)
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashStaffLoginToken(rawToken);
  const expiresAt = new Date(Date.now() + STAFF_LOGIN_TOKEN_EXPIRY_MS);

  let tokenRecord;
  try {
    tokenRecord = await prisma.staffLoginToken.create({
      data: {
        staffId: Number(staffId),
        restaurantId: Number(restaurantId),
        tokenHash,
        purpose: STAFF_LOGIN_PURPOSE,
        expiresAt,
        createdBy: createdBy ? Number(createdBy) : null,
      },
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      await ensureStaffLoginTokensTable(prisma);
      tokenRecord = await prisma.staffLoginToken.create({
        data: {
          staffId: Number(staffId),
          restaurantId: Number(restaurantId),
          tokenHash,
          purpose: STAFF_LOGIN_PURPOSE,
          expiresAt,
          createdBy: createdBy ? Number(createdBy) : null,
        },
      });
    } else {
      throw err;
    }
  }

  const base = trimSlash(frontendUrl);
  const path = `/login?mode=staff&token=${rawToken}`;
  const loginUrl = base ? `${base}${path}` : path;

  return {
    rawToken,
    loginUrl,
    expiresAt: tokenRecord.expiresAt,
    expiresInMinutes: 10,
    singleUse: true,
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
    },
  };
};

export const resolveStaffRedirectPath = (effectiveRole) => {
  const role = String(effectiveRole || "").toUpperCase();
  if (role === "CHEF") return "/kitchen";
  if (role === "CASHIER") return "/owner/orders";
  if (["OWNER", "MANAGER", "SUPER_ADMIN"].includes(role)) return "/owner/staff";
  return "/server";
};

export const consumeStaffLoginToken = async ({
  prisma,
  app,
  token,
  normalizeDbPermissions,
  req = null,
}) => {
  const rawToken = String(token || "").trim();
  if (!rawToken) {
    const err = new Error("Staff login link token is required");
    err.statusCode = 400;
    throw err;
  }

  const tokenHash = hashStaffLoginToken(rawToken);
  let tokenRecord;
  try {
    tokenRecord = await prisma.staffLoginToken.findUnique({
      where: { tokenHash },
      include: {
        staff: {
          include: {
            restaurant: true,
            staffAccess: { select: { permissions: true, role: true } },
          },
        },
      },
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      await ensureStaffLoginTokensTable(prisma);
      tokenRecord = await prisma.staffLoginToken.findUnique({
        where: { tokenHash },
        include: {
          staff: {
            include: {
              restaurant: true,
              staffAccess: { select: { permissions: true, role: true } },
            },
          },
        },
      });
    } else {
      throw err;
    }
  }

  if (!tokenRecord) {
    const err = new Error("Invalid staff login link");
    err.statusCode = 401;
    throw err;
  }

  if (tokenRecord.purpose !== STAFF_LOGIN_PURPOSE) {
    const err = new Error("Invalid staff login link purpose");
    err.statusCode = 401;
    throw err;
  }

  // Check if token has already been used
  if (tokenRecord.usedAt !== null) {
    const err = new Error("This staff login link has already been used");
    err.statusCode = 401;
    throw err;
  }

  // Check if token has expired
  if (new Date() > new Date(tokenRecord.expiresAt)) {
    const err = new Error("This staff login link has expired");
    err.statusCode = 401;
    throw err;
  }

  const user = tokenRecord.staff;
  if (!user) {
    const err = new Error("Associated staff account not found");
    err.statusCode = 401;
    throw err;
  }

  // Restaurant isolation: check that user belongs to the expected restaurant
  if (!user.restaurantId || Number(user.restaurantId) !== Number(tokenRecord.restaurantId)) {
    const err = new Error("Staff login link is not valid for this restaurant");
    err.statusCode = 403;
    throw err;
  }

  // Disabled staff rejection: a disabled staff account must never authenticate
  if (user.isActive === false) {
    const err = new Error("Account is disabled. Contact owner/admin.");
    err.statusCode = 403;
    throw err;
  }

  // Atomically mark token as consumed to prevent replay or race conditions
  const updateResult = await prisma.staffLoginToken.updateMany({
    where: {
      id: tokenRecord.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      usedAt: new Date(),
    },
  });

  if (updateResult.count === 0) {
    const err = new Error("This staff login link has already been used or expired");
    err.statusCode = 401;
    throw err;
  }

  // Issue standard staff session using established project architecture
  const { userPayload, effectiveRole } = buildStaffLoginPayload({ user, normalizeDbPermissions });
  const { token: sessionToken, sessionVersion } = await issueStaffSession({ prisma, app, user, effectiveRole });
  userPayload.sessionVersion = sessionVersion;

  const redirectPath = resolveStaffRedirectPath(effectiveRole);

  return {
    message: "Login success",
    actorType: "STAFF",
    token: sessionToken,
    user: userPayload,
    redirectPath,
    offlineMode: false,
    tokenId: tokenRecord.id,
    restaurantId: user.restaurantId,
  };
};
