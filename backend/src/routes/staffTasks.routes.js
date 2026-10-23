import { requireStaffJwt } from "../services/staffAuthService.js";
import { logAuditEvent } from "../services/auditLogService.js";
import { completeSessionAndReleaseTable } from "../services/tableSessionService.js";
import { syncParentOrderStatusFromKots } from "../services/kotService.js";

export default async function staffTaskRoutes(app, deps = {}) {
  const { prisma, realtime, STAFF_ALLOWED_ROLES } = deps || {};

  const requireStaff = async (req, reply) => {
    const actor = await requireStaffJwt(req, reply, { prisma, allowedRoles: STAFF_ALLOWED_ROLES });
    if (!actor) return reply;
    req.staffActor = actor;
    return null;
  };

  const getEffectiveRid = (req) => {
    return Number(
      req.query?.restaurantId ||
      req.body?.restaurantId ||
      req.staffActor?.restaurantId ||
      req.user?.restaurantId ||
      0
    );
  };

  /**
   * GET /api/v1/staff/tasks
   * Fetch active, assigned, or pending tasks for staff workspace
   */
  app.get("/api/v1/staff/tasks", { preHandler: requireStaff }, async (req, reply) => {
    try {
      const restaurantId = getEffectiveRid(req);
      if (!restaurantId) return reply.code(400).send({ message: "restaurantId required" });

      const { category, status, roleTarget, tableId, myTasksOnly } = req.query || {};
      const staffId = req.staffActor?.id || req.staffActor?.userId;

      const where = {
        restaurantId,
        ...(category ? { category: String(category).toUpperCase() } : {}),
        ...(roleTarget ? { roleTarget: { in: [String(roleTarget).toUpperCase(), "ALL"] } } : {}),
        ...(tableId ? { tableId: Number(tableId) } : {}),
      };

      if (status) {
        where.status = String(status).toUpperCase();
      }

      if (myTasksOnly === "true" && staffId) {
        where.assignedTo = Number(staffId);
      }

      const tasks = await prisma.staffTask.findMany({
        where,
        include: {
          assignedUser: { select: { id: true, name: true, role: true, designation: true } },
          requestedByUser: { select: { id: true, name: true, role: true, designation: true } },
          table: { select: { id: true, tableNo: true, section: true, cleaningStatus: true } },
        },
        orderBy: [
          { priority: "asc" },
          { createdAt: "desc" },
        ],
        take: 150,
      });

      return reply.send({ success: true, tasks });
    } catch (err) {
      req.log?.error?.(err, "Failed to get staff tasks");
      return reply.code(500).send({ message: err.message || "Failed to fetch staff tasks" });
    }
  });

  /**
   * POST /api/v1/staff/tasks/request
   * Create an assistance or service task (e.g. Call Steward, Call Cleaner, etc.)
   */
  app.post("/api/v1/staff/tasks/request", { preHandler: requireStaff }, async (req, reply) => {
    try {
      const restaurantId = getEffectiveRid(req);
      if (!restaurantId) return reply.code(400).send({ message: "restaurantId required" });

      const {
        title,
        description = "",
        category = "SERVICE",
        taskType = "SERVICE",
        roleTarget = "STEWARD",
        priority = "MEDIUM",
        tableId = null,
        tableNo = null,
      } = req.body || {};

      if (!title) return reply.code(400).send({ message: "Task title is required" });

      let resolvedTableId = tableId ? Number(tableId) : null;
      if (!resolvedTableId && tableNo) {
        const found = await prisma.diningTable.findFirst({
          where: { restaurantId, tableNo: String(tableNo) },
          select: { id: true },
        });
        if (found) resolvedTableId = found.id;
      }

      const staffId = req.staffActor?.id || req.staffActor?.userId;

      const task = await prisma.staffTask.create({
        data: {
          restaurantId,
          title: String(title).trim(),
          description: description ? String(description).trim() : null,
          category: String(category).toUpperCase(),
          taskType: String(taskType).toUpperCase(),
          roleTarget: String(roleTarget).toUpperCase(),
          priority: String(priority).toUpperCase(),
          tableId: resolvedTableId,
          requestedByUserId: staffId ? Number(staffId) : null,
          status: "PENDING",
        },
        include: {
          table: { select: { id: true, tableNo: true, section: true, cleaningStatus: true } },
          requestedByUser: { select: { id: true, name: true, role: true, designation: true } },
        },
      });

      // Realtime notification & event emission over /staff
      const io = realtime?.io || null;
      const staff = realtime?.staff || null;
      const payload = {
        task,
        restaurantId,
        tableNo: task.table?.tableNo || tableNo || null,
        requestedByName: task.requestedByUser?.name || req.staffActor?.name || "Staff",
        timestamp: new Date().toISOString(),
      };

      if (staff) {
        if (task.roleTarget === "STEWARD" || task.category === "SERVICE" || task.category === "RUNNER") {
          staff.to(`restaurant_${restaurantId}`).emit("steward:assistance_requested", payload);
          staff.to(`restaurant:${restaurantId}`).emit("steward:assistance_requested", payload);
          staff.to(`restaurant_${restaurantId}`).emit("steward:task_created", payload);
          staff.to(`restaurant:${restaurantId}`).emit("steward:task_created", payload);
        }
        if (task.roleTarget === "CLEANER" || task.category === "CLEANING") {
          staff.to(`restaurant_${restaurantId}`).emit("cleaner:task_created", payload);
          staff.to(`restaurant:${restaurantId}`).emit("cleaner:task_created", payload);
          if (task.priority === "URGENT" || task.priority === "HIGH") {
            staff.to(`restaurant_${restaurantId}`).emit("cleaner:urgent_alert", payload);
            staff.to(`restaurant:${restaurantId}`).emit("cleaner:urgent_alert", payload);
          }
        }
        staff.to(`restaurant_${restaurantId}`).emit("task:assigned", payload);
        staff.to(`restaurant:${restaurantId}`).emit("task:assigned", payload);
      }

      return reply.code(201).send({ success: true, message: "Task request created successfully", task });
    } catch (err) {
      req.log?.error?.(err, "Failed to create task request");
      return reply.code(500).send({ message: err.message || "Failed to create task request" });
    }
  });

  /**
   * PUT /api/v1/staff/tasks/:taskId/accept
   * Staff member claims / accepts a task
   */
  app.put("/api/v1/staff/tasks/:taskId/accept", { preHandler: requireStaff }, async (req, reply) => {
    try {
      const taskId = Number(req.params.taskId);
      if (!taskId) return reply.code(400).send({ message: "Invalid taskId" });

      const restaurantId = getEffectiveRid(req);
      const staffId = req.staffActor?.id || req.staffActor?.userId;
      const existing = await prisma.staffTask.findUnique({ where: { id: taskId } });
      if (!existing) return reply.code(404).send({ message: "Task not found" });

      if (restaurantId && existing.restaurantId !== restaurantId) {
        return reply.code(403).send({ message: "Forbidden: Task belongs to another restaurant" });
      }

      if (existing.status === "COMPLETED" || existing.isCompleted) {
        return reply.code(409).send({ message: "Task is already completed" });
      }

      if (existing.status !== "PENDING" && existing.assignedTo && existing.assignedTo !== Number(staffId)) {
        return reply.code(409).send({ message: "Task is already claimed by another staff member" });
      }

      const updated = await prisma.staffTask.update({
        where: { id: taskId },
        data: {
          status: "ACCEPTED",
          assignedTo: staffId ? Number(staffId) : existing.assignedTo,
        },
        include: {
          assignedUser: { select: { id: true, name: true, role: true, designation: true } },
          table: { select: { id: true, tableNo: true, section: true } },
        },
      });

      const staff = realtime?.staff || null;
      if (staff) {
        staff.to(`restaurant_${existing.restaurantId}`).emit("task:updated", { task: updated });
        staff.to(`restaurant:${existing.restaurantId}`).emit("task:updated", { task: updated });
      }

      return reply.send({ success: true, message: "Task accepted", task: updated });
    } catch (err) {
      return reply.code(500).send({ message: err.message || "Failed to accept task" });
    }
  });

  /**
   * PUT /api/v1/staff/tasks/:taskId/start
   * Staff member starts working on task (IN_PROGRESS)
   */
  app.put("/api/v1/staff/tasks/:taskId/start", { preHandler: requireStaff }, async (req, reply) => {
    try {
      const taskId = Number(req.params.taskId);
      if (!taskId) return reply.code(400).send({ message: "Invalid taskId" });

      const restaurantId = getEffectiveRid(req);
      const existing = await prisma.staffTask.findUnique({ where: { id: taskId } });
      if (!existing) return reply.code(404).send({ message: "Task not found" });

      if (restaurantId && existing.restaurantId !== restaurantId) {
        return reply.code(403).send({ message: "Forbidden: Task belongs to another restaurant" });
      }

      if (existing.status === "COMPLETED" || existing.isCompleted) {
        return reply.code(409).send({ message: "Task is already completed" });
      }

      const updated = await prisma.staffTask.update({
        where: { id: taskId },
        data: {
          status: "IN_PROGRESS",
        },
        include: {
          assignedUser: { select: { id: true, name: true, role: true, designation: true } },
          table: { select: { id: true, tableNo: true, section: true } },
        },
      });

      const staff = realtime?.staff || null;
      if (staff) {
        staff.to(`restaurant_${existing.restaurantId}`).emit("task:updated", { task: updated });
        staff.to(`restaurant:${existing.restaurantId}`).emit("task:updated", { task: updated });
      }

      return reply.send({ success: true, message: "Task started", task: updated });
    } catch (err) {
      return reply.code(500).send({ message: err.message || "Failed to start task" });
    }
  });

  /**
   * PUT /api/v1/staff/tasks/:taskId/finish
   * Complete task. If it's a table cleaning task, mark table CLEAN and emit AVAILABLE!
   */
  app.put("/api/v1/staff/tasks/:taskId/finish", { preHandler: requireStaff }, async (req, reply) => {
    try {
      const taskId = Number(req.params.taskId);
      if (!taskId) return reply.code(400).send({ message: "Invalid taskId" });

      const restaurantId = getEffectiveRid(req);
      const staffId = req.staffActor?.id || req.staffActor?.userId;
      const existing = await prisma.staffTask.findUnique({
        where: { id: taskId },
        include: { table: true },
      });
      if (!existing) return reply.code(404).send({ message: "Task not found" });

      if (restaurantId && existing.restaurantId !== restaurantId) {
        return reply.code(403).send({ message: "Forbidden: Task belongs to another restaurant" });
      }

      if (existing.status === "COMPLETED" || existing.isCompleted) {
        return reply.code(409).send({ message: "Task is already completed" });
      }

      const updated = await prisma.staffTask.update({
        where: { id: taskId },
        data: {
          status: "COMPLETED",
          isCompleted: true,
          completedAt: new Date(),
          completedBy: staffId ? Number(staffId) : null,
        },
        include: {
          assignedUser: { select: { id: true, name: true, role: true, designation: true } },
          table: { select: { id: true, tableNo: true, section: true, cleaningStatus: true } },
        },
      });

      const effectiveRid = existing.restaurantId;
      const io = realtime?.io || null;
      const staff = realtime?.staff || null;

      // Handle table sanitation completion
      if (existing.tableId) {
        // Check if there are other pending cleaning tasks for this table
        const remainingCleaning = await prisma.staffTask.count({
          where: {
            restaurantId: effectiveRid,
            tableId: existing.tableId,
            category: "CLEANING",
            isCompleted: false,
            id: { not: taskId },
          },
        });

        if (remainingCleaning === 0) {
          // Mark Table CLEAN
          await prisma.diningTable.update({
            where: { id: existing.tableId },
            data: {
              cleaningStatus: "CLEAN",
              assignedWaiterId: null,
              assignedWaiterName: null,
            },
          });

          const nowTimestamp = Date.now();
          const nowIso = new Date(nowTimestamp).toISOString();
          const tableClearPayload = {
            type: "TABLE_UPDATED",
            restaurantId: effectiveRid,
            tableId: existing.tableId,
            id: existing.tableId,
            tableNo: existing.table?.tableNo,
            status: "AVAILABLE",
            cleaningStatus: "CLEAN",
            isOccupied: false,
            activeOrderCount: 0,
            activeOrders: [],
            activeOrderStatus: null,
            paymentStatus: null,
            occupiedSince: null,
            assignedServer: null,
            assignedServerId: null,
            assignedServerName: null,
            assignedWaiterId: null,
            assignedWaiterName: null,
            session: { status: "CLOSED" },
            activeSession: null,
            version: nowTimestamp,
            updatedAt: nowIso,
          };

          if (io) {
            io.to(`restaurant_${effectiveRid}`).emit("table:updated", tableClearPayload);
            io.to(`restaurant:${effectiveRid}`).emit("table:updated", tableClearPayload);
            io.to(`restaurant_${effectiveRid}`).emit("table:layout_updated", { restaurantId: effectiveRid });
            io.to(`restaurant:${effectiveRid}`).emit("table:layout_updated", { restaurantId: effectiveRid });
          }
          if (staff) {
            staff.to(`restaurant_${effectiveRid}`).emit("table:updated", tableClearPayload);
            staff.to(`restaurant:${effectiveRid}`).emit("table:updated", tableClearPayload);
            staff.to(`restaurant_${effectiveRid}`).emit("cleaner:table_cleaned", {
              tableId: existing.tableId,
              tableNo: existing.table?.tableNo,
              cleanedBy: req.staffActor?.name || "Cleaner",
              timestamp: nowIso,
            });
            staff.to(`restaurant:${effectiveRid}`).emit("cleaner:table_cleaned", {
              tableId: existing.tableId,
              tableNo: existing.table?.tableNo,
              cleanedBy: req.staffActor?.name || "Cleaner",
              timestamp: nowIso,
            });
          }
        }
      }

      if (staff) {
        staff.to(`restaurant_${effectiveRid}`).emit("task:completed", { task: updated });
        staff.to(`restaurant:${effectiveRid}`).emit("task:completed", { task: updated });
        if (existing.roleTarget === "STEWARD") {
          staff.to(`restaurant_${effectiveRid}`).emit("steward:task_completed", { task: updated });
          staff.to(`restaurant:${effectiveRid}`).emit("steward:task_completed", { task: updated });
        }
      }

      return reply.send({ success: true, message: "Task completed successfully", task: updated });
    } catch (err) {
      req.log?.error?.(err, "Failed to complete task");
      return reply.code(500).send({ message: err.message || "Failed to complete task" });
    }
  });

  /**
   * GET /api/v1/staff/food-runner-items
   * Fetch ready-to-run kitchen items for Stewards
   */
  app.get("/api/v1/staff/food-runner-items", { preHandler: requireStaff }, async (req, reply) => {
    try {
      const restaurantId = getEffectiveRid(req);
      if (!restaurantId) return reply.code(400).send({ message: "restaurantId required" });

      const readyItems = await prisma.kitchenOrderTicketItem.findMany({
        where: {
          kot: {
            restaurantId,
            status: { notIn: ["SERVED", "CANCELLED"] },
          },
          status: "READY",
        },
        include: {
          kot: {
            select: {
              id: true,
              kotNo: true,
              orderId: true,
              tableNo: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const formatted = readyItems.map((it) => ({
        ...it,
        qty: it.qty,
        quantity: it.qty,
        itemName: it.itemName,
        name: it.itemName,
      }));

      return reply.send({ success: true, items: formatted });
    } catch (err) {
      return reply.code(500).send({ message: err.message || "Failed to fetch food runner items" });
    }
  });

  /**
   * PUT /api/v1/staff/food-runner-items/:itemId/delivered
   * Mark ready food item delivered by Steward
   */
  app.put("/api/v1/staff/food-runner-items/:itemId/delivered", { preHandler: requireStaff }, async (req, reply) => {
    try {
      const itemId = Number(req.params.itemId);
      if (!itemId) return reply.code(400).send({ message: "Invalid itemId" });

      const restaurantId = getEffectiveRid(req);
      const existing = await prisma.kitchenOrderTicketItem.findFirst({
        where: {
          id: itemId,
          ...(restaurantId ? { kot: { restaurantId } } : {}),
        },
        include: { kot: true },
      });

      if (!existing) {
        return reply.code(404).send({ message: "Item not found in this restaurant" });
      }

      if (existing.status !== "READY") {
        return reply.code(400).send({
          success: false,
          code: "item_not_ready",
          message: `Cannot deliver item with status '${existing.status}'. Item must be READY.`,
        });
      }

      const updatedItem = await prisma.kitchenOrderTicketItem.update({
        where: { id: itemId },
        data: { status: "SERVED" },
        include: { kot: true },
      });

      // Synchronize KOT status if all items are now SERVED
      const kId = updatedItem.kotId;
      const reloadedKot = await prisma.kitchenOrderTicket.findUnique({
        where: { id: kId },
        include: { items: true, station: { include: { printer: true } } },
      });

      const activeItems = (reloadedKot?.items || []).filter((it) => it.status !== "CANCELLED");
      let autoKotStatus = reloadedKot?.status;
      if (activeItems.length > 0 && activeItems.every((it) => it.status === "SERVED")) {
        autoKotStatus = "SERVED";
      } else if (activeItems.length > 0 && activeItems.every((it) => it.status === "READY" || it.status === "SERVED")) {
        autoKotStatus = "READY";
      }

      let finalKot = reloadedKot;
      if (autoKotStatus && autoKotStatus !== reloadedKot.status) {
        finalKot = await prisma.kitchenOrderTicket.update({
          where: { id: kId },
          data: { status: autoKotStatus },
          include: { items: true, station: { include: { printer: true } } },
        });
      }

      // Synchronize parent Order status from KOTs
      let updatedOrder = null;
      if (updatedItem.kot?.orderId) {
        updatedOrder = await syncParentOrderStatusFromKots({
          prisma,
          orderId: updatedItem.kot.orderId,
        });
      }

      const staff = realtime?.staff || null;
      const io = realtime?.io || null;
      const rid = updatedItem.kot?.restaurantId || restaurantId;

      if (rid) {
        const payload = {
          itemId,
          tableNo: updatedItem.kot?.tableNo,
          deliveredBy: req.staffActor?.name || req.staffActor?.userName || "Steward",
          item: updatedItem,
          kot: finalKot,
        };

        if (staff) {
          staff.to(`restaurant_${rid}`).emit("food:delivered", payload);
          staff.to(`restaurant:${rid}`).emit("food:delivered", payload);
          staff.to(`restaurant_${rid}`).emit("kot:item_updated", { kotId: kId, itemId, status: "SERVED", kot: finalKot, item: updatedItem });
          staff.to(`restaurant:${rid}`).emit("kot:item_updated", { kotId: kId, itemId, status: "SERVED", kot: finalKot, item: updatedItem });
          staff.to(`restaurant_${rid}`).emit("kitchen:item_status_updated", { kotId: kId, itemId, status: "SERVED", kot: finalKot, item: updatedItem });
          staff.to(`restaurant:${rid}`).emit("kitchen:item_status_updated", { kotId: kId, itemId, status: "SERVED", kot: finalKot, item: updatedItem });
          staff.to(`restaurant_${rid}`).emit("kot:status_updated", finalKot);
          staff.to(`restaurant:${rid}`).emit("kot:status_updated", finalKot);
          if (updatedOrder) {
            staff.to(`restaurant_${rid}`).emit("order:updated", updatedOrder);
            staff.to(`restaurant:${rid}`).emit("order:updated", updatedOrder);
          }
          if (updatedItem.kot?.tableNo) {
            staff.to(`restaurant_${rid}`).emit("table:updated", { restaurantId: rid, tableNo: updatedItem.kot.tableNo });
            staff.to(`restaurant:${rid}`).emit("table:updated", { restaurantId: rid, tableNo: updatedItem.kot.tableNo });
          }
        }

        if (io) {
          io.to(`restaurant_${rid}`).emit("food:delivered", payload);
          io.to(`restaurant:${rid}`).emit("food:delivered", payload);
          io.to(`restaurant_${rid}`).emit("kot:item_updated", { kotId: kId, itemId, status: "SERVED", kot: finalKot, item: updatedItem });
          io.to(`restaurant:${rid}`).emit("kot:item_updated", { kotId: kId, itemId, status: "SERVED", kot: finalKot, item: updatedItem });
          io.to(`restaurant_${rid}`).emit("kitchen:item_status_updated", { kotId: kId, itemId, status: "SERVED", kot: finalKot, item: updatedItem });
          io.to(`restaurant:${rid}`).emit("kitchen:item_status_updated", { kotId: kId, itemId, status: "SERVED", kot: finalKot, item: updatedItem });
          io.to(`restaurant_${rid}`).emit("kot:status_updated", finalKot);
          io.to(`restaurant:${rid}`).emit("kot:status_updated", finalKot);
          if (updatedOrder) {
            io.to(`restaurant_${rid}`).emit("order:updated", updatedOrder);
            io.to(`restaurant:${rid}`).emit("order:updated", updatedOrder);
          }
          if (updatedItem.kot?.tableNo) {
            io.to(`restaurant_${rid}`).emit("table:updated", { restaurantId: rid, tableNo: updatedItem.kot.tableNo });
            io.to(`restaurant:${rid}`).emit("table:updated", { restaurantId: rid, tableNo: updatedItem.kot.tableNo });
          }
        }
      }

      return reply.send({ success: true, message: "Item delivered to table", item: updatedItem, kot: finalKot });
    } catch (err) {
      return reply.code(500).send({ message: err.message || "Failed to mark item delivered" });
    }
  });

  /**
   * POST /api/v1/staff/cashier/discount-request
   * Cashier requests discount -> creates approval alert for Manager
   */
  app.post("/api/v1/staff/cashier/discount-request", { preHandler: requireStaff }, async (req, reply) => {
    try {
      const restaurantId = getEffectiveRid(req);
      const { orderId, tableSessionId, discountAmount, discountReason, tableNo } = req.body || {};

      if (!restaurantId || (!orderId && !tableSessionId)) {
        return reply.code(400).send({ message: "restaurantId and orderId or tableSessionId are required" });
      }

      const disc = Math.max(0, Number(discountAmount || 0));
      if (disc <= 0) {
        return reply.code(400).send({ message: "Discount amount must be greater than zero" });
      }

      const cashierName = req.staffActor?.name || "Cashier";
      const cashierId = req.staffActor?.id || req.staffActor?.userId;

      // Broadcast approval request over /staff socket to managers
      const staff = realtime?.staff || null;
      const approvalPayload = {
        requestId: `DISC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        restaurantId,
        orderId: orderId ? Number(orderId) : null,
        tableSessionId: tableSessionId ? Number(tableSessionId) : null,
        tableNo: tableNo || null,
        discountAmount: disc,
        discountReason: discountReason || "Cashier requested manual discount",
        cashierId,
        cashierName,
        createdAt: new Date().toISOString(),
      };

      if (staff) {
        staff.to(`restaurant_${restaurantId}`).emit("manager:approval_requested", approvalPayload);
        staff.to(`restaurant:${restaurantId}`).emit("manager:approval_requested", approvalPayload);
      }

      return reply.send({
        success: true,
        message: "Discount approval request dispatched to Manager. Waiting for approval.",
        request: approvalPayload,
      });
    } catch (err) {
      return reply.code(500).send({ message: err.message || "Failed to request discount" });
    }
  });

  /**
   * PUT /api/v1/staff/tasks/:taskId/report-issue
   * Steward or Cleaner reports maintenance, damage, spill, or customer issue on a task/table
   */
  app.put("/api/v1/staff/tasks/:taskId/report-issue", { preHandler: requireStaff }, async (req, reply) => {
    try {
      const taskId = Number(req.params.taskId);
      if (!taskId) return reply.code(400).send({ message: "Invalid taskId" });

      const restaurantId = getEffectiveRid(req);
      const staffId = req.staffActor?.id || req.staffActor?.userId;
      const staffName = req.staffActor?.name || req.staffActor?.userName || "Staff";
      const { issueDescription, priority = "HIGH" } = req.body || {};

      if (!issueDescription) {
        return reply.code(400).send({ message: "Issue description is required" });
      }

      const existing = await prisma.staffTask.findUnique({
        where: { id: taskId },
        include: { table: true },
      });
      if (!existing) return reply.code(404).send({ message: "Task not found" });

      if (restaurantId && existing.restaurantId !== restaurantId) {
        return reply.code(403).send({ message: "Forbidden: Task belongs to another restaurant" });
      }

      const updated = await prisma.staffTask.update({
        where: { id: taskId },
        data: {
          priority: String(priority).toUpperCase(),
          description: existing.description
            ? `${existing.description}\n[ISSUE REPORTED by ${staffName}]: ${issueDescription}`
            : `[ISSUE REPORTED by ${staffName}]: ${issueDescription}`,
        },
        include: {
          assignedUser: { select: { id: true, name: true, role: true, designation: true } },
          table: { select: { id: true, tableNo: true, section: true, cleaningStatus: true } },
        },
      });

      const effectiveRid = existing.restaurantId;
      const staff = realtime?.staff || null;
      if (staff) {
        const payload = {
          taskId,
          restaurantId: effectiveRid,
          tableId: existing.tableId,
          tableNo: existing.table?.tableNo,
          issueDescription,
          reportedBy: staffName,
          timestamp: new Date().toISOString(),
        };
        staff.to(`restaurant_${effectiveRid}`).emit("task:issue_reported", payload);
        staff.to(`restaurant:${effectiveRid}`).emit("task:issue_reported", payload);
        staff.to(`restaurant_${effectiveRid}`).emit("task:updated", { task: updated });
        staff.to(`restaurant:${effectiveRid}`).emit("task:updated", { task: updated });
      }

      await logAuditEvent({
        prisma,
        restaurantId: effectiveRid,
        actor: { id: staffId, name: staffName, role: req.staffActor?.role },
        action: "STAFF_TASK_ISSUE_REPORTED",
        entity: "STAFF_TASK",
        entityId: taskId,
        details: { issueDescription, tableId: existing.tableId },
        req,
      });

      return reply.send({ success: true, message: "Issue reported successfully", task: updated });
    } catch (err) {
      return reply.code(500).send({ message: err.message || "Failed to report issue" });
    }
  });

  /**
   * POST /api/v1/staff/billing/settle
   * Dedicated authoritative settlement endpoint for Cashier & Swiper.
   * Calculates bill amount strictly on backend.
   * Records payment, updates CashierShift / cash movements if cash,
   * updates orders to PAID, and releases table into strict DIRTY sanitation.
   */
  app.post("/api/v1/staff/billing/settle", { preHandler: requireStaff }, async (req, reply) => {
    try {
      const restaurantId = getEffectiveRid(req);
      if (!restaurantId) return reply.code(400).send({ message: "restaurantId required" });

      const actorRole = String(req.staffActor?.role || "").toUpperCase();
      const billingAllowedRoles = ["CASHIER", "SWIPER", "SERVER", "WAITER", "MANAGER", "OWNER", "STAFF"];
      if (!billingAllowedRoles.includes(actorRole)) {
        return reply.code(403).send({ message: "Your designation is not authorized to settle payments" });
      }

      const {
        orderId,
        tableId,
        tableNo,
        tableSessionId,
        paymentMethod = "CASH",
        shiftId,
        splitBreakdown,
      } = req.body || {};

      if (!orderId && !tableId && !tableSessionId && !tableNo) {
        return reply.code(400).send({ message: "Order ID, tableSessionId, or table identifier is required" });
      }

      // Swiper authorization: Cannot change prices or apply discounts
      if (actorRole === "SWIPER" && (req.body?.discountAmount || req.body?.customAmount)) {
        return reply.code(403).send({ message: "Swiper runner cannot alter bill amounts or apply discounts" });
      }

      // 1. Transaction to atomically fetch, validate authoritative bill amount, create payment, and update shift
      const result = await prisma.$transaction(async (tx) => {
        let targetOrder = null;
        let targetSession = null;

        if (orderId) {
          targetOrder = await tx.order.findUnique({
            where: { id: Number(orderId) },
            include: { items: true, tableSession: true },
          });
          if (!targetOrder || Number(targetOrder.restaurantId) !== Number(restaurantId)) {
            const err = new Error("Order not found or restaurant mismatch");
            err.code = "order_not_found";
            throw err;
          }
          if (targetOrder.paymentStatus === "PAID" || targetOrder.paymentStatus === "SUCCESS") {
            const err = new Error("Order has already been paid and settled");
            err.code = "already_paid";
            throw err;
          }
          if (targetOrder.tableSession) {
            targetSession = targetOrder.tableSession;
          }
        }

        if (!targetSession && tableSessionId) {
          targetSession = await tx.tableSession.findUnique({
            where: { id: Number(tableSessionId) },
            include: {
              orders: {
                where: { status: { not: "CANCELLED" } },
                include: { items: true },
              },
            },
          });
        }

        if (!targetSession && tableId) {
          targetSession = await tx.tableSession.findFirst({
            where: {
              tableId: Number(tableId),
              restaurantId: Number(restaurantId),
              status: { in: ["OPEN", "BILLING", "PAID"] },
            },
            include: {
              orders: {
                where: { status: { not: "CANCELLED" } },
                include: { items: true },
              },
            },
            orderBy: { openedAt: "desc" },
          });
        }

        if (!targetOrder && targetSession?.orders?.length > 0) {
          targetOrder = targetSession.orders.find(
            (o) => o.paymentStatus !== "PAID" && o.paymentStatus !== "SUCCESS"
          ) || targetSession.orders[0];
        }

        // 2. Authoritative Bill Amount Calculation
        let authoritativeTotal = 0;
        if (targetSession && Number(targetSession.total) > 0) {
          authoritativeTotal = Number(targetSession.total);
        } else if (targetOrder && Number(targetOrder.total) > 0) {
          authoritativeTotal = Number(targetOrder.total);
        } else {
          const itemsToSum = targetOrder?.items || [];
          if (itemsToSum.length > 0) {
            authoritativeTotal = itemsToSum.reduce(
              (sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 1)),
              0
            );
          }
        }

        if (authoritativeTotal <= 0) {
          const err = new Error("AUTHORITATIVE BILL AMOUNT CANNOT BE ₹0 for active orders");
          err.code = "invalid_authoritative_total";
          throw err;
        }

        // 3. Amount mismatch check if client passed explicit amount
        const clientAmount = Number(req.body?.amount ?? authoritativeTotal);
        if (Math.abs(clientAmount - authoritativeTotal) > 0.05 && !splitBreakdown) {
          const err = new Error(`Payment amount mismatch: Authoritative total is ₹${authoritativeTotal}, received ₹${clientAmount}`);
          err.code = "amount_mismatch";
          err.authoritativeTotal = authoritativeTotal;
          throw err;
        }

        // 4. Resolve Active Cashier Shift
        const normMethod = String(paymentMethod || "CASH").toUpperCase();
        let effectiveShiftId = shiftId ? Number(shiftId) : null;
        if (!effectiveShiftId) {
          const activeShift = await tx.cashierShift.findFirst({
            where: { restaurantId: Number(restaurantId), status: "OPEN" },
            orderBy: { openedAt: "desc" },
          });
          if (activeShift) effectiveShiftId = activeShift.id;
        }

        const staffId = req.staffActor?.id || req.staffActor?.userId;
        const staffName = req.staffActor?.name || req.staffActor?.userName || "Staff";

        // 5. Create authoritative Payment record
        const payment = await tx.payment.create({
          data: {
            restaurantId: Number(restaurantId),
            orderId: targetOrder?.id || null,
            tableSessionId: targetSession?.id || targetOrder?.tableSessionId || null,
            amountSubunit: Math.round(authoritativeTotal * 100),
            currency: "INR",
            method: normMethod,
            status: "SUCCESS",
            provider: normMethod.includes("ONLINE") ? "CASHFREE" : "OFFLINE",
            performedByName: staffName,
            shiftId: effectiveShiftId,
          },
        });

        // 6. Record Cash Sale / Movement if cash
        if (normMethod.includes("CASH") && effectiveShiftId) {
          await tx.cashMovement.create({
            data: {
              shiftId: effectiveShiftId,
              restaurantId: Number(restaurantId),
              type: "CASH_SALE",
              amount: authoritativeTotal,
              reason: `Bill Settlement #${payment.id} for Table ${targetOrder?.tableNo || targetSession?.tableNo || ""}`,
              paymentId: payment.id,
              performedByUserId: staffId ? Number(staffId) : null,
              performedByName: staffName,
            },
          });

          const movements = await tx.cashMovement.findMany({
            where: { shiftId: effectiveShiftId },
            select: { type: true, amount: true },
          });
          let exp = 0;
          for (const m of movements) {
            if (["OPENING_CASH", "CASH_SALE", "CASH_IN"].includes(m.type)) exp += Number(m.amount || 0);
            else if (["CASH_REFUND", "CASH_OUT"].includes(m.type)) exp -= Number(m.amount || 0);
          }
          await tx.cashierShift.update({
            where: { id: effectiveShiftId },
            data: { expectedCash: Math.max(0, exp) },
          });
        }

        // 7. Mark Order(s) PAID
        if (targetOrder) {
          await tx.order.update({
            where: { id: targetOrder.id },
            data: {
              paymentStatus: "SUCCESS",
              paymentMode: normMethod,
              total: authoritativeTotal,
            },
          });
        }

        if (targetSession?.id) {
          await tx.order.updateMany({
            where: {
              tableSessionId: targetSession.id,
              status: { not: "CANCELLED" },
            },
            data: {
              paymentStatus: "SUCCESS",
              paymentMode: normMethod,
            },
          });
        }

        return {
          payment,
          authoritativeTotal,
          targetOrder,
          targetSession,
          effectiveShiftId,
        };
      });

      // 8. Complete session and release table into strict DIRTY sanitation
      const { targetOrder, targetSession, authoritativeTotal, payment, effectiveShiftId } = result;
      const effectiveSessionId = targetSession?.id || targetOrder?.tableSessionId;

      const completionResult = await completeSessionAndReleaseTable({
        prisma,
        tableSessionId: effectiveSessionId,
        orderId: targetOrder?.id,
        tableNo: targetOrder?.tableNo || targetSession?.tableNo,
        restaurantId,
        paymentMode: req.body?.paymentMethod || "CASH",
        realtime,
        actor: req.staffActor,
      });

      // 9. Emit realtime events
      const io = realtime?.io || null;
      const staff = realtime?.staff || null;
      const finalTableNo = targetOrder?.tableNo || targetSession?.tableNo || tableNo || null;

      const paymentEventPayload = {
        restaurantId,
        tableNo: finalTableNo,
        orderId: targetOrder?.id,
        tableSessionId: effectiveSessionId,
        paymentId: payment.id,
        status: "SUCCESS",
        amount: authoritativeTotal,
        paymentMode: req.body?.paymentMethod || "CASH",
        settledBy: req.staffActor?.name || "Staff",
        timestamp: new Date().toISOString(),
      };

      if (io) {
        io.to(`restaurant_${restaurantId}`).emit("payment:updated", paymentEventPayload);
        io.to(`restaurant:${restaurantId}`).emit("payment:updated", paymentEventPayload);
      }
      if (staff) {
        staff.to(`restaurant_${restaurantId}`).emit("payment:updated", paymentEventPayload);
        staff.to(`restaurant:${restaurantId}`).emit("payment:updated", paymentEventPayload);
        if (effectiveShiftId) {
          staff.to(`restaurant_${restaurantId}`).emit("shift:updated", { shiftId: effectiveShiftId });
          staff.to(`restaurant:${restaurantId}`).emit("shift:updated", { shiftId: effectiveShiftId });
        }
      }

      return reply.send({
        success: true,
        verified: true,
        message: `Bill of ₹${authoritativeTotal} successfully settled via ${req.body?.paymentMethod || "CASH"}. Table is queued for sanitation.`,
        payment,
        authoritativeTotal,
        tableNo,
        orderId: targetOrder?.id,
        completionResult,
      });
    } catch (err) {
      req.log?.error?.(err, "Failed to settle bill");
      const code = err?.code || "";
      const status = code === "amount_mismatch" || code === "invalid_authoritative_total" || code === "already_paid" ? 400 : (code === "order_not_found" ? 404 : 500);
      return reply.code(status).send({
        success: false,
        message: err.message || "Failed to settle payment",
        code: err.code || "settlement_failed",
        authoritativeTotal: err.authoritativeTotal,
      });
    }
  });
}
