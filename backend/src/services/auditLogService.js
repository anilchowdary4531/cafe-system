/**
 * System-wide Audit Trail Service
 */

/**
 * Log a structured audit event to the database and system console
 */
export const logAuditEvent = async ({
    prisma,
    restaurantId = null,
    branchId = null,
    actor = null,
    action,
    entity,
    entityId,
    details = null,
} = {}) => {
    try {
        const rid = restaurantId ? Number(restaurantId) : null;
        const bid = branchId ? Number(branchId) : null;
        const actorUserId = actor?.userId || actor?.id ? Number(actor?.userId || actor?.id) : null;
        const actorName = actor?.userName || actor?.name || actor?.email || "System";
        const actorRole = actor?.role || actor?.actorType || "SYSTEM";

        const log = await prisma.auditLog.create({
            data: {
                restaurantId: rid,
                branchId: bid,
                actorUserId,
                actorName,
                actorRole,
                action: String(action || "UNKNOWN_ACTION").toUpperCase(),
                entity: String(entity || "UNKNOWN_ENTITY"),
                entityId: String(entityId || "0"),
                details: details && typeof details === "object" ? details : null,
            },
        });

        console.log(`[AUDIT LOG #${log.id}] [Rest: ${rid || "Global"}] ${actorName} (${actorRole}) -> ${log.action} on ${log.entity}#${log.entityId}`);
        return log;
    } catch (err) {
        console.error("Failed to log audit event:", err);
        return null;
    }
};

/**
 * Query audit logs with pagination and filters
 */
export const getAuditLogs = async ({
    prisma,
    restaurantId,
    branchId = null,
    action = null,
    entity = null,
    actorUserId = null,
    limit = 50,
    page = 1,
} = {}) => {
    const rid = Number(restaurantId);
    if (!rid) throw new Error("restaurant_id_required");

    const where = { restaurantId: rid };
    if (branchId) where.branchId = Number(branchId);
    if (action) where.action = String(action).toUpperCase();
    if (entity) where.entity = String(entity);
    if (actorUserId) where.actorUserId = Number(actorUserId);

    const take = Math.min(100, Math.max(1, Number(limit)));
    const skip = (Math.max(1, Number(page)) - 1) * take;

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            take,
            skip,
            orderBy: { createdAt: "desc" },
        }),
        prisma.auditLog.count({ where }),
    ]);

    return {
        logs,
        pagination: {
            total,
            page: Number(page),
            limit: take,
            totalPages: Math.ceil(total / take),
        },
    };
};

export const createAuditLog = logAuditEvent;
