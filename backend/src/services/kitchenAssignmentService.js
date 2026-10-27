import defaultPrisma from "../prisma.js";
import { logAuditEvent } from "./auditLogService.js";
import { emitToKitchen } from "../realtime/socketServer.js";

/**
 * Custom Error Class with HTTP status code support
 */
export class KitchenAssignmentError extends Error {
  constructor(message, status = 400, code = "KITCHEN_ASSIGNMENT_ERROR") {
    super(message);
    this.name = "KitchenAssignmentError";
    this.status = status;
    this.code = code;
  }
}

/**
 * 1. Fetch kitchen configuration for a restaurant
 */
export const getKitchenConfig = async ({ prisma = defaultPrisma, restaurantId } = {}) => {
  const rid = Number(restaurantId);
  if (!rid) throw new KitchenAssignmentError("Invalid restaurant ID", 400, "INVALID_RESTAURANT");

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: rid },
    select: {
      id: true,
      kitchenAssignmentMode: true,
      kitchenSelfPickScope: true,
    },
  });

  if (!restaurant) throw new KitchenAssignmentError("Restaurant not found", 404, "RESTAURANT_NOT_FOUND");

  return {
    ok: true,
    mode: restaurant.kitchenAssignmentMode || "DISPATCHER",
    scope: restaurant.kitchenSelfPickScope || "ITEMS",
  };
};

/**
 * 2. Update kitchen configuration (mode & scope)
 */
export const updateKitchenConfig = async ({
  prisma = defaultPrisma,
  restaurantId,
  mode,
  scope,
  actor = null,
  req = null,
  realtime = null,
} = {}) => {
  const rid = Number(restaurantId);
  if (!rid) throw new KitchenAssignmentError("Invalid restaurant ID", 400, "INVALID_RESTAURANT");

  const validModes = ["DISPATCHER", "SELF_PICK"];
  const validScopes = ["ITEMS", "KOTS", "BOTH"];

  const normalizedMode = String(mode || "").trim().toUpperCase();
  const normalizedScope = String(scope || "").trim().toUpperCase();

  if (normalizedMode && !validModes.includes(normalizedMode)) {
    throw new KitchenAssignmentError(`Invalid kitchen mode: ${mode}. Allowed: ${validModes.join(", ")}`, 400, "INVALID_MODE");
  }

  if (normalizedScope && !validScopes.includes(normalizedScope)) {
    throw new KitchenAssignmentError(`Invalid self-pick scope: ${scope}. Allowed: ${validScopes.join(", ")}`, 400, "INVALID_SCOPE");
  }

  const existing = await prisma.restaurant.findUnique({
    where: { id: rid },
    select: { id: true, kitchenAssignmentMode: true, kitchenSelfPickScope: true },
  });
  if (!existing) throw new KitchenAssignmentError("Restaurant not found", 404, "RESTAURANT_NOT_FOUND");

  const updateData = {};
  if (normalizedMode) updateData.kitchenAssignmentMode = normalizedMode;
  if (normalizedScope) updateData.kitchenSelfPickScope = normalizedScope;

  const updated = await prisma.restaurant.update({
    where: { id: rid },
    data: updateData,
    select: {
      id: true,
      kitchenAssignmentMode: true,
      kitchenSelfPickScope: true,
    },
  });

  // Audit Logging
  await logAuditEvent({
    prisma,
    restaurantId: rid,
    actor,
    action: "KITCHEN_ASSIGNMENT_MODE_CHANGED",
    entity: "RESTAURANT_KITCHEN_CONFIG",
    entityId: String(rid),
    details: {
      previous: { mode: existing.kitchenAssignmentMode, scope: existing.kitchenSelfPickScope },
      updated: { mode: updated.kitchenAssignmentMode, scope: updated.kitchenSelfPickScope },
    },
    req,
  });

  const payload = {
    ok: true,
    mode: updated.kitchenAssignmentMode,
    scope: updated.kitchenSelfPickScope,
  };

  // Emit realtime event to kitchen
  const io = req?.server?.io || realtime?.io;
  const staff = req?.server?.staff || realtime?.staff;
  emitToKitchen({
    io,
    staff,
    restaurantId: rid,
    event: "kitchen:config_updated",
    payload,
  });

  return payload;
};

/**
 * 3. Fetch kitchen staff workload metrics for the restaurant
 */
export const getKitchenWorkload = async ({ prisma = defaultPrisma, restaurantId } = {}) => {
  const rid = Number(restaurantId);
  if (!rid) throw new KitchenAssignmentError("Invalid restaurant ID", 400, "INVALID_RESTAURANT");

  // Fetch all staff members who are chefs in this restaurant
  const staffUsers = await prisma.user.findMany({
    where: {
      restaurantId: rid,
      isActive: true,
      OR: [
        { role: "CHEF" },
        { designation: { contains: "Chef", mode: "insensitive" } },
        { designation: { contains: "Cook", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      designation: true,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });

  // Fetch all active items currently assigned
  const activeAssignedItems = await prisma.kitchenOrderTicketItem.findMany({
    where: {
      assignedChefId: { not: null },
      status: { in: ["PENDING", "ACCEPTED", "PREPARING", "READY"] },
      kot: {
        restaurantId: rid,
        status: { notIn: ["CANCELLED", "SERVED", "DELIVERED"] },
      },
    },
    select: {
      id: true,
      assignedChefId: true,
      status: true,
    },
  });

  // Calculate workloads
  const chefWorkloadMap = new Map();
  for (const chef of staffUsers) {
    chefWorkloadMap.set(chef.id, {
      chefId: chef.id,
      chefName: chef.name,
      designation: chef.designation,
      assigned: 0,
      pending: 0,
      preparing: 0,
      ready: 0,
      capacity: 10,
    });
  }

  for (const item of activeAssignedItems) {
    if (!chefWorkloadMap.has(item.assignedChefId)) {
      chefWorkloadMap.set(item.assignedChefId, {
        chefId: item.assignedChefId,
        chefName: `Chef #${item.assignedChefId}`,
        designation: "Chef",
        assigned: 0,
        pending: 0,
        preparing: 0,
        ready: 0,
        capacity: 10,
      });
    }
    const stats = chefWorkloadMap.get(item.assignedChefId);
    stats.assigned += 1;
    if (item.status === "PENDING" || item.status === "ACCEPTED") {
      stats.pending += 1;
    } else if (item.status === "PREPARING") {
      stats.preparing += 1;
    } else if (item.status === "READY") {
      stats.ready += 1;
    }
  }

  return {
    ok: true,
    chefs: Array.from(chefWorkloadMap.values()),
  };
};

/**
 * Helper to emit updated workload metrics
 */
const notifyWorkloadAndAssignment = async ({ prisma, restaurantId, event, payload, targetUserIds = [], req = null, realtime = null }) => {
  const io = req?.server?.io || realtime?.io;
  const staff = req?.server?.staff || realtime?.staff;

  // Emit primary assignment event
  emitToKitchen({
    io,
    staff,
    restaurantId,
    event,
    payload,
    targetUserIds,
  });

  // Fetch and emit fresh workload metrics
  try {
    const workload = await getKitchenWorkload({ prisma, restaurantId });
    emitToKitchen({
      io,
      staff,
      restaurantId,
      event: "kitchen:workload_updated",
      payload: workload,
    });
  } catch (err) {
    console.error("[notifyWorkloadAndAssignment] error:", err?.message);
  }
};

/**
 * 4. Dispatcher assigns an individual item to a chef
 */
export const assignItemToChef = async ({
  prisma = defaultPrisma,
  restaurantId,
  itemId,
  chefId,
  actor = null,
  req = null,
  realtime = null,
} = {}) => {
  const rid = Number(restaurantId);
  const iId = Number(itemId);
  const cId = Number(chefId);

  if (!rid || !iId || !cId) {
    throw new KitchenAssignmentError("restaurantId, itemId, and chefId are required", 400, "MISSING_PARAMS");
  }

  // 1. Verify chef exists and belongs to this restaurant
  const chef = await prisma.user.findFirst({
    where: {
      id: cId,
      restaurantId: rid,
      isActive: true,
    },
    select: { id: true, name: true, designation: true },
  });

  if (!chef) {
    throw new KitchenAssignmentError("Chef not found or not active in this restaurant", 404, "CHEF_NOT_FOUND");
  }

  // 2. Verify item exists, belongs to restaurant, and is eligible
  const item = await prisma.kitchenOrderTicketItem.findFirst({
    where: {
      id: iId,
      kot: { restaurantId: rid },
    },
    include: { kot: true },
  });

  if (!item) {
    throw new KitchenAssignmentError("KOT item not found", 404, "ITEM_NOT_FOUND");
  }

  if (item.kot.status === "CANCELLED" || item.kot.status === "SERVED" || item.kot.status === "DELIVERED") {
    throw new KitchenAssignmentError(`Cannot assign item from ${item.kot.status} KOT`, 400, "KOT_INELIGIBLE");
  }

  if (item.status === "CANCELLED" || item.status === "SERVED") {
    throw new KitchenAssignmentError(`Cannot assign ${item.status} item`, 400, "ITEM_INELIGIBLE");
  }

  const previousChefId = item.assignedChefId;

  // 3. Update assignment
  const updatedItem = await prisma.kitchenOrderTicketItem.update({
    where: { id: iId },
    data: {
      assignedChefId: cId,
      assignedChefName: chef.name,
      assignedByUserId: actor?.userId || null,
      assignedByName: actor?.userName || actor?.name || "Senior Chef",
      assignmentSource: "DISPATCHED",
      assignedAt: new Date(),
    },
    include: {
      kot: {
        select: {
          id: true,
          kotNo: true,
          tableNo: true,
          status: true,
          priority: true,
          restaurantId: true,
        },
      },
    },
  });

  // Audit log
  await logAuditEvent({
    prisma,
    restaurantId: rid,
    actor,
    action: previousChefId ? "KITCHEN_ITEM_REASSIGNED" : "KITCHEN_ITEM_ASSIGNED",
    entity: "KOT_ITEM",
    entityId: String(iId),
    details: {
      kotNumber: item.kot.kotNo,
      itemName: item.itemName,
      previousChefId,
      assignedChefId: cId,
      assignedChefName: chef.name,
    },
    req,
  });

  const targetUsers = [cId];
  if (previousChefId && previousChefId !== cId) {
    targetUsers.push(previousChefId);
  }

  const eventName = previousChefId ? "kitchen:item_reassigned" : "kitchen:item_assigned";
  await notifyWorkloadAndAssignment({
    prisma,
    restaurantId: rid,
    event: eventName,
    payload: {
      ok: true,
      item: {
        ...updatedItem,
        kotNumber: updatedItem.kot?.kotNo,
        name: updatedItem.itemName,
        quantity: updatedItem.qty,
      },
      previousChefId,
      newChefId: cId,
    },
    targetUserIds: targetUsers,
    req,
    realtime,
  });

  return {
    ok: true,
    item: {
      ...updatedItem,
      kotNumber: updatedItem.kot?.kotNo,
      name: updatedItem.itemName,
      quantity: updatedItem.qty,
    },
  };
};

/**
 * 5. Bulk assign multiple items to a single chef
 */
export const bulkAssignItems = async ({
  prisma = defaultPrisma,
  restaurantId,
  itemIds = [],
  chefId,
  actor = null,
  req = null,
  realtime = null,
} = {}) => {
  const rid = Number(restaurantId);
  const cId = Number(chefId);
  const ids = Array.isArray(itemIds) ? itemIds.map(Number).filter(Boolean) : [];

  if (!rid || !cId || !ids.length) {
    throw new KitchenAssignmentError("restaurantId, chefId, and itemIds are required", 400, "MISSING_PARAMS");
  }

  // 1. Verify chef
  const chef = await prisma.user.findFirst({
    where: {
      id: cId,
      restaurantId: rid,
      isActive: true,
    },
    select: { id: true, name: true, designation: true },
  });

  if (!chef) {
    throw new KitchenAssignmentError("Chef not found or not active in this restaurant", 404, "CHEF_NOT_FOUND");
  }

  // 2. Atomically validate and assign in transaction
  const updatedItems = await prisma.$transaction(async (tx) => {
    const items = await tx.kitchenOrderTicketItem.findMany({
      where: {
        id: { in: ids },
        kot: { restaurantId: rid },
      },
      include: { kot: true },
    });

    if (items.length !== ids.length) {
      throw new KitchenAssignmentError("One or more items do not belong to this restaurant", 400, "INVALID_ITEMS");
    }

    // Check statuses
    for (const it of items) {
      if (it.kot.status === "CANCELLED" || it.kot.status === "SERVED" || it.kot.status === "DELIVERED") {
        throw new KitchenAssignmentError(`Item ${it.itemName} belongs to ${it.kot.status} KOT`, 400, "KOT_INELIGIBLE");
      }
      if (it.status === "CANCELLED" || it.status === "SERVED") {
        throw new KitchenAssignmentError(`Item ${it.itemName} is ${it.status}`, 400, "ITEM_INELIGIBLE");
      }
    }

    await tx.kitchenOrderTicketItem.updateMany({
      where: { id: { in: ids } },
      data: {
        assignedChefId: cId,
        assignedChefName: chef.name,
        assignedByUserId: actor?.userId || null,
        assignedByName: actor?.userName || actor?.name || "Senior Chef",
        assignmentSource: "DISPATCHED",
        assignedAt: new Date(),
      },
    });

    return tx.kitchenOrderTicketItem.findMany({
      where: { id: { in: ids } },
      include: {
        kot: {
          select: {
            id: true,
            kotNo: true,
            tableNo: true,
            status: true,
            priority: true,
            restaurantId: true,
          },
        },
      },
    });
  });

  const formattedItems = updatedItems.map((it) => ({
    ...it,
    kotNumber: it.kot?.kotNo,
    name: it.itemName,
    quantity: it.qty,
  }));

  // Audit log
  await logAuditEvent({
    prisma,
    restaurantId: rid,
    actor,
    action: "KITCHEN_ITEM_ASSIGNED",
    entity: "KOT_ITEM_BULK",
    entityId: String(ids.join(",")),
    details: {
      count: formattedItems.length,
      assignedChefId: cId,
      assignedChefName: chef.name,
      itemIds: ids,
    },
    req,
  });

  await notifyWorkloadAndAssignment({
    prisma,
    restaurantId: rid,
    event: "kitchen:item_assigned",
    payload: {
      ok: true,
      items: formattedItems,
      assignedChefId: cId,
    },
    targetUserIds: [cId],
    req,
    realtime,
  });

  return { ok: true, count: formattedItems.length, items: formattedItems };
};

/**
 * 6. Assign all items of a KOT to a chef
 */
export const assignAllKotItems = async ({
  prisma = defaultPrisma,
  restaurantId,
  kotId,
  chefId,
  overwriteAssigned = false,
  actor = null,
  req = null,
  realtime = null,
} = {}) => {
  const rid = Number(restaurantId);
  const kId = Number(kotId);
  const cId = Number(chefId);

  if (!rid || !kId || !cId) {
    throw new KitchenAssignmentError("restaurantId, kotId, and chefId are required", 400, "MISSING_PARAMS");
  }

  // 1. Verify chef
  const chef = await prisma.user.findFirst({
    where: {
      id: cId,
      restaurantId: rid,
      isActive: true,
    },
    select: { id: true, name: true, designation: true },
  });

  if (!chef) {
    throw new KitchenAssignmentError("Chef not found or not active in this restaurant", 404, "CHEF_NOT_FOUND");
  }

  // 2. Fetch KOT
  const kot = await prisma.kitchenOrderTicket.findFirst({
    where: { id: kId, restaurantId: rid },
    include: { items: true },
  });

  if (!kot) {
    throw new KitchenAssignmentError("KOT not found", 404, "KOT_NOT_FOUND");
  }

  if (kot.status === "CANCELLED" || kot.status === "SERVED" || kot.status === "DELIVERED") {
    throw new KitchenAssignmentError(`Cannot assign items from ${kot.status} KOT`, 400, "KOT_INELIGIBLE");
  }

  // Filter items
  const eligibleItems = kot.items.filter((it) => {
    if (it.status === "CANCELLED" || it.status === "SERVED") return false;
    // Safety check: if not overwriting, only take items with no assigned chef
    if (!overwriteAssigned && it.assignedChefId) return false;
    // Even if overwrite is requested, preserve items that are already PREPARING or READY
    if (overwriteAssigned && (it.status === "PREPARING" || it.status === "READY")) return false;
    return true;
  });

  if (!eligibleItems.length) {
    return {
      ok: true,
      count: 0,
      items: [],
      message: "No eligible unassigned items to assign in this KOT",
    };
  }

  const eligibleIds = eligibleItems.map((it) => it.id);

  await prisma.kitchenOrderTicketItem.updateMany({
    where: { id: { in: eligibleIds } },
    data: {
      assignedChefId: cId,
      assignedChefName: chef.name,
      assignedByUserId: actor?.userId || null,
      assignedByName: actor?.userName || actor?.name || "Senior Chef",
      assignmentSource: "DISPATCHED",
      assignedAt: new Date(),
    },
  });

  const updatedItems = await prisma.kitchenOrderTicketItem.findMany({
    where: { id: { in: eligibleIds } },
    include: {
      kot: {
        select: {
          id: true,
          kotNo: true,
          tableNo: true,
          status: true,
          priority: true,
          restaurantId: true,
        },
      },
    },
  });

  const formattedItems = updatedItems.map((it) => ({
    ...it,
    kotNumber: it.kot?.kotNo,
    name: it.itemName,
    quantity: it.qty,
  }));

  // Audit log
  await logAuditEvent({
    prisma,
    restaurantId: rid,
    actor,
    action: "KITCHEN_ITEM_ASSIGNED",
    entity: "KOT_WHOLE",
    entityId: String(kId),
    details: {
      kotNumber: kot.kotNo,
      count: formattedItems.length,
      assignedChefId: cId,
      assignedChefName: chef.name,
      itemIds: eligibleIds,
    },
    req,
  });

  await notifyWorkloadAndAssignment({
    prisma,
    restaurantId: rid,
    event: "kitchen:item_assigned",
    payload: {
      ok: true,
      kotId: kId,
      items: formattedItems,
      assignedChefId: cId,
    },
    targetUserIds: [cId],
    req,
    realtime,
  });

  return { ok: true, count: formattedItems.length, items: formattedItems };
};

/**
 * 7. Reassign an item to a different chef
 */
export const reassignItem = async ({
  prisma = defaultPrisma,
  restaurantId,
  itemId,
  newChefId,
  actor = null,
  req = null,
  realtime = null,
} = {}) => {
  return assignItemToChef({
    prisma,
    restaurantId,
    itemId,
    chefId: newChefId,
    actor,
    req,
    realtime,
  });
};

/**
 * 8. Fetch assigned items for an individual chef station
 */
export const getChefAssignedItems = async ({
  prisma = defaultPrisma,
  restaurantId,
  chefId,
  requestingActor = null,
} = {}) => {
  const rid = Number(restaurantId);
  const cId = Number(chefId);

  if (!rid || !cId) {
    throw new KitchenAssignmentError("restaurantId and chefId are required", 400, "MISSING_PARAMS");
  }

  // Security check:
  // If requesting user is a chef, they cannot view another chef's station
  const actorRole = String(requestingActor?.role || "").toUpperCase();
  const actorDesignation = String(requestingActor?.designation || "").toLowerCase();
  const isPrivileged =
    actorRole === "OWNER" ||
    actorRole === "MANAGER" ||
    actorRole === "SUPER_ADMIN" ||
    actorDesignation.includes("senior chef") ||
    actorDesignation.includes("head chef") ||
    actorDesignation.includes("executive chef");

  if (!isPrivileged && Number(requestingActor?.userId || requestingActor?.id) !== cId) {
    throw new KitchenAssignmentError("Access denied. You can only access your own station.", 403, "FORBIDDEN_STATION_ACCESS");
  }

  const items = await prisma.kitchenOrderTicketItem.findMany({
    where: {
      assignedChefId: cId,
      status: { in: ["PENDING", "ACCEPTED", "PREPARING", "READY"] },
      kot: {
        restaurantId: rid,
        status: { notIn: ["CANCELLED", "SERVED", "DELIVERED"] },
      },
    },
    include: {
      kot: {
        select: {
          id: true,
          kotNo: true,
          tableNo: true,
          status: true,
          priority: true,
          createdAt: true,
          restaurantId: true,
        },
      },
    },
    orderBy: [
      { kot: { priority: "desc" } },
      { assignedAt: "asc" },
      { createdAt: "asc" },
    ],
  });

  const formattedItems = items.map((it) => {
    const elapsedMinutes = Math.floor((Date.now() - new Date(it.assignedAt || it.createdAt).getTime()) / 60000);
    return {
      id: it.id,
      kotId: it.kotId,
      kotNumber: it.kot.kotNo,
      kotNo: it.kot.kotNo,
      tableNo: it.kot.tableNo,
      priority: it.kot.priority,
      name: it.itemName,
      itemName: it.itemName,
      quantity: it.qty,
      qty: it.qty,
      variant: it.variantName,
      variantName: it.variantName,
      modifiers: it.selectedModifiers,
      selectedModifiers: it.selectedModifiers,
      notes: it.notes,
      status: it.status,
      assignedChefId: it.assignedChefId,
      assignedChefName: it.assignedChefName,
      assignmentSource: it.assignmentSource,
      assignedAt: it.assignedAt,
      startedAt: it.startedAt,
      readyAt: it.readyAt,
      elapsedMinutes,
    };
  });

  return { ok: true, items: formattedItems };
};

/**
 * 9. Chef self-picks an item (Atomic concurrency safe)
 */
export const selfPickItem = async ({
  prisma = defaultPrisma,
  restaurantId,
  itemId,
  chefId,
  actor = null,
  req = null,
  realtime = null,
} = {}) => {
  const rid = Number(restaurantId);
  const iId = Number(itemId);
  const cId = Number(chefId);

  if (!rid || !iId || !cId) {
    throw new KitchenAssignmentError("restaurantId, itemId, and chefId are required", 400, "MISSING_PARAMS");
  }

  // 1. Check restaurant config
  const config = await getKitchenConfig({ prisma, restaurantId: rid });
  if (config.mode !== "SELF_PICK") {
    throw new KitchenAssignmentError("Self-Pick is currently disabled by the Senior Chef.", 403, "SELF_PICK_DISABLED");
  }

  if (config.scope !== "ITEMS" && config.scope !== "BOTH") {
    throw new KitchenAssignmentError("Self-Pick for this type of work is currently disabled.", 403, "INVALID_SCOPE");
  }

  // 2. Verify chef exists and belongs to restaurant
  const chef = await prisma.user.findFirst({
    where: {
      id: cId,
      restaurantId: rid,
      isActive: true,
    },
    select: { id: true, name: true },
  });

  if (!chef) {
    throw new KitchenAssignmentError("Chef not found or not active in this restaurant", 404, "CHEF_NOT_FOUND");
  }

  // 3. ATOMIC CONDITIONAL UPDATE:
  // update only if assignedChefId is NULL and status is eligible
  const updateResult = await prisma.kitchenOrderTicketItem.updateMany({
    where: {
      id: iId,
      assignedChefId: null,
      status: { in: ["PENDING", "ACCEPTED"] },
      kot: {
        restaurantId: rid,
        status: { notIn: ["CANCELLED", "SERVED", "DELIVERED"] },
      },
    },
    data: {
      assignedChefId: cId,
      assignedChefName: chef.name,
      assignedByUserId: Number(actor?.userId || cId),
      assignedByName: chef.name,
      assignmentSource: "SELF_PICKED",
      assignedAt: new Date(),
    },
  });

  // If 0 rows updated, inspect why to return appropriate 409 Conflict
  if (updateResult.count === 0) {
    const existing = await prisma.kitchenOrderTicketItem.findFirst({
      where: { id: iId, kot: { restaurantId: rid } },
      include: { kot: true },
    });

    if (!existing) {
      throw new KitchenAssignmentError("Item not found", 404, "ITEM_NOT_FOUND");
    }

    if (existing.assignedChefId) {
      throw new KitchenAssignmentError("This item was just claimed by another chef.", 409, "ITEM_ALREADY_CLAIMED");
    }

    if (existing.kot.status === "CANCELLED" || existing.kot.status === "SERVED") {
      throw new KitchenAssignmentError(`Cannot claim item from ${existing.kot.status} KOT`, 400, "KOT_INELIGIBLE");
    }

    throw new KitchenAssignmentError("Item is not eligible to be claimed", 409, "ITEM_CLAIM_FAILED");
  }

  // Fetch updated item
  const updatedItem = await prisma.kitchenOrderTicketItem.findUnique({
    where: { id: iId },
    include: {
      kot: {
        select: {
          id: true,
          kotNo: true,
          tableNo: true,
          status: true,
          priority: true,
          restaurantId: true,
        },
      },
    },
  });

  const formattedItem = {
    ...updatedItem,
    kotNumber: updatedItem.kot?.kotNo,
    name: updatedItem.itemName,
    quantity: updatedItem.qty,
  };

  // Audit log
  await logAuditEvent({
    prisma,
    restaurantId: rid,
    actor,
    action: "KITCHEN_ITEM_SELF_PICKED",
    entity: "KOT_ITEM",
    entityId: String(iId),
    details: {
      kotNumber: updatedItem.kot.kotNo,
      itemName: updatedItem.itemName,
      claimedByChefId: cId,
      claimedByChefName: chef.name,
    },
    req,
  });

  await notifyWorkloadAndAssignment({
    prisma,
    restaurantId: rid,
    event: "kitchen:item_self_picked",
    payload: {
      ok: true,
      item: formattedItem,
      claimedByChefId: cId,
      claimedByChefName: chef.name,
    },
    targetUserIds: [cId],
    req,
    realtime,
  });

  return { ok: true, item: formattedItem };
};

/**
 * 10. Chef self-picks all unassigned items in a KOT
 */
export const selfPickKot = async ({
  prisma = defaultPrisma,
  restaurantId,
  kotId,
  chefId,
  actor = null,
  req = null,
  realtime = null,
} = {}) => {
  const rid = Number(restaurantId);
  const kId = Number(kotId);
  const cId = Number(chefId);

  if (!rid || !kId || !cId) {
    throw new KitchenAssignmentError("restaurantId, kotId, and chefId are required", 400, "MISSING_PARAMS");
  }

  // 1. Check restaurant config
  const config = await getKitchenConfig({ prisma, restaurantId: rid });
  if (config.mode !== "SELF_PICK") {
    throw new KitchenAssignmentError("Self-Pick is currently disabled by the Senior Chef.", 403, "SELF_PICK_DISABLED");
  }

  if (config.scope !== "KOTS" && config.scope !== "BOTH") {
    throw new KitchenAssignmentError("Self-Pick for this type of work is currently disabled.", 403, "INVALID_SCOPE");
  }

  // 2. Verify chef exists and belongs to restaurant
  const chef = await prisma.user.findFirst({
    where: {
      id: cId,
      restaurantId: rid,
      isActive: true,
    },
    select: { id: true, name: true },
  });

  if (!chef) {
    throw new KitchenAssignmentError("Chef not found or not active in this restaurant", 404, "CHEF_NOT_FOUND");
  }

  // 3. Check KOT
  const kot = await prisma.kitchenOrderTicket.findFirst({
    where: { id: kId, restaurantId: rid },
    include: { items: true },
  });

  if (!kot) {
    throw new KitchenAssignmentError("KOT not found", 404, "KOT_NOT_FOUND");
  }

  if (kot.status === "CANCELLED" || kot.status === "SERVED" || kot.status === "DELIVERED") {
    throw new KitchenAssignmentError(`Cannot claim items from ${kot.status} KOT`, 400, "KOT_INELIGIBLE");
  }

  // Check currently assigned vs unassigned
  const alreadyAssignedItems = kot.items.filter((it) => it.assignedChefId !== null);
  const eligibleUnassignedItems = kot.items.filter(
    (it) => it.assignedChefId === null && (it.status === "PENDING" || it.status === "ACCEPTED")
  );

  if (eligibleUnassignedItems.length === 0) {
    if (alreadyAssignedItems.length > 0) {
      throw new KitchenAssignmentError("All items in this KOT are already claimed by other chefs.", 409, "KOT_ALREADY_CLAIMED");
    }
    throw new KitchenAssignmentError("No eligible items available to claim in this KOT.", 400, "NO_ELIGIBLE_ITEMS");
  }

  const eligibleIds = eligibleUnassignedItems.map((it) => it.id);

  // ATOMIC conditional update: only update items that still have assignedChefId: null
  const updateResult = await prisma.kitchenOrderTicketItem.updateMany({
    where: {
      id: { in: eligibleIds },
      assignedChefId: null,
      status: { in: ["PENDING", "ACCEPTED"] },
    },
    data: {
      assignedChefId: cId,
      assignedChefName: chef.name,
      assignedByUserId: Number(actor?.userId || cId),
      assignedByName: chef.name,
      assignmentSource: "SELF_PICKED",
      assignedAt: new Date(),
    },
  });

  if (updateResult.count === 0) {
    throw new KitchenAssignmentError("These items were just claimed by another chef.", 409, "ITEMS_ALREADY_CLAIMED");
  }

  const claimedItems = await prisma.kitchenOrderTicketItem.findMany({
    where: {
      id: { in: eligibleIds },
      assignedChefId: cId,
    },
    include: {
      kot: {
        select: {
          id: true,
          kotNo: true,
          tableNo: true,
          status: true,
          priority: true,
          restaurantId: true,
        },
      },
    },
  });

  const formattedClaimed = claimedItems.map((it) => ({
    ...it,
    kotNumber: it.kot?.kotNo,
    name: it.itemName,
    quantity: it.qty,
  }));

  // Audit log
  await logAuditEvent({
    prisma,
    restaurantId: rid,
    actor,
    action: "KITCHEN_ITEM_SELF_PICKED",
    entity: "KOT_WHOLE",
    entityId: String(kId),
    details: {
      kotNumber: kot.kotNo,
      claimedCount: formattedClaimed.length,
      alreadyAssignedCount: alreadyAssignedItems.length,
      claimedByChefId: cId,
      claimedByChefName: chef.name,
    },
    req,
  });

  await notifyWorkloadAndAssignment({
    prisma,
    restaurantId: rid,
    event: "kitchen:item_self_picked",
    payload: {
      ok: true,
      kotId: kId,
      items: formattedClaimed,
      claimedByChefId: cId,
      claimedByChefName: chef.name,
    },
    targetUserIds: [cId],
    req,
    realtime,
  });

  return {
    ok: true,
    claimedCount: formattedClaimed.length,
    claimedItems: formattedClaimed,
    alreadyAssignedCount: alreadyAssignedItems.length,
  };
};

/**
 * 11. Fetch available work (unassigned items / KOTs) for chefs in SELF_PICK mode
 */
export const getAvailableKitchenWork = async ({ prisma = defaultPrisma, restaurantId } = {}) => {
  const rid = Number(restaurantId);
  if (!rid) throw new KitchenAssignmentError("Invalid restaurant ID", 400, "INVALID_RESTAURANT");

  const config = await getKitchenConfig({ prisma, restaurantId: rid });

  if (config.mode !== "SELF_PICK") {
    return {
      ok: true,
      mode: "DISPATCHER",
      scope: config.scope,
      availableItems: [],
      availableKots: [],
    };
  }

  let availableItems = [];
  let availableKots = [];

  const includeItems = config.scope === "ITEMS" || config.scope === "BOTH";
  const includeKots = config.scope === "KOTS" || config.scope === "BOTH";

  if (includeItems) {
    const rawItems = await prisma.kitchenOrderTicketItem.findMany({
      where: {
        assignedChefId: null,
        status: { in: ["PENDING", "ACCEPTED"] },
        kot: {
          restaurantId: rid,
          status: { notIn: ["CANCELLED", "SERVED", "DELIVERED"] },
        },
      },
      include: {
        kot: {
          select: {
            id: true,
            kotNo: true,
            tableNo: true,
            status: true,
            priority: true,
            createdAt: true,
            restaurantId: true,
          },
        },
      },
      orderBy: [
        { kot: { priority: "desc" } },
        { createdAt: "asc" },
      ],
    });

    availableItems = rawItems.map((it) => {
      const elapsedMinutes = Math.floor((Date.now() - new Date(it.createdAt).getTime()) / 60000);
      return {
        id: it.id,
        kotId: it.kotId,
        kotNumber: it.kot.kotNo,
        kotNo: it.kot.kotNo,
        tableNo: it.kot.tableNo,
        priority: it.kot.priority,
        name: it.itemName,
        itemName: it.itemName,
        quantity: it.qty,
        qty: it.qty,
        variant: it.variantName,
        modifiers: it.selectedModifiers,
        notes: it.notes,
        status: it.status,
        elapsedMinutes,
        createdAt: it.createdAt,
      };
    });
  }

  if (includeKots) {
    const rawKots = await prisma.kitchenOrderTicket.findMany({
      where: {
        restaurantId: rid,
        status: { notIn: ["CANCELLED", "SERVED", "DELIVERED"] },
        items: {
          some: {
            assignedChefId: null,
            status: { in: ["PENDING", "ACCEPTED"] },
          },
        },
      },
      include: {
        items: {
          select: {
            id: true,
            itemName: true,
            qty: true,
            variantName: true,
            status: true,
            assignedChefId: true,
            assignedChefName: true,
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "asc" },
      ],
    });

    availableKots = rawKots.map((k) => {
      const elapsedMinutes = Math.floor((Date.now() - new Date(k.createdAt).getTime()) / 60000);
      const unassignedCount = k.items.filter((it) => it.assignedChefId === null && (it.status === "PENDING" || it.status === "ACCEPTED")).length;
      return {
        id: k.id,
        kotNumber: k.kotNo,
        kotNo: k.kotNo,
        tableNo: k.tableNo,
        status: k.status,
        priority: k.priority,
        elapsedMinutes,
        createdAt: k.createdAt,
        totalItems: k.items.length,
        unassignedCount,
        items: k.items.map((it) => ({
          ...it,
          name: it.itemName,
          quantity: it.qty,
        })),
      };
    });
  }

  return {
    ok: true,
    mode: config.mode,
    scope: config.scope,
    availableItems,
    availableKots,
  };
};

/**
 * Helper to calculate timezone offset difference in milliseconds
 */
function getTimezoneOffsetMs(timeZone, dateStr) {
  try {
    const d = new Date(dateStr);
    const utcDate = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
    const tzDate = new Date(d.toLocaleString("en-US", { timeZone }));
    return tzDate.getTime() - utcDate.getTime();
  } catch {
    return 0;
  }
}

/**
 * 12. Fetch completed preparation history for an individual chef or whole kitchen (Senior Chef / Manager / Owner)
 */
export const getChefHistory = async ({
  prisma = defaultPrisma,
  restaurantId,
  chefId = null,
  requestingActor = null,
  date = null,
  from = null,
  to = null,
  range = "all",
  search = null,
  status = null,
  page = 1,
  limit = 20,
} = {}) => {
  const rid = Number(restaurantId);
  let cId = null;
  if (chefId && String(chefId).toLowerCase() !== "all") {
    if (String(chefId).toLowerCase() === "me") {
      cId = Number(requestingActor?.userId || requestingActor?.id || 0);
    } else {
      const parsed = Number(chefId);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new KitchenAssignmentError("Invalid chefId provided", 400, "INVALID_CHEF_ID");
      }
      cId = parsed;
    }
  }

  if (!rid) {
    throw new KitchenAssignmentError("restaurantId is required", 400, "MISSING_PARAMS");
  }

  // Security check: Line chef cannot access another chef's history or whole kitchen history
  const actorRole = String(requestingActor?.role || "").toUpperCase();
  const actorDesignation = String(requestingActor?.designation || "").toLowerCase();
  const isPrivileged =
    actorRole === "OWNER" ||
    actorRole === "MANAGER" ||
    actorRole === "SUPER_ADMIN" ||
    actorDesignation.includes("senior chef") ||
    actorDesignation.includes("head chef") ||
    actorDesignation.includes("executive chef");

  const actorId = Number(requestingActor?.userId || requestingActor?.id);

  // Cross-restaurant check: actor must belong to the same restaurant (unless super admin)
  if (actorRole !== "SUPER_ADMIN" && requestingActor?.restaurantId && Number(requestingActor.restaurantId) !== rid) {
    throw new KitchenAssignmentError("Access denied. Restaurant boundary violation.", 403, "FORBIDDEN_RESTAURANT_ACCESS");
  }

  if (!cId) {
    // Whole kitchen history requested: only privileged roles allowed
    if (!isPrivileged) {
      throw new KitchenAssignmentError(
        "Access denied. Whole-kitchen history is restricted to Senior Chefs and management.",
        403,
        "FORBIDDEN_HISTORY_ACCESS"
      );
    }
  } else {
    // Specific chef requested: line chef can only access their own history
    if (!isPrivileged && actorId !== cId) {
      throw new KitchenAssignmentError(
        "Access denied. You can only access your own history.",
        403,
        "FORBIDDEN_HISTORY_ACCESS"
      );
    }

    // Verify chef exists and belongs to this restaurant
    const chefUser = await prisma.user.findFirst({
      where: {
        id: cId,
        OR: [
          { restaurantId: rid },
          { restaurantId: null },
        ],
      },
      select: { id: true, name: true, restaurantId: true },
    });
    if (!chefUser) {
      throw new KitchenAssignmentError("Chef not found in this restaurant", 404, "CHEF_NOT_FOUND");
    }
    if (chefUser.restaurantId && Number(chefUser.restaurantId) !== rid && actorRole !== "SUPER_ADMIN") {
      throw new KitchenAssignmentError("Access denied. Restaurant boundary violation.", 403, "FORBIDDEN_RESTAURANT_ACCESS");
    }
  }

  // Fetch restaurant timezone
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: rid },
    select: { id: true, name: true, timezone: true },
  });
  const tz = restaurant?.timezone || "Asia/Kolkata";

  // Build where clause
  // Authoritative completion: readyAt IS NOT NULL and status in ["READY", "SERVED"] (or specific status filter)
  const statusCondition = status && status !== "ALL"
    ? String(status).toUpperCase()
    : { in: ["READY", "SERVED"] };

  const where = {
    kot: {
      restaurantId: rid,
    },
    readyAt: { not: null },
    status: statusCondition,
  };

  const andClauses = [];

  if (cId) {
    andClauses.push({
      OR: [
        { assignedChefId: cId },
        { preparedByUserId: cId },
      ],
    });
  }

  // Date filtering
  let dateBounds = null;
  const normalizedRange = String(range || "all").toLowerCase().trim();

  if (date) {
    // Single date: "YYYY-MM-DD"
    const startStr = `${date}T00:00:00.000`;
    const endStr = `${date}T23:59:59.999`;
    const offset = getTimezoneOffsetMs(tz, startStr);
    const start = new Date(new Date(startStr).getTime() - offset);
    const end = new Date(new Date(endStr).getTime() - offset);
    dateBounds = { start, end };
  } else if (from || to) {
    let start = null;
    let end = null;
    if (from) {
      const startStr = `${from}T00:00:00.000`;
      const offset = getTimezoneOffsetMs(tz, startStr);
      start = new Date(new Date(startStr).getTime() - offset);
    }
    if (to) {
      const endStr = `${to}T23:59:59.999`;
      const offset = getTimezoneOffsetMs(tz, endStr);
      end = new Date(new Date(endStr).getTime() - offset);
    }
    dateBounds = { start, end };
  } else if (normalizedRange === "today") {
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    const startStr = `${todayStr}T00:00:00.000`;
    const endStr = `${todayStr}T23:59:59.999`;
    const offset = getTimezoneOffsetMs(tz, startStr);
    dateBounds = {
      start: new Date(new Date(startStr).getTime() - offset),
      end: new Date(new Date(endStr).getTime() - offset),
    };
  } else if (normalizedRange === "yesterday") {
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yestStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(yesterdayDate);
    const startStr = `${yestStr}T00:00:00.000`;
    const endStr = `${yestStr}T23:59:59.999`;
    const offset = getTimezoneOffsetMs(tz, startStr);
    dateBounds = {
      start: new Date(new Date(startStr).getTime() - offset),
      end: new Date(new Date(endStr).getTime() - offset),
    };
  } else if (normalizedRange === "7d") {
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const pastStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(pastDate);
    const startStr = `${pastStr}T00:00:00.000`;
    const offset = getTimezoneOffsetMs(tz, startStr);
    dateBounds = {
      start: new Date(new Date(startStr).getTime() - offset),
      end: new Date(),
    };
  } else if (normalizedRange === "30d") {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const pastStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(pastDate);
    const startStr = `${pastStr}T00:00:00.000`;
    const offset = getTimezoneOffsetMs(tz, startStr);
    dateBounds = {
      start: new Date(new Date(startStr).getTime() - offset),
      end: new Date(),
    };
  }

  if (dateBounds) {
    const readyAtFilter = {};
    if (dateBounds.start) readyAtFilter.gte = dateBounds.start;
    if (dateBounds.end) readyAtFilter.lte = dateBounds.end;
    if (readyAtFilter.gte || readyAtFilter.lte) {
      where.readyAt = readyAtFilter;
    }
  }

  // Search filtering across item, KOT #, order #, table #, and chef name
  if (search && String(search).trim()) {
    const q = String(search).trim();
    const isNum = !Number.isNaN(Number(q));
    andClauses.push({
      OR: [
        { itemName: { contains: q, mode: "insensitive" } },
        { assignedChefName: { contains: q, mode: "insensitive" } },
        { preparedByName: { contains: q, mode: "insensitive" } },
        { kot: { kotNo: { contains: q, mode: "insensitive" } } },
        { kot: { tableNo: { contains: q, mode: "insensitive" } } },
        { kot: { order: { orderNo: { contains: q, mode: "insensitive" } } } },
        ...(isNum ? [{ kot: { orderId: Number(q) } }, { kotId: Number(q) }, { orderItemId: Number(q) }] : []),
      ],
    });
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  // Authoritative operational summary metrics for the filtered dataset
  const allFilteredItems = await prisma.kitchenOrderTicketItem.findMany({
    where,
    select: {
      id: true,
      kotId: true,
      assignedChefId: true,
      preparedByUserId: true,
      startedAt: true,
      assignedAt: true,
      readyAt: true,
      createdAt: true,
      kot: {
        select: {
          estimatedPrepTimeMinutes: true,
          createdAt: true,
        },
      },
    },
  });

  const totalCount = allFilteredItems.length;
  const completedKots = new Set(allFilteredItems.map((it) => it.kotId)).size;
  const activeChefs = new Set(
    allFilteredItems
      .map((it) => it.assignedChefId || it.preparedByUserId)
      .filter(Boolean)
  ).size;

  let totalPrepMinutes = 0;
  let prepCount = 0;
  let overdueCompletions = 0;

  for (const it of allFilteredItems) {
    let prepMins = null;
    if (it.startedAt && it.readyAt) {
      prepMins = Math.max(1, Math.round((new Date(it.readyAt).getTime() - new Date(it.startedAt).getTime()) / 60000));
    } else if (it.assignedAt && it.readyAt) {
      prepMins = Math.max(1, Math.round((new Date(it.readyAt).getTime() - new Date(it.assignedAt).getTime()) / 60000));
    }
    if (prepMins !== null) {
      totalPrepMinutes += prepMins;
      prepCount += 1;
    }

    const est = it.kot?.estimatedPrepTimeMinutes || 15;
    const start = it.startedAt || it.assignedAt || it.kot?.createdAt || it.createdAt;
    if (it.readyAt && start) {
      const elapsed = Math.round((new Date(it.readyAt).getTime() - new Date(start).getTime()) / 60000);
      if (elapsed > est) {
        overdueCompletions += 1;
      }
    }
  }

  const avgPrepTimeMinutes = prepCount > 0 ? Math.round(totalPrepMinutes / prepCount) : 0;

  const summary = {
    completedItems: totalCount,
    completedKots,
    activeChefs,
    avgPrepTimeMinutes,
    overdueCompletions,
  };

  // Pagination calculation
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const rawItems = await prisma.kitchenOrderTicketItem.findMany({
    where,
    include: {
      kot: {
        select: {
          id: true,
          kotNo: true,
          tableNo: true,
          status: true,
          priority: true,
          createdAt: true,
          restaurantId: true,
          orderId: true,
          order: {
            select: {
              id: true,
              orderNo: true,
              orderSource: true,
              fulfillment: true,
            },
          },
        },
      },
    },
    orderBy: [
      { readyAt: "desc" },
      { id: "desc" },
    ],
    skip,
    take: parsedLimit,
  });

  const totalPages = Math.ceil(totalCount / parsedLimit) || 1;
  const hasMore = parsedPage < totalPages;

  // Format date helper using restaurant timezone
  const now = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(yesterdayDate);

  const formattedItems = rawItems.map((it) => {
    const readyDate = it.readyAt ? new Date(it.readyAt) : new Date(it.createdAt);
    const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(readyDate);

    let dateHeading = "";
    const fullDateText = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(readyDate);

    if (dateKey === todayKey) {
      dateHeading = `TODAY • ${fullDateText}`;
    } else if (dateKey === yesterdayKey) {
      dateHeading = `YESTERDAY • ${fullDateText}`;
    } else {
      dateHeading = fullDateText;
    }

    const completedTime = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(readyDate);

    let prepTimeMinutes = null;
    if (it.startedAt && it.readyAt) {
      prepTimeMinutes = Math.max(1, Math.round((new Date(it.readyAt).getTime() - new Date(it.startedAt).getTime()) / 60000));
    }

    return {
      id: it.id,
      orderItemId: it.orderItemId,
      kotItemId: it.id,
      menuItemId: it.menuItemId,
      orderId: it.kot?.orderId || it.kot?.order?.id,
      orderNo: it.kot?.order?.orderNo,
      orderType: it.kot?.order?.fulfillment || it.kot?.order?.orderSource || "DINE_IN",
      orderSource: it.kot?.order?.orderSource,
      fulfillment: it.kot?.order?.fulfillment,
      kotId: it.kotId,
      kotNumber: it.kot?.kotNo,
      kotNo: it.kot?.kotNo,
      tableNo: it.kot?.tableNo || "Takeaway",
      name: it.itemName,
      itemName: it.itemName,
      quantity: it.qty,
      qty: it.qty,
      variantName: it.variantName,
      selectedModifiers: it.selectedModifiers,
      notes: it.notes,
      priority: it.kot?.priority || "NORMAL",
      status: it.status,
      assignmentSource: it.assignmentSource || "DISPATCHED",
      assignedChefId: it.assignedChefId,
      assignedChefName: it.assignedChefName,
      chefId: it.assignedChefId || it.preparedByUserId || null,
      chefName: it.assignedChefName || it.preparedByName || null,
      assignedAt: it.assignedAt,
      startedAt: it.startedAt,
      readyAt: it.readyAt,
      completedAt: it.readyAt,
      prepTimeMinutes,
      completedTime,
      dateKey,
      dateHeading,
    };
  });

  // Group items by dateKey preserving descending completion order
  const groupMap = new Map();
  for (const it of formattedItems) {
    if (!groupMap.has(it.dateKey)) {
      groupMap.set(it.dateKey, {
        dateKey: it.dateKey,
        dateHeading: it.dateHeading,
        items: [],
      });
    }
    groupMap.get(it.dateKey).items.push(it);
  }

  const groupedByDate = Array.from(groupMap.values());

  return {
    ok: true,
    success: true,
    total: totalCount,
    items: formattedItems,
    groupedByDate,
    summary,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      totalCount,
      totalPages,
      hasMore,
    },
    timezone: tz,
  };
};

/**
 * 13. Fetch completed food-service history for Server Station (Server / Steward / Manager / Owner)
 */
export const getServerHistory = async ({
  prisma = defaultPrisma,
  restaurantId,
  serverId = null,
  requestingActor = null,
  date = null,
  from = null,
  to = null,
  range = "all",
  search = null,
  status = null,
  page = 1,
  limit = 20,
} = {}) => {
  const rid = Number(restaurantId);
  const hasSpecificServer = serverId && String(serverId).toLowerCase() !== "all";
  const sId = hasSpecificServer ? Number(serverId) : null;

  if (!rid) {
    throw new KitchenAssignmentError("restaurantId is required", 400, "MISSING_PARAMS");
  }

  const actorRole = String(requestingActor?.role || "").toUpperCase();
  const actorDesignation = String(requestingActor?.designation || "").toLowerCase();
  const isPrivileged =
    actorRole === "OWNER" ||
    actorRole === "MANAGER" ||
    actorRole === "SUPER_ADMIN" ||
    actorDesignation.includes("senior chef") ||
    actorDesignation.includes("head chef") ||
    actorDesignation.includes("executive chef");

  const actorId = Number(requestingActor?.userId || requestingActor?.id);

  // Cross-restaurant check: actor must belong to the same restaurant (unless super admin)
  if (actorRole !== "SUPER_ADMIN" && requestingActor?.restaurantId && Number(requestingActor.restaurantId) !== rid) {
    throw new KitchenAssignmentError("Access denied. Restaurant boundary violation.", 403, "FORBIDDEN_RESTAURANT_ACCESS");
  }

  let effectiveServerId = sId;
  if (!isPrivileged) {
    if (sId && sId !== actorId) {
      throw new KitchenAssignmentError(
        "Access denied. You can only access your own server history.",
        403,
        "FORBIDDEN_HISTORY_ACCESS"
      );
    }
    // Default to the requesting server's identity
    effectiveServerId = actorId;
  }

  if (effectiveServerId) {
    // Verify server exists in this restaurant
    const serverUser = await prisma.user.findFirst({
      where: { id: effectiveServerId, restaurantId: rid },
      select: { id: true, name: true },
    });
    if (!serverUser) {
      throw new KitchenAssignmentError("Server not found in this restaurant", 404, "SERVER_NOT_FOUND");
    }
  }

  // Fetch restaurant timezone
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: rid },
    select: { id: true, name: true, timezone: true },
  });
  const tz = restaurant?.timezone || "Asia/Kolkata";

  // Authoritative server completed state: only SERVED or DELIVERED items appear in history.
  // PENDING, PREPARING, READY are active queue only.
  const statusCondition = status && status !== "ALL"
    ? String(status).toUpperCase()
    : { in: ["SERVED", "DELIVERED"] };

  const where = {
    kot: {
      restaurantId: rid,
    },
    status: statusCondition,
  };

  const andClauses = [];

  // Scoping to server if specific server is selected / authenticated
  if (effectiveServerId) {
    andClauses.push({
      OR: [
        { kot: { waiterId: effectiveServerId } },
        { kot: { order: { createdByUserId: effectiveServerId } } },
        { kot: { tableSession: { waiterId: effectiveServerId } } },
        { kot: { order: { tableSession: { waiterId: effectiveServerId } } } },
      ],
    });
  }

  // Date filtering
  let dateBounds = null;
  const normalizedRange = String(range || "all").toLowerCase().trim();

  if (date) {
    const startStr = `${date}T00:00:00.000`;
    const endStr = `${date}T23:59:59.999`;
    const offset = getTimezoneOffsetMs(tz, startStr);
    const start = new Date(new Date(startStr).getTime() - offset);
    const end = new Date(new Date(endStr).getTime() - offset);
    dateBounds = { start, end };
  } else if (from || to) {
    let start = null;
    let end = null;
    if (from) {
      const startStr = `${from}T00:00:00.000`;
      const offset = getTimezoneOffsetMs(tz, startStr);
      start = new Date(new Date(startStr).getTime() - offset);
    }
    if (to) {
      const endStr = `${to}T23:59:59.999`;
      const offset = getTimezoneOffsetMs(tz, endStr);
      end = new Date(new Date(endStr).getTime() - offset);
    }
    dateBounds = { start, end };
  } else if (normalizedRange === "today") {
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    const startStr = `${todayStr}T00:00:00.000`;
    const endStr = `${todayStr}T23:59:59.999`;
    const offset = getTimezoneOffsetMs(tz, startStr);
    dateBounds = {
      start: new Date(new Date(startStr).getTime() - offset),
      end: new Date(new Date(endStr).getTime() - offset),
    };
  } else if (normalizedRange === "yesterday") {
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yestStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(yesterdayDate);
    const startStr = `${yestStr}T00:00:00.000`;
    const endStr = `${yestStr}T23:59:59.999`;
    const offset = getTimezoneOffsetMs(tz, startStr);
    dateBounds = {
      start: new Date(new Date(startStr).getTime() - offset),
      end: new Date(new Date(endStr).getTime() - offset),
    };
  } else if (normalizedRange === "7d") {
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const pastStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(pastDate);
    const startStr = `${pastStr}T00:00:00.000`;
    const offset = getTimezoneOffsetMs(tz, startStr);
    dateBounds = {
      start: new Date(new Date(startStr).getTime() - offset),
      end: new Date(),
    };
  } else if (normalizedRange === "30d") {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const pastStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(pastDate);
    const startStr = `${pastStr}T00:00:00.000`;
    const offset = getTimezoneOffsetMs(tz, startStr);
    dateBounds = {
      start: new Date(new Date(startStr).getTime() - offset),
      end: new Date(),
    };
  }

  if (dateBounds) {
    const timeFilter = {};
    if (dateBounds.start) timeFilter.gte = dateBounds.start;
    if (dateBounds.end) timeFilter.lte = dateBounds.end;
    if (timeFilter.gte || timeFilter.lte) {
      andClauses.push({
        OR: [
          { kot: { updatedAt: timeFilter } },
          { readyAt: timeFilter },
          { createdAt: timeFilter },
        ],
      });
    }
  }

  // Search filtering
  if (search && String(search).trim()) {
    const q = String(search).trim();
    const isNum = !Number.isNaN(Number(q));
    andClauses.push({
      OR: [
        { itemName: { contains: q, mode: "insensitive" } },
        { kot: { kotNo: { contains: q, mode: "insensitive" } } },
        { kot: { tableNo: { contains: q, mode: "insensitive" } } },
        { kot: { waiterName: { contains: q, mode: "insensitive" } } },
        { kot: { order: { orderNo: { contains: q, mode: "insensitive" } } } },
        { kot: { order: { customerName: { contains: q, mode: "insensitive" } } } },
        { assignedChefName: { contains: q, mode: "insensitive" } },
        { preparedByName: { contains: q, mode: "insensitive" } },
        ...(isNum ? [{ kot: { orderId: Number(q) } }, { kotId: Number(q) }, { orderItemId: Number(q) }] : []),
      ],
    });
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  // Summary Metrics calculation across all matching items
  const allFilteredItems = await prisma.kitchenOrderTicketItem.findMany({
    where,
    select: {
      id: true,
      kotId: true,
      orderItemId: true,
      kot: {
        select: {
          id: true,
          tableNo: true,
          orderId: true,
          tableSessionId: true,
          waiterId: true,
        },
      },
    },
  });

  const totalCount = allFilteredItems.length;
  const completedKots = new Set(allFilteredItems.map((it) => it.kotId)).size;
  const completedOrders = new Set(allFilteredItems.map((it) => it.kot?.orderId).filter(Boolean)).size;
  const completedTables = new Set(allFilteredItems.map((it) => it.kot?.tableNo).filter(Boolean)).size;

  const summary = {
    totalServedItems: totalCount,
    totalServedKots: completedKots,
    totalServedOrders: completedOrders,
    totalServedTables: completedTables,
  };

  // Pagination calculation
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const rawItems = await prisma.kitchenOrderTicketItem.findMany({
    where,
    include: {
      kot: {
        select: {
          id: true,
          kotNo: true,
          tableNo: true,
          status: true,
          priority: true,
          waiterId: true,
          waiterName: true,
          tableSessionId: true,
          createdAt: true,
          updatedAt: true,
          restaurantId: true,
          orderId: true,
          order: {
            select: {
              id: true,
              orderNo: true,
              orderSource: true,
              fulfillment: true,
              customerName: true,
              tableSessionId: true,
            },
          },
        },
      },
    },
    orderBy: [
      { kot: { updatedAt: "desc" } },
      { id: "desc" },
    ],
    skip,
    take: parsedLimit,
  });

  const totalPages = Math.ceil(totalCount / parsedLimit) || 1;
  const hasMore = parsedPage < totalPages;

  const now = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(yesterdayDate);

  const formattedItems = rawItems.map((it) => {
    const servedDate = it.kot?.updatedAt || it.readyAt || it.createdAt;
    const sDate = new Date(servedDate);
    const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(sDate);

    let dateHeading = "";
    const fullDateText = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(sDate);

    if (dateKey === todayKey) {
      dateHeading = `TODAY • ${fullDateText}`;
    } else if (dateKey === yesterdayKey) {
      dateHeading = `YESTERDAY • ${fullDateText}`;
    } else {
      dateHeading = fullDateText;
    }

    const servedTime = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(sDate);

    return {
      id: it.id,
      orderItemId: it.orderItemId,
      kotItemId: it.id,
      menuItemId: it.menuItemId,
      orderId: it.kot?.orderId || it.kot?.order?.id,
      orderNo: it.kot?.order?.orderNo,
      orderType: it.kot?.order?.fulfillment || it.kot?.order?.orderSource || "DINE_IN",
      orderSource: it.kot?.order?.orderSource || "DINE_IN",
      kotId: it.kotId,
      kotNumber: it.kot?.kotNo || String(it.kotId),
      kotNo: it.kot?.kotNo || String(it.kotId),
      tableNo: it.kot?.tableNo || "N/A",
      tableSessionId: it.kot?.tableSessionId || it.kot?.order?.tableSessionId || null,
      name: it.itemName,
      itemName: it.itemName,
      quantity: it.qty,
      qty: it.qty,
      variantName: it.variantName,
      selectedModifiers: it.selectedModifiers,
      notes: it.notes,
      status: "SERVED",
      priority: it.kot?.priority || "NORMAL",
      chefName: it.assignedChefName || it.preparedByName || null,
      waiterName: it.kot?.waiterName || it.kot?.order?.customerName || null,
      serverName: it.kot?.waiterName || it.kot?.order?.customerName || null,
      completedTime: servedTime,
      servedTime,
      dateKey,
      dateHeading,
      servedAt: sDate.toISOString(),
      readyAt: it.readyAt ? new Date(it.readyAt).toISOString() : null,
      startedAt: it.startedAt ? new Date(it.startedAt).toISOString() : null,
      createdAt: new Date(it.createdAt).toISOString(),
    };
  });

  const groupMap = new Map();
  for (const it of formattedItems) {
    if (!groupMap.has(it.dateKey)) {
      groupMap.set(it.dateKey, {
        dateKey: it.dateKey,
        dateHeading: it.dateHeading,
        items: [],
      });
    }
    groupMap.get(it.dateKey).items.push(it);
  }

  const groupedByDate = Array.from(groupMap.values());

  return {
    ok: true,
    success: true,
    items: formattedItems,
    groupedByDate,
    summary,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      totalCount,
      totalPages,
      hasMore,
    },
    timezone: tz,
  };
};

