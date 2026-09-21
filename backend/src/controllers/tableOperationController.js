import { prisma } from "../config/prisma.js";
import {
  moveTableSession,
  mergeTableSessions,
  transferItemsBetweenTables,
} from "../services/tableOperationService.js";

/**
 * Extract Actor Info from Request
 */
const getActor = (req) => {
  return {
    userId: req.user?.id || req.user?.userId || null,
    userName: req.user?.name || req.user?.userName || "Staff",
    role: req.user?.role || "WAITER",
    restaurantId: req.user?.restaurantId || null,
  };
};

// 1. MOVE TABLE
export async function moveTable(req, reply) {
  try {
    const restaurantId = Number(req.params.restaurantId || req.body?.restaurantId || req.user?.restaurantId);
    const sourceTableId = Number(req.params.tableId || req.body?.sourceTableId);
    const targetTableId = Number(req.body?.targetTableId);

    if (!restaurantId || !sourceTableId || !targetTableId) {
      return reply.code(400).send({ message: "restaurantId, sourceTableId, and targetTableId are required" });
    }

    const actor = getActor(req);
    const session = await moveTableSession({
      prisma,
      restaurantId,
      sourceTableId,
      targetTableId,
      actor,
    });

    return reply.send({
      success: true,
      message: `Table moved successfully to Table ${session.tableNo}`,
      session,
    });
  } catch (err) {
    console.error("Error moving table:", err);
    if (err.code === "target_table_occupied") {
      return reply.code(409).send({
        message: err.message,
        code: err.code,
        targetSessionId: err.targetSessionId,
      });
    }
    return reply.code(400).send({
      message: err.message || "Failed to move table",
      code: err.code || "move_failed",
    });
  }
}

// 2. MERGE TABLES
export async function mergeTables(req, reply) {
  try {
    const restaurantId = Number(req.params.restaurantId || req.body?.restaurantId || req.user?.restaurantId);
    const primaryTableId = Number(req.params.tableId || req.body?.primaryTableId);
    const secondaryTableId = Number(req.body?.secondaryTableId || req.body?.targetTableId);

    if (!restaurantId || !primaryTableId || !secondaryTableId) {
      return reply.code(400).send({ message: "restaurantId, primaryTableId, and secondaryTableId are required" });
    }

    const actor = getActor(req);
    const primarySession = await mergeTableSessions({
      prisma,
      restaurantId,
      primaryTableId,
      secondaryTableId,
      actor,
    });

    return reply.send({
      success: true,
      message: `Tables merged successfully into Table ${primarySession.tableNo}`,
      session: primarySession,
    });
  } catch (err) {
    console.error("Error merging tables:", err);
    return reply.code(400).send({
      message: err.message || "Failed to merge tables",
      code: err.code || "merge_failed",
    });
  }
}

// 3. SPLIT TABLE / TRANSFER ITEMS
export async function splitTableOrTransferItems(req, reply) {
  try {
    const restaurantId = Number(req.params.restaurantId || req.body?.restaurantId || req.user?.restaurantId);
    const sourceTableId = Number(req.params.tableId || req.body?.sourceTableId);
    const targetTableId = Number(req.body?.targetTableId);
    const itemsToTransfer = req.body?.items || req.body?.itemsToTransfer || [];

    if (!restaurantId || !sourceTableId || !targetTableId || !Array.isArray(itemsToTransfer) || !itemsToTransfer.length) {
      return reply.code(400).send({ message: "restaurantId, sourceTableId, targetTableId, and items array are required" });
    }

    const actor = getActor(req);
    const result = await transferItemsBetweenTables({
      prisma,
      restaurantId,
      sourceTableId,
      targetTableId,
      itemsToTransfer,
      actor,
    });

    return reply.send({
      success: true,
      message: `Items transferred to Table ${result.targetSession.tableNo}`,
      sourceSession: result.sourceSession,
      targetSession: result.targetSession,
    });
  } catch (err) {
    console.error("Error transferring items:", err);
    return reply.code(400).send({
      message: err.message || "Failed to transfer items",
      code: err.code || "transfer_failed",
    });
  }
}
