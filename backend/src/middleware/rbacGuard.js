export function authorizeRoles(...allowedRoles) {
    return async function (req, reply) {
        try {
            await req.jwtVerify();
        } catch {
            return reply.code(401).send({ error: "Unauthorized", message: "Invalid or missing token" });
        }

        const user = req.user || req.staffActor;
        if (!user || !user.role) {
            return reply.code(403).send({ error: "Forbidden", message: "User role missing" });
        }

        const userRole = String(user.role).toUpperCase();
        const hasAccess = allowedRoles.some((role) => String(role).toUpperCase() === userRole);

        if (!hasAccess) {
            return reply.code(403).send({
                error: "Forbidden",
                message: `Role ${userRole} is not authorized for this resource`,
            });
        }
    };
}

export default authorizeRoles;
