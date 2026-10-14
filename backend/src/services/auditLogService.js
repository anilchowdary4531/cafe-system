/**
 * System-wide Audit Trail Service — Tiffzy Phase 3D
 */

const SENSITIVE_KEYS = [
    "password",
    "passwordhash",
    "currentpassword",
    "newpassword",
    "temppassword",
    "temporarypassword",
    "otp",
    "otphash",
    "resettoken",
    "token",
    "jwt",
    "authorization",
    "cookie",
];

/**
 * Recursively sanitize details to guarantee sensitive credentials
 * are never stored in or returned from audit logs.
 */
export const sanitizeAuditDetails = (details) => {
    if (!details || typeof details !== "object") return details;
    if (Array.isArray(details)) {
        return details.map((item) => sanitizeAuditDetails(item));
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(details)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));
        if (isSensitive) {
            // Strip sensitive field entirely
            continue;
        }
        if (value && typeof value === "object") {
            sanitized[key] = sanitizeAuditDetails(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};

/**
 * Safely extract server-derived IP address and User-Agent from a Fastify/Express request.
 * Does not trust arbitrary client headers unless server proxy is configured.
 */
export const extractRequestMetadata = (req) => {
    if (!req) return { ipAddress: null, userAgent: null };

    // Prefer server-derived connection address
    const ipAddress =
        req.ip ||
        req.raw?.socket?.remoteAddress ||
        req.socket?.remoteAddress ||
        (req.headers && req.headers["x-real-ip"]) ||
        null;

    const rawUa = req.headers ? req.headers["user-agent"] : null;
    const userAgent = rawUa ? String(rawUa).slice(0, 500) : null;

    return { ipAddress, userAgent };
};

/**
 * Log a structured audit event to the database and system console.
 * Safe and non-blocking: failures will NEVER throw or break the primary business transaction.
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
    ipAddress = null,
    userAgent = null,
    severity = "INFO",
    status = "SUCCESS",
    req = null,
} = {}) => {
    try {
        if (!prisma) {
            console.warn("[AUDIT LOG WARNING] Prisma client not provided to logAuditEvent");
            return null;
        }

        const rid = restaurantId ? Number(restaurantId) : null;
        const bid = branchId ? Number(branchId) : null;
        const actorUserId = actor?.userId || actor?.id ? Number(actor?.userId || actor?.id) : null;
        const actorName = actor?.userName || actor?.name || actor?.email || "System";
        const actorRole = actor?.role || actor?.actorType || "SYSTEM";

        // Extract connection metadata if req is supplied
        const reqMeta = extractRequestMetadata(req);
        const resolvedIp = ipAddress || reqMeta.ipAddress;
        const resolvedUa = userAgent || reqMeta.userAgent;

        // Sanitize details to prevent accidental credential leakage
        const sanitizedDetails = details && typeof details === "object"
            ? sanitizeAuditDetails(details)
            : null;

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
                details: sanitizedDetails,
                ipAddress: resolvedIp ? String(resolvedIp).slice(0, 100) : null,
                userAgent: resolvedUa ? String(resolvedUa).slice(0, 500) : null,
                severity: String(severity || "INFO").toUpperCase(),
                status: String(status || "SUCCESS").toUpperCase(),
            },
        });

        console.log(
            `[AUDIT LOG #${log.id}] [Rest: ${rid || "Global"}] [${log.severity}] [${log.status}] ${actorName} (${actorRole}) -> ${log.action} on ${log.entity}#${log.entityId}`
        );
        return log;
    } catch (err) {
        // Non-blocking: record failure to server console, do not throw
        console.error("Failed to log audit event safely:", err?.message || err);
        return null;
    }
};

/**
 * Query audit logs with pagination, filtering, and sanitization.
 */
export const getAuditLogs = async ({
    prisma,
    restaurantId,
    branchId = null,
    action = null,
    entity = null,
    actorUserId = null,
    severity = null,
    status = null,
    startDate = null,
    endDate = null,
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
    if (severity) where.severity = String(severity).toUpperCase();
    if (status) where.status = String(status).toUpperCase();

    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const take = Math.min(100, Math.max(1, Number(limit)));
    const skip = (Math.max(1, Number(page)) - 1) * take;

    const [rawLogs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            take,
            skip,
            orderBy: { createdAt: "desc" },
        }),
        prisma.auditLog.count({ where }),
    ]);

    // Sanitize any metadata in logs before returning
    const logs = rawLogs.map((log) => ({
        ...log,
        details: sanitizeAuditDetails(log.details),
    }));

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
