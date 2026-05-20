export const requireStaffJwt = async (req, reply, { allowedRoles, matchRestaurantParam } = {}) => {
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
  const restaurantId = Number(req.user?.restaurantId || 0) || null;
  const branchId = Number(req.user?.branchId || 0) || null;
  const userId = Number(req.user?.id || 0) || null;

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

