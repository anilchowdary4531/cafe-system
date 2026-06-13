import { inferRoleFromDesignation } from "./staffSessionService.js";
import { isSchemaMissingDbError } from "./dbError.js";

export const requireStaffJwt = async (req, reply, { allowedRoles, matchRestaurantParam, prisma } = {}) => {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ message: "Authentication required" });
    return null;
  }

  if (String(req.user?.type || "") === "customer") {
    reply.code(403).send({ message: "Staff access required" });
    return null;
  }

  const role = String(req.user?.role || "").toUpperCase();
  const tokenSessionVersion = Number(req.user?.sessionVersion || 0) || 0;
  const restaurantId = Number(req.user?.restaurantId || 0) || null;
  const branchId = Number(req.user?.branchId || 0) || null;
  const userId = Number(req.user?.id || 0) || null;

  if (prisma && userId) {
    let user = null;
    let sessionVersionSupported = true;

    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          isActive: true,
          role: true,
          restaurantId: true,
          branchId: true,
          sessionVersion: true,
        },
      });
    } catch (err) {
      if (!isSchemaMissingDbError(err)) throw err;
      sessionVersionSupported = false;
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          isActive: true,
          role: true,
          restaurantId: true,
          branchId: true,
        },
      });
    }

    if (!user || user.isActive === false) {
      reply.code(401).send({ message: "Session expired. Please log in again." });
      return null;
    }

    const dbRole = String(user.role || "").toUpperCase();
    const currentRole =
      dbRole === "SUPER_ADMIN"
        ? "SUPER_ADMIN"
        : dbRole && dbRole !== "STAFF"
          ? dbRole
          : inferRoleFromDesignation(user?.designation) || role || dbRole || "STAFF";
    const currentRestaurantId = Number(user.restaurantId || 0) || null;
    const currentBranchId = Number(user.branchId || 0) || null;
    if (sessionVersionSupported) {
      const currentSessionVersion = Number(user.sessionVersion || 0) || 0;

      if (currentSessionVersion !== tokenSessionVersion) {
        reply.code(401).send({ message: "Session expired. Please log in again." });
        return null;
      }
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

    return { userId, role: currentRole, restaurantId: currentRestaurantId, branchId: currentBranchId };
  }

  if (allowedRoles?.length && role && !allowedRoles.includes(role)) {
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

  return { userId, role, restaurantId, branchId };
};
