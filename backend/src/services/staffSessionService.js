const DEFAULT_STAFF_LINK_EXPIRES_IN = process.env.STAFF_LOGIN_LINK_EXPIRES_IN || "30d";
const STAFF_MAGIC_LINK_PURPOSE = "STAFF_MAGIC_LINK";

const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

export const inferRoleFromDesignation = (designation) => {
  const text = String(designation || "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, " ");

  if (!text) return null;

  if (text.includes("SERVER") || text.includes("WAITER") || text.includes("STEWARD")) {
    return "WAITER";
  }

  if (text.includes("CHEF")) return "CHEF";
  if (text.includes("MANAGER")) return "MANAGER";
  if (text.includes("CASHIER")) return "CASHIER";
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

  let access = null;
  if (effectiveRole !== "SUPER_ADMIN") {
    access = normalizeDbPermissions(user?.staffAccess?.permissions, effectiveRole);
  }

  const userPayload = { ...user, role: effectiveRole, access };
  delete userPayload.password;
  if (userPayload.staffAccess !== undefined) delete userPayload.staffAccess;

  return { userPayload, effectiveRole };
};

export const issueStaffSession = async ({ prisma, app, user, effectiveRole }) => {
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });

  const sessionVersion = Number(updated.sessionVersion || 0);
  const token = app.jwt.sign({
    id: user.id,
    phone: user.phone || "",
    role: effectiveRole,
    restaurantId: user.restaurantId || null,
    branchId: user.branchId || null,
    sessionVersion,
  });

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

export const consumeStaffMagicLink = async ({ app, prisma, token, normalizeDbPermissions }) => {
  let decoded;
  try {
    decoded = await app.jwt.verify(token);
  } catch {
    const err = new Error("Invalid or expired staff login link");
    err.statusCode = 401;
    throw err;
  }

  const purpose = String(decoded?.purpose || "");
  if (purpose !== STAFF_MAGIC_LINK_PURPOSE) {
    const err = new Error("Invalid staff login link");
    err.statusCode = 401;
    throw err;
  }

  const staffUserId = Number(decoded?.staffUserId || 0);
  if (!staffUserId) {
    const err = new Error("Invalid staff login link");
    err.statusCode = 401;
    throw err;
  }

  const user = await prisma.user.findUnique({
    where: { id: staffUserId },
    include: {
      restaurant: true,
      staffAccess: {
        select: { permissions: true, role: true },
      },
    },
  });

  if (!user) {
    const err = new Error("Account not found or inactive");
    err.statusCode = 404;
    throw err;
  }

  if (user.isActive === false) {
    const err = new Error("Account is disabled. Contact owner/admin.");
    err.statusCode = 403;
    throw err;
  }

  const tokenRestaurantId = Number(decoded?.restaurantId || 0) || null;
  const userRestaurantId = Number(user.restaurantId || 0) || null;
  if (tokenRestaurantId && userRestaurantId && tokenRestaurantId !== userRestaurantId) {
    const err = new Error("Staff login link is not valid for this restaurant");
    err.statusCode = 403;
    throw err;
  }

  const { userPayload, effectiveRole } = buildStaffLoginPayload({ user, normalizeDbPermissions });
  const { token: sessionToken, sessionVersion } = await issueStaffSession({ prisma, app, user, effectiveRole });

  userPayload.sessionVersion = sessionVersion;

  return {
    message: "Login success",
    actorType: "STAFF",
    token: sessionToken,
    user: userPayload,
    offlineMode: false,
  };
};
