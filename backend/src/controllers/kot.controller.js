import { testPrinterConnection } from "../services/escposService.js";
import { dispatchKotPrint, reprintKot, updateKotStatus, updateKotItemStatus, updateKotPriority } from "../services/kotService.js";
import prisma from "../prisma.js";

/**
 * Fetch KOTs for a restaurant with status, station, priority, source, table & search query filters
 */
export const getKots = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

    const { status, stationId, priority, source, tableNo, tableSessionId, q, limit = 100 } = req.query;

    const where = { restaurantId };
    if (status) where.status = String(status).toUpperCase();
    if (stationId) where.stationId = Number(stationId);
    if (priority) where.priority = String(priority).toUpperCase();
    if (tableNo) where.tableNo = String(tableNo).trim();
    if (tableSessionId) where.tableSessionId = Number(tableSessionId);

    if (source || q) {
      where.order = {};
      if (source) where.order.orderSource = String(source).toUpperCase();
      if (q) {
        const queryStr = String(q).trim();
        where.OR = [
          { kotNo: { contains: queryStr, mode: "insensitive" } },
          { tableNo: { contains: queryStr, mode: "insensitive" } },
          { order: { orderNo: { contains: queryStr, mode: "insensitive" } } },
        ];
      }
    }

    const db = req.prisma || prisma;
    const kots = await db.kitchenOrderTicket.findMany({
      where,
      take: Math.min(200, Math.max(1, Number(limit))),
      orderBy: [
        { priority: "desc" },
        { createdAt: "asc" },
      ],
      include: {
        items: true,
        station: { include: { printer: true } },
        order: {
          select: {
            id: true,
            orderNo: true,
            orderSource: true,
            customerName: true,
            tableNo: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    return res.send({ ok: true, kots });
  } catch (err) {
    console.error("getKots error:", err);
    return res.status(500).send({ message: err?.message || "Failed to fetch KOTs" });
  }
};

/**
 * Update KOT Status (PENDING, ACCEPTED, PREPARING, READY, SERVED, CANCELLED)
 */
export const updateStatus = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const kotId = Number(req.params.kotId || 0);
    const { status } = req.body;

    if (!restaurantId || !kotId) return res.status(400).send({ message: "Missing required IDs" });

    const actor = req.user ? { userId: req.user.id, userName: req.user.name || req.user.email } : null;

    const updatedKot = await updateKotStatus({
      prisma: req.prisma,
      kotId,
      restaurantId,
      nextStatus: status,
      actor,
    });

    // Realtime notification & broadcast
    if (req.app.get("io")) {
      const io = req.app.get("io");
      io.to(`restaurant_${restaurantId}`).emit("kot:status_updated", updatedKot);
      io.to(`restaurant:${restaurantId}`).emit("kot:status_updated", updatedKot);
    }

    return res.send({ ok: true, kot: updatedKot });
  } catch (err) {
    console.error("updateKotStatus error:", err);
    return res.status(500).send({ message: err?.message || "Failed to update KOT status" });
  }
};

/**
 * Update Item-Level KDS Status (PENDING, PREPARING, READY, CANCELLED)
 */
export const updateItemStatus = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const kotId = Number(req.params.kotId || 0);
    const itemId = Number(req.params.itemId || 0);
    const { status } = req.body;

    if (!restaurantId || !kotId || !itemId) {
      return res.status(400).send({ message: "Missing required parameters" });
    }

    const actor = req.user ? { userId: req.user.id, userName: req.user.name || req.user.email } : null;

    const { kot, order } = await updateKotItemStatus({
      prisma: req.prisma,
      kotId,
      itemId,
      restaurantId,
      nextStatus: status,
      actor,
    });

    if (req.app.get("io")) {
      const io = req.app.get("io");
      io.to(`restaurant_${restaurantId}`).emit("kot:item_updated", { kotId, itemId, status, kot });
      io.to(`restaurant:${restaurantId}`).emit("kot:item_updated", { kotId, itemId, status, kot });
      io.to(`restaurant_${restaurantId}`).emit("kot:status_updated", kot);
      io.to(`restaurant:${restaurantId}`).emit("kot:status_updated", kot);
      if (order) {
        io.to(`restaurant_${restaurantId}`).emit("order:updated", order);
        io.to(`restaurant:${restaurantId}`).emit("order:updated", order);
      }
    }

    return res.send({ ok: true, kot, order });
  } catch (err) {
    console.error("updateItemStatus error:", err);
    return res.status(500).send({ message: err?.message || "Failed to update item status" });
  }
};

/**
 * Update KOT Priority (NORMAL, HIGH, URGENT)
 */
export const updatePriority = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const kotId = Number(req.params.kotId || 0);
    const { priority } = req.body;

    if (!restaurantId || !kotId || !priority) {
      return res.status(400).send({ message: "Missing required parameters" });
    }

    const updated = await updateKotPriority({
      prisma: req.prisma,
      kotId,
      restaurantId,
      priority,
    });

    if (req.app.get("io")) {
      const io = req.app.get("io");
      io.to(`restaurant_${restaurantId}`).emit("kot:priority_updated", updated);
      io.to(`restaurant:${restaurantId}`).emit("kot:priority_updated", updated);
      io.to(`restaurant_${restaurantId}`).emit("kot:status_updated", updated);
    }

    return res.send({ ok: true, kot: updated });
  } catch (err) {
    console.error("updatePriority error:", err);
    return res.status(500).send({ message: err?.message || "Failed to update priority" });
  }
};

/**
 * Fetch KDS Live Workload Metrics
 */
export const getWorkloadMetrics = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

    const db = req.prisma || prisma;
    const kots = await db.kitchenOrderTicket.findMany({
      where: {
        restaurantId,
        status: { in: ["PENDING", "ACCEPTED", "PRINTED", "PREPARING", "READY"] },
      },
      select: {
        id: true,
        status: true,
        priority: true,
        createdAt: true,
        estimatedPrepTimeMinutes: true,
      },
    });

    const now = Date.now();
    let newCount = 0;
    let preparingCount = 0;
    let readyCount = 0;
    let overdueCount = 0;
    let urgentCount = 0;
    let totalPrepMinutes = 0;
    let completedCount = 0;

    for (const kot of kots) {
      if (kot.status === "PENDING" || kot.status === "ACCEPTED" || kot.status === "PRINTED") {
        newCount++;
      } else if (kot.status === "PREPARING") {
        preparingCount++;
      } else if (kot.status === "READY") {
        readyCount++;
      }

      if (kot.priority === "URGENT" || kot.priority === "HIGH") {
        urgentCount++;
      }

      const elapsedMinutes = Math.floor((now - new Date(kot.createdAt).getTime()) / 60000);
      const estPrep = kot.estimatedPrepTimeMinutes || 15;
      if (kot.status !== "READY" && elapsedMinutes > estPrep) {
        overdueCount++;
      }

      totalPrepMinutes += elapsedMinutes;
      completedCount++;
    }

    const averagePrepMinutes = completedCount > 0 ? Math.round(totalPrepMinutes / completedCount) : 0;

    return res.send({
      ok: true,
      metrics: {
        newCount,
        preparingCount,
        readyCount,
        overdueCount,
        urgentCount,
        averagePrepMinutes,
        totalActiveCount: kots.length,
      },
    });
  } catch (err) {
    console.error("getWorkloadMetrics error:", err);
    return res.status(500).send({ message: err?.message || "Failed to fetch kitchen workload metrics" });
  }
};

/**
 * Reprint KOT
 */
export const triggerReprint = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const kotId = Number(req.params.kotId || 0);

    if (!restaurantId || !kotId) return res.status(400).send({ message: "Missing required IDs" });

    const result = await reprintKot({
      prisma: req.prisma,
      kotId,
      restaurantId,
    });

    return res.send({ ok: true, result });
  } catch (err) {
    console.error("triggerReprint error:", err);
    return res.status(500).send({ message: err?.message || "Failed to reprint KOT" });
  }
};

/**
 * PRINTER MANAGEMENT & TESTING
 */
export const getPrinters = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

    const db = req.prisma || prisma;
    const printers = await db.printer.findMany({
      where: { restaurantId },
      include: { stations: true },
      orderBy: { createdAt: "asc" },
    });

    return res.send({ ok: true, printers });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to fetch printers" });
  }
};

export const createPrinter = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

    const { name, connectionType, ipAddress, port, paperWidth, isBillingPrinter } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).send({ message: "Printer name is required" });
    }

    const db = req.prisma || prisma;
    const printer = await db.printer.create({
      data: {
        restaurantId,
        name: String(name).trim(),
        connectionType: connectionType || "NETWORK",
        ipAddress: ipAddress ? String(ipAddress).trim() : null,
        port: port ? Number(port) : 9100,
        paperWidth: paperWidth || "80mm",
        isBillingPrinter: Boolean(isBillingPrinter),
        isActive: true,
      },
    });

    return res.send({ ok: true, printer });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to create printer" });
  }
};

export const updatePrinter = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const printerId = Number(req.params.printerId || 0);

    const db = req.prisma || prisma;
    const printer = await db.printer.update({
      where: { id: printerId, restaurantId },
      data: {
        ...(req.body.name ? { name: String(req.body.name).trim() } : {}),
        ...(req.body.connectionType ? { connectionType: req.body.connectionType } : {}),
        ...(req.body.ipAddress !== undefined ? { ipAddress: req.body.ipAddress ? String(req.body.ipAddress).trim() : null } : {}),
        ...(req.body.port ? { port: Number(req.body.port) } : {}),
        ...(req.body.paperWidth ? { paperWidth: req.body.paperWidth } : {}),
        ...(req.body.isBillingPrinter !== undefined ? { isBillingPrinter: Boolean(req.body.isBillingPrinter) } : {}),
        ...(req.body.isActive !== undefined ? { isActive: Boolean(req.body.isActive) } : {}),
      },
    });

    return res.send({ ok: true, printer });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to update printer" });
  }
};

export const deletePrinter = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const printerId = Number(req.params.printerId || 0);

    const db = req.prisma || prisma;
    await db.printer.delete({
      where: { id: printerId, restaurantId },
    });

    return res.send({ ok: true, message: "Printer deleted" });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to delete printer" });
  }
};

export const testPrinter = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const printerId = Number(req.params.printerId || 0);

    const db = req.prisma || prisma;
    const printer = await db.printer.findFirst({
      where: { id: printerId, restaurantId },
    });

    if (!printer) return res.status(404).send({ message: "Printer not found" });

    const result = await testPrinterConnection({
      ipAddress: printer.ipAddress,
      port: printer.port || 9100,
      timeoutMs: 3000,
    });

    return res.send({ ok: true, printer, result });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Printer test failed" });
  }
};

/**
 * KITCHEN STATION MANAGEMENT
 */
export const getStations = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

    const db = req.prisma || prisma;
    let stations = await db.kitchenStation.findMany({
      where: { restaurantId },
      include: { printer: true, _count: { select: { menuItems: true } } },
      orderBy: { createdAt: "asc" },
    });

    // Auto-create default HOT KITCHEN station if restaurant has no stations yet
    if (stations.length === 0) {
      const defaultStation = await db.kitchenStation.create({
        data: {
          restaurantId,
          name: "HOT KITCHEN",
          code: "HOT",
          description: "Default Main Kitchen Station",
          isDefault: true,
          isActive: true,
        },
        include: { printer: true, _count: { select: { menuItems: true } } },
      });
      stations = [defaultStation];
    }

    return res.send({ ok: true, stations });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to fetch stations" });
  }
};

export const createStation = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

    const { name, code, description, printerId, isDefault } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).send({ message: "Station name is required" });
    }

    const db = req.prisma || prisma;
    const station = await db.kitchenStation.create({
      data: {
        restaurantId,
        name: String(name).trim().toUpperCase(),
        code: code ? String(code).trim().toUpperCase() : String(name).slice(0, 3).toUpperCase(),
        description: description ? String(description).trim() : null,
        printerId: printerId ? Number(printerId) : null,
        isDefault: Boolean(isDefault),
        isActive: true,
      },
      include: { printer: true },
    });

    return res.send({ ok: true, station });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to create station" });
  }
};

export const updateStation = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const stationId = Number(req.params.stationId || 0);

    const db = req.prisma || prisma;
    const station = await db.kitchenStation.update({
      where: { id: stationId, restaurantId },
      data: {
        ...(req.body.name ? { name: String(req.body.name).trim().toUpperCase() } : {}),
        ...(req.body.code !== undefined ? { code: req.body.code ? String(req.body.code).trim().toUpperCase() : null } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description ? String(req.body.description).trim() : null } : {}),
        ...(req.body.printerId !== undefined ? { printerId: req.body.printerId ? Number(req.body.printerId) : null } : {}),
        ...(req.body.isDefault !== undefined ? { isDefault: Boolean(req.body.isDefault) } : {}),
        ...(req.body.isActive !== undefined ? { isActive: Boolean(req.body.isActive) } : {}),
      },
      include: { printer: true },
    });

    return res.send({ ok: true, station });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to update station" });
  }
};
