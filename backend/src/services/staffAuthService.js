import { inferRoleFromDesignation } from "./staffSessionService.js";

export const getLoginLockoutConfig = () => {
  const rawThreshold = process.env.LOGIN_LOCKOUT_THRESHOLD;
  const rawDuration = process.env.LOGIN_LOCKOUT_DURATION_MINUTES;
  const parsedThreshold = Number(rawThreshold);
  const parsedDuration = Number(rawDuration);
  const threshold = !Number.isNaN(parsedThreshold) && parsedThreshold > 0 ? parsedThreshold : 5;
  const durationMinutes = !Number.isNaN(parsedDuration) && parsedDuration > 0 ? parsedDuration : 15;
  return { threshold, durationMinutes };
};

export const requireStaffJwt = async (req, reply, { allowedRoles, matchRestaurantParam, prisma, allowPasswordChangeOnly } = {}) => {
  try {
    await req.jwtVerify();
  } catch (err) {
    const isExpired =
      err?.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED" ||
      err?.code === "FAST_JWT_EXPIRED" ||
      err?.name === "TokenExpiredError" ||
      String(err?.message || "").toLowerCase().includes("expired");
    req.log?.warn?.(
      {
        reason: isExpired ? "TOKEN_EXPIRED" : "JWT_VERIFY_FAILED",
        code: err?.code,
        endpoint: req.url,
        method: req.method,
        pid: process.pid,
      },
      "staff_auth_rejected"
    );
    reply.code(401).send({
      message: "Authentication required",
      code: isExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
    });
    return null;
  }

  if (String(req.user?.type || "") === "customer") {
    reply.code(403).send({ message: "Staff access required" });
    return null;
  }

  if (req.user?.purpose === "STAFF_PASSWORD_RESET" || req.user?.purpose) {
    reply.code(403).send({ message: "Reset token cannot be used for operational access" });
    return null;
  }

  const role = String(req.user?.role || "").toUpperCase();
  const tokenSessionVersion = Number(req.user?.sessionVersion || 0) || 0;
  const restaurantId = Number(req.user?.restaurantId || 0) || null;
  const branchId = Number(req.user?.branchId || 0) || null;
  const userId = Number(req.user?.id || req.user?.userId || 0) || null;

  if (prisma && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        role: true,
        designation: true,
        name: true,
        restaurantId: true,
        branchId: true,
        sessionVersion: true,
        mustChangePassword: true,
      },
    });

    if (!user || user.isActive === false) {
      reply.code(401).send({ message: "Session expired. Please log in again." });
      return null;
    }

    const dbRole = String(user.role || "").toUpperCase();
    const currentRole =
      dbRole === "SUPER_ADMIN"
        ? "SUPER_ADMIN"
        : inferRoleFromDesignation(user?.designation) ||
          inferRoleFromDesignation(dbRole) ||
          (dbRole && dbRole !== "STAFF" ? dbRole : null) ||
          inferRoleFromDesignation(role) ||
          role ||
          dbRole ||
          "STAFF";
    const currentRestaurantId = Number(user.restaurantId || 0) || null;
    const currentBranchId = Number(user.branchId || 0) || null;
    const currentSessionVersion = Number(user.sessionVersion || 0) || 0;

    if (currentSessionVersion !== tokenSessionVersion) {
      req.log?.warn?.(
        {
          reason: "SESSION_VERSION_MISMATCH",
          userId,
          role: currentRole,
          restaurantId: currentRestaurantId,
          endpoint: req.url,
          method: req.method,
          pid: process.pid,
        },
        "staff_auth_session_version_mismatch"
      );
      reply.code(401).send({ message: "Session expired. Please log in again.", code: "SESSION_VERSION_MISMATCH" });
      return null;
    }

    if (Boolean(user.mustChangePassword) && !allowPasswordChangeOnly) {
      reply.code(403).send({
        message: "Password change required before accessing operational features",
        code: "PASSWORD_CHANGE_REQUIRED",
        mustChangePassword: true,
      });
      return null;
    }

    if (allowedRoles?.length && currentRole && !allowedRoles.includes(currentRole)) {
      reply.code(403).send({ message: "Insufficient role" });
      return null;
    }

    if (matchRestaurantParam) {
      const paramValue = Number(req.params?.[matchRestaurantParam] || 0) || null;
      if (paramValue && currentRestaurantId && paramValue !== currentRestaurantId && currentRole !== "SUPER_ADMIN") {
        reply.code(403).send({ message: "Restaurant access denied" });
        return null;
      }
    }

    return {
      id: userId,
      userId,
      role: currentRole,
      designation: user.designation || null,
      name: user.name || req.user?.name || null,
      restaurantId: currentRestaurantId,
      branchId: currentBranchId,
      mustChangePassword: Boolean(user.mustChangePassword),
    };
  }

  if (Boolean(req.user?.mustChangePassword) && !allowPasswordChangeOnly) {
    reply.code(403).send({
      message: "Password change required before accessing operational features",
      code: "PASSWORD_CHANGE_REQUIRED",
      mustChangePassword: true,
    });
    return null;
  }

  const effectiveRole =
    inferRoleFromDesignation(req.user?.designation) ||
    inferRoleFromDesignation(role) ||
    role ||
    "STAFF";

  if (allowedRoles?.length && effectiveRole && !allowedRoles.includes(effectiveRole)) {
    reply.code(403).send({ message: "Insufficient role" });
    return null;
  }

  if (matchRestaurantParam) {
    const paramValue = Number(req.params?.[matchRestaurantParam] || 0) || null;
    if (paramValue && restaurantId && paramValue !== restaurantId && role !== "SUPER_ADMIN") {
      reply.code(403).send({ message: "Restaurant access denied" });
      return null;
    }
  }

  return {
    id: userId,
    userId,
    role: effectiveRole,
    designation: req.user?.designation || null,
    name: req.user?.name || null,
    restaurantId,
    branchId,
    mustChangePassword: Boolean(req.user?.mustChangePassword),
  };
};
