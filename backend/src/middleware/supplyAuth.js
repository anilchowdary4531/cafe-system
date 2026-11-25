import prisma from "../prisma.js";
import { requireStaffJwt } from "../services/staffAuthService.js";

export const SUPPLY_STAFF_ALLOWED_ROLES = [
    "OWNER",
    "MANAGER",
    "SUPER_ADMIN",
    "WAITER",
    "CHEF",
    "CASHIER",
    "STEWARD",
    "CLEANER",
    "SWIPER",
    "STAFF",
];

export const SUPPLY_MANAGEMENT_ROLES = ["OWNER", "MANAGER", "SUPER_ADMIN"];

function parsePermissions(rawPermissions) {
    if (!rawPermissions) return {};
    if (typeof rawPermissions === "string") {
        try {
            const parsed = JSON.parse(rawPermissions);
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
    }
    return typeof rawPermissions === "object" ? rawPermissions : {};
}

export function resolveSupplyRestaurantScope(req, reply, actor) {
    const role = String(actor?.role || "").toUpperCase();
    const paramRid = req.params?.restaurantId !== undefined ? Number(req.params.restaurantId) : null;
    const queryRid = req.query?.restaurantId !== undefined && req.query?.restaurantId !== ""
        ? Number(req.query.restaurantId)
        : null;
    const bodyRid = req.body?.restaurantId !== undefined && req.body?.restaurantId !== ""
        ? Number(req.body.restaurantId)
        : null;

    if (role === "SUPER_ADMIN") {
        const requested = paramRid || queryRid || bodyRid || Number(actor.restaurantId || 0) || null;
        if (!requested || !Number.isFinite(requested) || requested <= 0) {
            reply.code(400).send({ error: "Bad Request", message: "Valid restaurantId is required" });
            return null;
        }
        return requested;
    }

    const actorRid = Number(actor?.restaurantId || 0) || null;
    if (!actorRid || !Number.isFinite(actorRid) || actorRid <= 0) {
        reply.code(403).send({ error: "Forbidden", message: "Restaurant membership required" });
        return null;
    }

    for (const candidate of [paramRid, queryRid, bodyRid]) {
        if (candidate !== null && candidate !== undefined && candidate !== 0) {
            if (!Number.isFinite(candidate) || candidate !== actorRid) {
                reply.code(403).send({ error: "Forbidden", message: "Restaurant access denied" });
                return null;
            }
        }
    }

    return actorRid;
}

export function requireSupplyActor({ requiredModules = ["supply"] } = {}) {
    const modulesToCheck = Array.isArray(requiredModules) ? requiredModules : [requiredModules];

    return async function supplyActorPreHandler(req, reply) {
        const actor = await requireStaffJwt(req, reply, {
            prisma,
            allowedRoles: SUPPLY_STAFF_ALLOWED_ROLES,
            matchRestaurantParam: "restaurantId",
        });
        if (!actor) return reply;

        const role = String(actor.role || "").toUpperCase();
        if (!SUPPLY_MANAGEMENT_ROLES.includes(role)) {
            let permissions = {};
            if (actor.userId && typeof prisma?.staffAccess?.findUnique === "function") {
                const accessRow = await prisma.staffAccess.findUnique({
                    where: { userId: actor.userId },
                    select: { permissions: true },
                });
                permissions = parsePermissions(accessRow?.permissions);
            }
            const hasModule = modulesToCheck.some((mod) => Boolean(permissions?.[mod]));
            if (!hasModule) {
                return reply.code(403).send({
                    error: "Forbidden",
                    message: "Insufficient module permissions for supply chain access",
                });
            }
        }

        const restaurantId = resolveSupplyRestaurantScope(req, reply, actor);
        if (!restaurantId) return reply;

        req.staffActor = actor;
        req.supplyRestaurantId = restaurantId;
        return null;
    };
}

export async function requireMarketplaceBrowseActor(req, reply) {
    try {
        await req.jwtVerify();
    } catch {
        return reply.code(401).send({ error: "Unauthorized", message: "Invalid or missing token" });
    }

    const role = String(req.user?.role || "").toUpperCase();
    if (role === "SUPPLIER" && req.user?.supplierId) {
        req.supplierActor = {
            supplierId: Number(req.user.supplierId),
            role: "SUPPLIER",
        };
        return null;
    }

    return requireSupplyActor({ requiredModules: ["supply"] })(req, reply);
}

export async function requireSupplyChatActor(req, reply) {
    try {
        await req.jwtVerify();
    } catch {
        return reply.code(401).send({ error: "Unauthorized", message: "Invalid or missing token" });
    }

    const role = String(req.user?.role || "").toUpperCase();
    if (role === "SUPPLIER" && req.user?.supplierId) {
        req.supplyChatActor = {
            type: "SUPPLIER",
            supplierId: Number(req.user.supplierId),
            role: "SUPPLIER",
        };
        return null;
    }

    const supplyPreHandler = requireSupplyActor({ requiredModules: ["supply"] });
    const result = await supplyPreHandler(req, reply);
    if (reply.sent) return reply;
    if (!req.staffActor || !req.supplyRestaurantId) return reply;

    req.supplyChatActor = {
        type: "RESTAURANT",
        restaurantId: req.supplyRestaurantId,
        userId: req.staffActor.userId,
        role: req.staffActor.role,
    };
    return result;
}
