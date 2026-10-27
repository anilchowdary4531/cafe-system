import { prisma } from "../config/prisma.js";
import { getOrCreateActiveSession } from "../services/tableSessionService.js";

const getSocketEmitter = (req) => {
    return (data, eventName = "waitlist:updated") => {
        if (req.server?.realtime?.emitToRestaurant) {
            req.server.realtime.emitToRestaurant(data.restaurantId, eventName, data);
        } else if (req.server?.realtime?.io) {
            req.server.realtime.io.to(`restaurant_${data.restaurantId}`).emit(eventName, data);
        }
    };
};

// Calculate dynamic estimated wait time based on occupancy and party size
async function calculateEstimatedWait(restaurantId, guestCount, preferredSection) {
    const rid = Number(restaurantId);
    
    // Count active waiting entries ahead in queue
    const waitingAhead = await prisma.waitlist.count({
        where: {
            restaurantId: rid,
            status: "WAITING",
        },
    });

    // Check tables matching capacity/section
    const whereTable = { restaurantId: rid, isActive: true, isBlocked: false };
    if (preferredSection && preferredSection !== "ALL" && preferredSection !== "Main Floor") {
        whereTable.section = preferredSection;
    }

    const tables = await prisma.diningTable.findMany({
        where: whereTable,
        include: {
            tableSessions: {
                where: { status: { in: ["OPEN", "BILLING"] } },
                orderBy: { openedAt: "asc" },
            },
        },
    });

    const suitableTables = tables.filter((t) => t.seats >= Number(guestCount || 1));
    const availableTables = suitableTables.filter((t) => t.tableSessions.length === 0);

    if (availableTables.length > 0 && waitingAhead === 0) {
        return 5; // Immediately available or short turn
    }

    // Average turnover time is ~25 mins per occupied table
    const baseMinutesPerTurn = 25;
    const turnsNeeded = Math.ceil((waitingAhead + 1) / Math.max(1, suitableTables.length));
    return Math.max(10, Math.min(120, turnsNeeded * baseMinutesPerTurn));
}

// 1. GET WAITLIST ENTRIES
export async function getWaitlistController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
        const { status, section, search } = req.query || {};

        if (!restaurantId) {
            return reply.code(400).send({ success: false, message: "restaurantId is required" });
        }

        const where = { restaurantId };
        if (status && status !== "ALL") {
            where.status = String(status).toUpperCase();
        } else if (!status) {
            where.status = { in: ["WAITING", "NOTIFIED"] };
        }

        if (section && section !== "ALL") {
            where.preferredSection = section;
        }

        if (search) {
            const q = String(search).trim();
            where.OR = [
                { customerName: { contains: q, mode: "insensitive" } },
                { customerPhone: { contains: q } },
            ];
        }

        const entries = await prisma.waitlist.findMany({
            where,
            include: {
                customer: true,
                table: true,
            },
            orderBy: { createdAt: "asc" },
        });

        // Compute dynamic stats
        const activeWaitingCount = entries.filter((e) => e.status === "WAITING").length;
        const averageWaitMin = activeWaitingCount > 0 ? activeWaitingCount * 12 : 5;

        return reply.send({
            success: true,
            waitlist: entries,
            summary: {
                totalActive: entries.length,
                waitingCount: activeWaitingCount,
                averageWaitMin,
            },
        });
    } catch (err) {
        console.error("Error fetching waitlist:", err);
        return reply.code(500).send({ success: false, message: err.message || "Failed to fetch waitlist" });
    }
}

// 2. CREATE WAITLIST ENTRY
export async function createWaitlistController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
        const { customerName, customerPhone, guestCount, preferredSection, notes } = req.body || {};

        if (!restaurantId) {
            return reply.code(400).send({ success: false, message: "restaurantId is required" });
        }

        if (!customerName || !customerPhone) {
            return reply.code(400).send({ success: false, message: "Customer name and phone number are required" });
        }

        const cleanPhone = String(customerPhone).trim();
        const cleanName = String(customerName).trim();
        const count = Number(guestCount || 2);

        // Resolve or create Customer CRM entry
        let customer = await prisma.customer.findFirst({
            where: { restaurantId, phone: cleanPhone },
        });

        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    restaurantId,
                    name: cleanName,
                    phone: cleanPhone,
                },
            });
        }

        const estimatedWaitMinutes = await calculateEstimatedWait(restaurantId, count, preferredSection);

        const entry = await prisma.waitlist.create({
            data: {
                restaurantId,
                customerId: customer.id,
                customerName: cleanName,
                customerPhone: cleanPhone,
                guestCount: count,
                preferredSection: preferredSection || "Main Floor",
                notes: notes ? String(notes).trim() : null,
                estimatedWaitMinutes,
                createdById: req.user?.id || null,
                createdByName: req.user?.name || "Staff",
            },
            include: { customer: true },
        });

        const emit = getSocketEmitter(req);
        emit(entry, "waitlist:updated");

        return reply.code(201).send({
            success: true,
            message: `${cleanName} added to Waitlist (${estimatedWaitMinutes} mins est.)`,
            entry,
        });
    } catch (err) {
        console.error("Error creating waitlist entry:", err);
        return reply.code(400).send({ success: false, message: err.message || "Failed to add customer to waitlist" });
    }
}

// 3. NOTIFY WAITLIST CUSTOMER
export async function notifyWaitlistController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
        const waitlistId = Number(req.params.id);

        const entry = await prisma.waitlist.findFirst({
            where: { id: waitlistId, restaurantId },
        });

        if (!entry) {
            return reply.code(404).send({ success: false, message: "Waitlist entry not found" });
        }

        const updated = await prisma.waitlist.update({
            where: { id: waitlistId },
            data: {
                status: "NOTIFIED",
                notifiedAt: new Date(),
            },
            include: { customer: true, table: true },
        });

        // Add Customer Notification
        if (entry.customerId) {
            await prisma.customerNotification.create({
                data: {
                    restaurantId,
                    customerId: entry.customerId,
                    title: "Your Table is Ready! 🍽️",
                    message: `Hello ${entry.customerName}, your table for ${entry.guestCount} guests is ready! Please proceed to the host stand.`,
                },
            }).catch(() => {});
        }

        const emit = getSocketEmitter(req);
        emit(updated, "waitlist:updated");

        return reply.send({
            success: true,
            message: `Notification sent to ${entry.customerName} (${entry.customerPhone})`,
            entry: updated,
        });
    } catch (err) {
        console.error("Error notifying waitlist entry:", err);
        return reply.code(400).send({ success: false, message: err.message || "Failed to notify waitlist customer" });
    }
}

// 4. SEAT WAITLIST CUSTOMER AT TABLE
export async function seatWaitlistController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
        const waitlistId = Number(req.params.id);
        const { tableId } = req.body || {};

        if (!tableId) {
            return reply.code(400).send({ success: false, message: "tableId is required to seat customer" });
        }

        const tid = Number(tableId);

        // Check if table exists and is not blocked
        const table = await prisma.diningTable.findFirst({
            where: { id: tid, restaurantId, isActive: true },
        });

        if (!table) {
            return reply.code(404).send({ success: false, message: "Selected table not found or inactive" });
        }

        if (table.isBlocked) {
            return reply.code(400).send({
                success: false,
                message: `Table ${table.tableNo} is BLOCKED (${table.blockReason || "Maintenance"}). Cannot seat guests.`,
            });
        }

        const entry = await prisma.waitlist.findFirst({
            where: { id: waitlistId, restaurantId },
        });

        if (!entry) {
            return reply.code(404).send({ success: false, message: "Waitlist entry not found" });
        }

        // Open TableSession
        const session = await getOrCreateActiveSession({
            prisma,
            restaurantId,
            tableId: tid,
            waiterId: req.user?.id || null,
            waiterName: req.user?.name || "Staff",
            guestCount: Number(entry.guestCount || 1),
            clientOperationId: `SEAT-WL-${Date.now()}`,
        });

        // Update Waitlist entry
        const updated = await prisma.waitlist.update({
            where: { id: waitlistId },
            data: {
                status: "SEATED",
                seatedAt: new Date(),
                tableId: tid,
            },
            include: { customer: true, table: true },
        });

        const emit = getSocketEmitter(req);
        emit(updated, "waitlist:updated");
        emit({ restaurantId, tableId: tid }, "table:updated");

        return reply.send({
            success: true,
            message: `${entry.customerName} seated at Table ${table.tableNo}!`,
            entry: updated,
            session,
        });
    } catch (err) {
        console.error("Error seating waitlist customer:", err);
        return reply.code(400).send({ success: false, message: err.message || "Failed to seat waitlist customer" });
    }
}

// 5. CANCEL WAITLIST ENTRY
export async function cancelWaitlistController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
        const waitlistId = Number(req.params.id);

        const entry = await prisma.waitlist.findFirst({
            where: { id: waitlistId, restaurantId },
        });

        if (!entry) {
            return reply.code(404).send({ success: false, message: "Waitlist entry not found" });
        }

        const updated = await prisma.waitlist.update({
            where: { id: waitlistId },
            data: {
                status: "CANCELLED",
                cancelledAt: new Date(),
            },
            include: { customer: true },
        });

        const emit = getSocketEmitter(req);
        emit(updated, "waitlist:updated");

        return reply.send({
            success: true,
            message: `Waitlist entry for ${entry.customerName} cancelled`,
            entry: updated,
        });
    } catch (err) {
        console.error("Error cancelling waitlist entry:", err);
        return reply.code(400).send({ success: false, message: err.message || "Failed to cancel waitlist entry" });
    }
}
