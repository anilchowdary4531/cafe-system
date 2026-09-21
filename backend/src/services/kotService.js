import { generateKotEscposBuffer, printToNetworkPrinter } from "./escposService.js";

/**
 * Generate sequential, concurrency-safe KOT number for a restaurant
 */
export const getNextKotNumber = async (tx, restaurantId) => {
    const restaurant = await tx.restaurant.update({
        where: { id: restaurantId },
        data: { nextKotNumber: { increment: 1 } },
        select: { nextKotNumber: true },
    });
    const seq = restaurant.nextKotNumber - 1;
    return {
        seq,
        kotNo: `KOT-${String(seq).padStart(3, "0")}`,
    };
};

/**
 * Create Station-routed KOT tickets for an order
 */
export const createKotsForOrder = async ({ prisma, tx = prisma, order, actor, idempotencyKey = null } = {}) => {
    const restaurantId = Number(order.restaurantId);
    if (!restaurantId) throw new Error("restaurant_id_required");

    // 1. Idempotency Check: Avoid duplicate KOTs for double clicks
    if (idempotencyKey) {
        const existing = await tx.kitchenOrderTicket.findMany({
            where: { restaurantId, idempotencyKey },
            include: { items: true, station: true },
        });
        if (existing.length > 0) {
            return existing;
        }
    }

    // 2. Fetch Order Items with Menu Item Station Mappings
    const orderItems = await tx.orderItem.findMany({
        where: { orderId: order.id },
    });
    if (!orderItems.length) return [];

    const menuItemIds = [...new Set(orderItems.map((i) => i.menuItemId).filter(Boolean))];
    const menuItems = menuItemIds.length > 0
        ? await tx.menuItem.findMany({
              where: { id: { in: menuItemIds } },
              select: { id: true, kitchenStationId: true },
          })
        : [];
    const stationMap = new Map(menuItems.map((m) => [m.id, m.kitchenStationId]));

    // 3. Fetch Restaurant Kitchen Stations
    const stations = await tx.kitchenStation.findMany({
        where: { restaurantId, isActive: true },
        include: { printer: true },
    });

    let defaultStation = stations.find((s) => s.isDefault) || stations[0] || null;

    // Group order items by target kitchen station ID
    const itemsByStation = new Map();
    for (const item of orderItems) {
        let stationId = item.menuItemId ? stationMap.get(item.menuItemId) : null;
        if (!stationId && defaultStation) {
            stationId = defaultStation.id;
        }

        const key = stationId || "UNASSIGNED";
        if (!itemsByStation.has(key)) {
            itemsByStation.set(key, []);
        }
        itemsByStation.get(key).push(item);
    }

    const createdKots = [];

    // 4. Create separate KOT for each station group inside transaction
    for (const [stKey, items] of itemsByStation.entries()) {
        const stationObj = typeof stKey === "number" ? stations.find((s) => s.id === stKey) : null;
        const stationName = stationObj?.name || (defaultStation ? defaultStation.name : "MAIN KITCHEN");

        const { seq, kotNo } = await getNextKotNumber(tx, restaurantId);

        const kot = await tx.kitchenOrderTicket.create({
            data: {
                kotNo,
                sequenceNumber: seq,
                restaurantId,
                tableSessionId: order.tableSessionId || null,
                orderId: order.id,
                stationId: stationObj?.id || null,
                stationName,
                tableNo: order.tableNo || null,
                waiterId: actor?.userId || null,
                waiterName: actor?.userName || order.customerName || "Staff",
                type: "NEW",
                status: "PENDING",
                printed: false,
                notes: order.notes || null,
                idempotencyKey: idempotencyKey ? `${idempotencyKey}_st_${stKey}` : null,
                items: {
                    create: items.map((it) => ({
                        orderItemId: it.id,
                        menuItemId: it.menuItemId,
                        itemName: it.itemName,
                        variantId: it.variantId || null,
                        variantName: it.variantName || null,
                        variantPrice: it.variantPrice || null,
                        selectedModifiers: it.selectedModifiers || null,
                        notes: it.notes || null,
                        qty: it.qty,
                        status: "PENDING",
                    })),
                },
            },
            include: {
                items: true,
                station: { include: { printer: true } },
            },
        });

        createdKots.push(kot);
    }

    return createdKots;
};

/**
 * Dispatch ESC/POS Print job to Network Printer
 */
export const dispatchKotPrint = async ({ prisma, kotId } = {}) => {
    const kot = await prisma.kitchenOrderTicket.findUnique({
        where: { id: Number(kotId) },
        include: {
            items: true,
            station: { include: { printer: true } },
        },
    });

    if (!kot) throw new Error("kot_not_found");

    const printer = kot.station?.printer;
    if (!printer || !printer.isActive || !printer.ipAddress) {
        await prisma.kitchenOrderTicket.update({
            where: { id: kot.id },
            data: {
                printed: false,
                printError: "No active IP printer configured for station",
                status: kot.status === "PENDING" ? "PRINT_FAILED" : kot.status,
            },
        });
        return { ok: false, message: "No printer mapped", kot };
    }

    try {
        const buffer = generateKotEscposBuffer({ kot, paperWidth: printer.paperWidth });
        await printToNetworkPrinter({
            ipAddress: printer.ipAddress,
            port: printer.port || 9100,
            buffer,
        });

        const updated = await prisma.kitchenOrderTicket.update({
            where: { id: kot.id },
            data: {
                printed: true,
                printedAt: new Date(),
                printError: null,
                status: kot.status === "PENDING" || kot.status === "PRINT_FAILED" ? "PRINTED" : kot.status,
            },
            include: { items: true, station: true },
        });

        return { ok: true, kot: updated };
    } catch (err) {
        const updated = await prisma.kitchenOrderTicket.update({
            where: { id: kot.id },
            data: {
                printed: false,
                printError: String(err?.message || "Print failed"),
                status: kot.status === "PENDING" ? "PRINT_FAILED" : kot.status,
            },
            include: { items: true, station: true },
        });

        return { ok: false, message: err?.message, kot: updated };
    }
};

/**
 * Mark KOT status transition (PENDING -> PREPARING -> READY -> SERVED / CANCELLED)
 */
export const updateKotStatus = async ({ prisma, kotId, restaurantId, nextStatus } = {}) => {
    const id = Number(kotId);
    const validStatuses = ["PENDING", "PRINTED", "PRINT_FAILED", "PREPARING", "READY", "SERVED", "CANCELLED"];
    const status = String(nextStatus || "").trim().toUpperCase();

    if (!validStatuses.includes(status)) {
        throw new Error(`Invalid KOT status '${nextStatus}'`);
    }

    const existing = await prisma.kitchenOrderTicket.findFirst({
        where: { id, restaurantId: Number(restaurantId) },
        include: { items: true, station: true },
    });

    if (!existing) throw new Error("kot_not_found");

    const updated = await prisma.kitchenOrderTicket.update({
        where: { id },
        data: {
            status,
            items: {
                updateMany: {
                    where: { kotId: id },
                    data: { status },
                },
            },
        },
        include: { items: true, station: { include: { printer: true } } },
    });

    return updated;
};

/**
 * Trigger KOT Reprint
 */
export const reprintKot = async ({ prisma, kotId, restaurantId } = {}) => {
    const id = Number(kotId);
    const kot = await prisma.kitchenOrderTicket.findFirst({
        where: { id, restaurantId: Number(restaurantId) },
        include: { items: true, station: { include: { printer: true } } },
    });
    if (!kot) throw new Error("kot_not_found");

    const updatedKot = await prisma.kitchenOrderTicket.update({
        where: { id },
        data: {
            reprintCount: { increment: 1 },
        },
        include: { items: true, station: { include: { printer: true } } },
    });

    return dispatchKotPrint({ prisma, kotId: id });
};
