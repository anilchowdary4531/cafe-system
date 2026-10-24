import {
  KitchenAssignmentError,
  getKitchenConfig,
  updateKitchenConfig,
  getKitchenWorkload,
  assignItemToChef,
  bulkAssignItems,
  assignAllKotItems,
  reassignItem,
  getChefAssignedItems,
  selfPickItem,
  selfPickKot,
  getAvailableKitchenWork,
  getChefHistory,
  getServerHistory,
} from "../services/kitchenAssignmentService.js";

const handleError = (res, err) => {
  const sendStatus = (code) => (typeof res.status === "function" ? res.status(code) : (typeof res.code === "function" ? res.code(code) : res));
  if (err instanceof KitchenAssignmentError) {
    return sendStatus(err.status).send({
      ok: false,
      success: false,
      message: err.message,
      code: err.code,
    });
  }
  console.error("[kitchenAssignmentController] Error:", err);
  return sendStatus(500).send({
    ok: false,
    success: false,
    message: err?.message || "Internal server error",
  });
};

export const getKitchenConfigController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || 0);
    const config = await getKitchenConfig({
      prisma: req.prisma,
      restaurantId,
    });
    return res.send(config);
  } catch (err) {
    return handleError(res, err);
  }
};

export const updateKitchenConfigController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || 0);
    const { mode, scope } = req.body || {};
    const actor = req.staffActor || req.user || null;

    const result = await updateKitchenConfig({
      prisma: req.prisma,
      restaurantId,
      mode,
      scope,
      actor,
      req,
      realtime: req.server?.realtime,
    });
    return res.send(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getKitchenWorkloadController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || 0);
    const workload = await getKitchenWorkload({
      prisma: req.prisma,
      restaurantId,
    });
    return res.send(workload);
  } catch (err) {
    return handleError(res, err);
  }
};

export const assignItemController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || 0);
    const itemId = Number(req.params.itemId || req.body?.itemId);
    const chefId = Number(req.body?.chefId);
    const actor = req.staffActor || req.user || null;

    const result = await assignItemToChef({
      prisma: req.prisma,
      restaurantId,
      itemId,
      chefId,
      actor,
      req,
      realtime: req.server?.realtime,
    });
    return res.send(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const bulkAssignItemsController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || 0);
    const { itemIds, chefId } = req.body || {};
    const actor = req.staffActor || req.user || null;

    const result = await bulkAssignItems({
      prisma: req.prisma,
      restaurantId,
      itemIds,
      chefId: Number(chefId),
      actor,
      req,
      realtime: req.server?.realtime,
    });
    return res.send(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const assignKotController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || 0);
    const kotId = Number(req.params.kotId || req.body?.kotId);
    const { chefId, overwriteAssigned } = req.body || {};
    const actor = req.staffActor || req.user || null;

    const result = await assignAllKotItems({
      prisma: req.prisma,
      restaurantId,
      kotId,
      chefId: Number(chefId),
      overwriteAssigned: Boolean(overwriteAssigned),
      actor,
      req,
      realtime: req.server?.realtime,
    });
    return res.send(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const reassignItemController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || 0);
    const itemId = Number(req.params.itemId || req.body?.itemId);
    const newChefId = Number(req.body?.newChefId || req.body?.chefId);
    const actor = req.staffActor || req.user || null;

    const result = await reassignItem({
      prisma: req.prisma,
      restaurantId,
      itemId,
      newChefId,
      actor,
      req,
      realtime: req.server?.realtime,
    });
    return res.send(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getChefAssignedItemsController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || 0);
    const chefId = Number(req.params.chefId);
    const requestingActor = req.staffActor || req.user || null;

    const result = await getChefAssignedItems({
      prisma: req.prisma,
      restaurantId,
      chefId,
      requestingActor,
    });
    return res.send(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const selfPickItemController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || 0);
    const itemId = Number(req.params.itemId);
    const actor = req.staffActor || req.user || null;
    const chefId = Number(actor?.userId || actor?.id || req.body?.chefId);

    const result = await selfPickItem({
      prisma: req.prisma,
      restaurantId,
      itemId,
      chefId,
      actor,
      req,
      realtime: req.server?.realtime,
    });
    return res.send(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const selfPickKotController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || 0);
    const kotId = Number(req.params.kotId);
    const actor = req.staffActor || req.user || null;
    const chefId = Number(actor?.userId || actor?.id || req.body?.chefId);

    const result = await selfPickKot({
      prisma: req.prisma,
      restaurantId,
      kotId,
      chefId,
      actor,
      req,
      realtime: req.server?.realtime,
    });
    return res.send(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getAvailableKitchenWorkController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || 0);
    const result = await getAvailableKitchenWork({
      prisma: req.prisma,
      restaurantId,
    });
    return res.send(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getChefHistoryController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || req.query?.restaurantId || 0);
    const rawChefId = req.params.chefId ?? req.query?.chefId;
    const chefId = rawChefId !== undefined && rawChefId !== null && String(rawChefId).trim() !== "" ? rawChefId : null;
    const requestingActor = req.staffActor || req.user || null;
    const { date, from, to, range, search, status, page, limit } = req.query || {};

    const result = await getChefHistory({
      prisma: req.prisma,
      restaurantId,
      chefId,
      requestingActor,
      date,
      from,
      to,
      range,
      search,
      status,
      page,
      limit,
    });
    return res.send(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getServerHistoryController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || req.query?.restaurantId || 0);
    const rawServerId = req.params.serverId ?? req.query?.serverId;
    const serverId = rawServerId !== undefined && rawServerId !== null && String(rawServerId).trim() !== "" ? rawServerId : null;
    const requestingActor = req.staffActor || req.user || null;
    const { date, from, to, range, search, status, page, limit } = req.query || {};

    const result = await getServerHistory({
      prisma: req.prisma,
      restaurantId,
      serverId,
      requestingActor,
      date,
      from,
      to,
      range,
      search,
      status,
      page,
      limit,
    });
    return res.send(result);
  } catch (err) {
    return handleError(res, err);
  }
};

