import {
  getCurrentShift,
  openShift,
  recordCashMovement,
  closeShift,
  reopenShift,
  getShiftHistory,
} from "../services/shiftService.js";
import {
  calculateDayClosingSummary,
  closeDay,
  getDayClosingHistory,
} from "../services/dayClosingService.js";

export default async function shiftRoutes(app, deps = {}) {
  const prisma = deps.prisma;

  const extractActor = (req) => {
    const user = req.user || {};
    return {
      userId: user.id || user.userId || null,
      userName: user.name || user.email || "Staff",
      role: user.role || "STAFF",
      restaurantId: user.restaurantId || req.headers["x-restaurant-id"] || null,
    };
  };

  // GET /api/shifts/current & /shifts/current - Get active shift
  const handleGetCurrentShift = async (req, reply) => {
    try {
      const actor = extractActor(req);
      const restaurantId = req.query.restaurantId || actor.restaurantId;
      const terminalId = req.query.terminalId || "MAIN";

      if (!restaurantId) {
        return reply.status(400).send({ error: "restaurantId required" });
      }

      const shift = await getCurrentShift({
        prisma,
        restaurantId,
        userId: actor.userId,
        terminalId,
      });

      return reply.send({ success: true, shift });
    } catch (err) {
      console.error("[ShiftRoutes] GET /shifts/current error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch current shift" });
    }
  };
  app.get("/api/shifts/current", handleGetCurrentShift);
  app.get("/shifts/current", handleGetCurrentShift);

  // POST /api/shifts/open & /shifts/open - Open new cashier shift
  const handleOpenShift = async (req, reply) => {
    try {
      const actor = extractActor(req);
      const { restaurantId, openingCash, notes, terminalId } = req.body || {};
      const targetRestaurantId = restaurantId || actor.restaurantId;

      if (!targetRestaurantId) {
        return reply.status(400).send({ error: "restaurantId required" });
      }

      const shift = await openShift({
        prisma,
        restaurantId: targetRestaurantId,
        userId: actor.userId,
        openingCash: openingCash || 0,
        notes,
        terminalId: terminalId || "MAIN",
        actor,
      });

      // Broadcast socket event if io available
      if (app.io) {
        app.io.to(`restaurant_${targetRestaurantId}`).emit("shift:updated", {
          action: "OPENED",
          shift,
        });
      }

      return reply.send({ success: true, shift });
    } catch (err) {
      console.error("[ShiftRoutes] POST /shifts/open error:", err);
      const statusCode = err.code === "duplicate_open_shift" ? 409 : 400;
      return reply.status(statusCode).send({
        error: err.message || "Failed to open shift",
        code: err.code,
        existingShift: err.existingShift || null,
      });
    }
  };
  app.post("/api/shifts/open", handleOpenShift);
  app.post("/shifts/open", handleOpenShift);

  // POST /api/shifts/:id/cash-in & /shifts/:id/cash-in - Record Cash In
  const handleRecordCashIn = async (req, reply) => {
    try {
      const actor = extractActor(req);
      const shiftId = req.params.id;
      const { restaurantId, amount, reason } = req.body || {};
      const targetRestaurantId = restaurantId || actor.restaurantId;

      const result = await recordCashMovement({
        prisma,
        restaurantId: targetRestaurantId,
        shiftId,
        type: "CASH_IN",
        amount,
        reason,
        actor,
      });

      if (app.io) {
        app.io.to(`restaurant_${targetRestaurantId}`).emit("shift:updated", {
          action: "CASH_IN",
          shift: result.shift,
          movement: result.movement,
        });
      }

      return reply.send({ success: true, ...result });
    } catch (err) {
      console.error("[ShiftRoutes] POST /shifts/:id/cash-in error:", err);
      return reply.status(400).send({ error: err.message || "Failed to record Cash In" });
    }
  };
  app.post("/api/shifts/:id/cash-in", handleRecordCashIn);
  app.post("/shifts/:id/cash-in", handleRecordCashIn);

  // POST /api/shifts/:id/cash-out & /shifts/:id/cash-out - Record Cash Out
  const handleRecordCashOut = async (req, reply) => {
    try {
      const actor = extractActor(req);
      const shiftId = req.params.id;
      const { restaurantId, amount, reason } = req.body || {};
      const targetRestaurantId = restaurantId || actor.restaurantId;

      const result = await recordCashMovement({
        prisma,
        restaurantId: targetRestaurantId,
        shiftId,
        type: "CASH_OUT",
        amount,
        reason,
        actor,
      });

      if (app.io) {
        app.io.to(`restaurant_${targetRestaurantId}`).emit("shift:updated", {
          action: "CASH_OUT",
          shift: result.shift,
          movement: result.movement,
        });
      }

      return reply.send({ success: true, ...result });
    } catch (err) {
      console.error("[ShiftRoutes] POST /shifts/:id/cash-out error:", err);
      return reply.status(400).send({ error: err.message || "Failed to record Cash Out" });
    }
  };
  app.post("/api/shifts/:id/cash-out", handleRecordCashOut);
  app.post("/shifts/:id/cash-out", handleRecordCashOut);

  // POST /api/shifts/:id/close & /shifts/:id/close - Close shift
  const handleCloseShiftRoute = async (req, reply) => {
    try {
      const actor = extractActor(req);
      const shiftId = req.params.id;
      const { restaurantId, actualCash, varianceReason, notes } = req.body || {};
      const targetRestaurantId = restaurantId || actor.restaurantId;

      const result = await closeShift({
        prisma,
        restaurantId: targetRestaurantId,
        shiftId,
        actualCash,
        varianceReason,
        notes,
        actor,
      });

      if (app.io) {
        app.io.to(`restaurant_${targetRestaurantId}`).emit("shift:updated", {
          action: "CLOSED",
          shift: result.shift,
        });
      }

      return reply.send({ success: true, ...result });
    } catch (err) {
      console.error("[ShiftRoutes] POST /shifts/:id/close error:", err);
      return reply.status(400).send({ error: err.message || "Failed to close shift" });
    }
  };
  app.post("/api/shifts/:id/close", handleCloseShiftRoute);
  app.post("/shifts/:id/close", handleCloseShiftRoute);

  // POST /api/shifts/:id/reopen & /shifts/:id/reopen - Reopen closed shift (Manager/Owner)
  const handleReopenShiftRoute = async (req, reply) => {
    try {
      const actor = extractActor(req);
      const shiftId = req.params.id;
      const { restaurantId, reason } = req.body || {};
      const targetRestaurantId = restaurantId || actor.restaurantId;

      const shift = await reopenShift({
        prisma,
        restaurantId: targetRestaurantId,
        shiftId,
        reason,
        actor,
      });

      if (app.io) {
        app.io.to(`restaurant_${targetRestaurantId}`).emit("shift:updated", {
          action: "REOPENED",
          shift,
        });
      }

      return reply.send({ success: true, shift });
    } catch (err) {
      console.error("[ShiftRoutes] POST /shifts/:id/reopen error:", err);
      const status = err.code === "forbidden" ? 403 : 400;
      return reply.status(status).send({ error: err.message || "Failed to reopen shift" });
    }
  };
  app.post("/api/shifts/:id/reopen", handleReopenShiftRoute);
  app.post("/shifts/:id/reopen", handleReopenShiftRoute);

  // GET /api/shifts/history & /shifts/history - Get shift history
  const handleGetShiftHistory = async (req, reply) => {
    try {
      const actor = extractActor(req);
      const { restaurantId, startDate, endDate, cashierId, status, terminalId, page, limit } = req.query || {};
      const targetRestaurantId = restaurantId || actor.restaurantId;

      if (!targetRestaurantId) {
        return reply.status(400).send({ error: "restaurantId required" });
      }

      const history = await getShiftHistory({
        prisma,
        restaurantId: targetRestaurantId,
        startDate,
        endDate,
        cashierId,
        status,
        terminalId,
        page: page || 1,
        limit: limit || 20,
      });

      return reply.send({ success: true, ...history });
    } catch (err) {
      console.error("[ShiftRoutes] GET /shifts/history error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch shift history" });
    }
  };
  app.get("/api/shifts/history", handleGetShiftHistory);
  app.get("/shifts/history", handleGetShiftHistory);

  // GET /api/day-closing/current & /day-closing/current - Get current EOD summary
  const handleGetDayClosingCurrent = async (req, reply) => {
    try {
      const actor = extractActor(req);
      const { restaurantId, businessDate } = req.query || {};
      const targetRestaurantId = restaurantId || actor.restaurantId;

      if (!targetRestaurantId) {
        return reply.status(400).send({ error: "restaurantId required" });
      }

      const summary = await calculateDayClosingSummary({
        prisma,
        restaurantId: targetRestaurantId,
        businessDate,
      });

      return reply.send({ success: true, summary });
    } catch (err) {
      console.error("[ShiftRoutes] GET /day-closing/current error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch day closing summary" });
    }
  };
  app.get("/api/day-closing/current", handleGetDayClosingCurrent);
  app.get("/day-closing/current", handleGetDayClosingCurrent);

  // POST /api/day-closing/close & /day-closing/close - Execute Day Close
  const handleCloseDayRoute = async (req, reply) => {
    try {
      const actor = extractActor(req);
      const { restaurantId, businessDate, notes } = req.body || {};
      const targetRestaurantId = restaurantId || actor.restaurantId;

      if (!targetRestaurantId) {
        return reply.status(400).send({ error: "restaurantId required" });
      }

      const result = await closeDay({
        prisma,
        restaurantId: targetRestaurantId,
        businessDate,
        notes,
        actor,
      });

      if (app.io) {
        app.io.to(`restaurant_${targetRestaurantId}`).emit("day-close:updated", {
          action: "CLOSED",
          dayClosing: result.dayClosing,
        });
      }

      return reply.send({ success: true, ...result });
    } catch (err) {
      console.error("[ShiftRoutes] POST /day-closing/close error:", err);
      const statusCode = err.code === "unresolved_open_shifts" ? 409 : 400;
      return reply.status(statusCode).send({
        error: err.message || "Failed to close business day",
        code: err.code,
        openShifts: err.openShifts || [],
      });
    }
  };
  app.post("/api/day-closing/close", handleCloseDayRoute);
  app.post("/day-closing/close", handleCloseDayRoute);

  // GET /api/day-closing/history & /day-closing/history - Get Day Closing History
  const handleGetDayClosingHistory = async (req, reply) => {
    try {
      const actor = extractActor(req);
      const { restaurantId, page, limit } = req.query || {};
      const targetRestaurantId = restaurantId || actor.restaurantId;

      if (!targetRestaurantId) {
        return reply.status(400).send({ error: "restaurantId required" });
      }

      const history = await getDayClosingHistory({
        prisma,
        restaurantId: targetRestaurantId,
        page: page || 1,
        limit: limit || 20,
      });

      return reply.send({ success: true, ...history });
    } catch (err) {
      console.error("[ShiftRoutes] GET /day-closing/history error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch day closing history" });
    }
  };
  app.get("/api/day-closing/history", handleGetDayClosingHistory);
  app.get("/day-closing/history", handleGetDayClosingHistory);
}
