import {
    browseMarketplaceProducts,
    getSupplyCart,
    updateSupplyCartItem,
    placeSupplyOrder,
    updateSupplyOrderStatus,
} from "../services/supplyMarketplaceService.js";
import authorizeRoles from "../middleware/rbacGuard.js";
import prisma from "../prisma.js";

export default async function supplyMarketplaceRoutes(app) {
    const authUser = authorizeRoles("OWNER", "MANAGER", "SUPER_ADMIN", "SUPPLIER", "ADMIN", "STAFF", "USER", "CUSTOMER");
    const authSupplier = authorizeRoles("SUPPLIER", "SUPER_ADMIN", "OWNER", "MANAGER", "ADMIN", "STAFF", "USER");

    const browseProductsHandler = async (req, reply) => {
        try {
            const result = await browseMarketplaceProducts(req.query || {});
            return reply.code(200).send(result);
        } catch (err) {
            return reply.code(500).send({ error: "Failed to browse marketplace products" });
        }
    };

    const getCartHandler = async (req, reply) => {
        try {
            const restaurantId = req.user?.restaurantId || req.query?.restaurantId || 1;
            const cart = await getSupplyCart(restaurantId);
            return reply.code(200).send(cart);
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to fetch supply cart" });
        }
    };

    const updateCartItemHandler = async (req, reply) => {
        try {
            const restaurantId = req.user?.restaurantId || req.body?.restaurantId || 1;
            const targetId = req.params?.id || req.body?.productId || req.body?.id;
            const quantity = req.body?.quantity !== undefined ? req.body.quantity : 1;
            const cart = await updateSupplyCartItem(restaurantId, targetId, quantity);
            return reply.code(200).send(cart);
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to update cart" });
        }
    };

    const removeCartItemHandler = async (req, reply) => {
        try {
            const restaurantId = req.user?.restaurantId || req.body?.restaurantId || req.query?.restaurantId || 1;
            const targetId = req.params?.id || req.body?.productId || req.body?.id;
            const cart = await updateSupplyCartItem(restaurantId, targetId, 0);
            return reply.code(200).send(cart);
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to remove item from cart" });
        }
    };

    const placeOrderHandler = async (req, reply) => {
        try {
            const restaurantId = req.user?.restaurantId || req.body?.restaurantId || 1;
            const result = await placeSupplyOrder(restaurantId, req.body || {});
            return reply.code(201).send(result);
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to place supply order" });
        }
    };

    const listRestaurantOrdersHandler = async (req, reply) => {
        try {
            const restaurantId = req.user?.restaurantId || req.query?.restaurantId || 1;
            const orders = await prisma.supplyOrder.findMany({
                where: { restaurantId: Number(restaurantId) },
                include: {
                    supplier: { include: { profile: true } },
                    items: true,
                    statusEvents: { orderBy: { createdAt: "desc" } },
                },
                orderBy: { createdAt: "desc" },
            });

            return reply.code(200).send({ orders });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch supply orders" });
        }
    };

    const listSuppliersForOwnerHandler = async (req, reply) => {
        try {
            const suppliers = await prisma.supplier.findMany({
                include: {
                    profile: true,
                    addresses: true,
                    products: { where: { isAvailable: true } },
                    orders: { include: { items: true } },
                    _count: { select: { products: true, orders: true } },
                },
                orderBy: { createdAt: "desc" },
            });

            return reply.code(200).send({ suppliers });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch suppliers" });
        }
    };

    const listSupplierOrdersHandler = async (req, reply) => {
        try {
            const supplierId = req.user?.supplierId || req.user?.id;
            const orders = await prisma.supplyOrder.findMany({
                where: { supplierId: Number(supplierId) },
                include: {
                    restaurant: true,
                    items: true,
                    statusEvents: { orderBy: { createdAt: "desc" } },
                },
                orderBy: { createdAt: "desc" },
            });

            return reply.code(200).send({ orders });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch supplier orders" });
        }
    };

    const updateOrderStatusHandler = async (req, reply, targetStatus) => {
        try {
            const supplierId = req.user?.supplierId || req.user?.id;
            const orderId = req.params.id;
            const { notes } = req.body || {};
            const order = await updateSupplyOrderStatus(orderId, supplierId, targetStatus, notes);
            return reply.code(200).send({ message: `Order status updated to ${targetStatus}`, order });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to update order status" });
        }
    };

    const listPurchaseRequestsHandler = async (req, reply) => {
        try {
            const restaurantId = req.user?.restaurantId || req.query?.restaurantId || 1;
            const requests = await prisma.purchaseRequest.findMany({
                where: { restaurantId: Number(restaurantId) },
                include: {
                    requestedBy: { select: { id: true, name: true, role: true, designation: true } },
                    approvedBy: { select: { id: true, name: true, role: true } },
                    rawMaterial: true,
                    supplier: { include: { profile: true } },
                },
                orderBy: { createdAt: "desc" },
            });

            const metrics = {
                pending: requests.filter((r) => r.status === "SUBMITTED" || r.status === "PENDING").length,
                approved: requests.filter((r) => r.status === "APPROVED").length,
                rejected: requests.filter((r) => r.status === "REJECTED").length,
                converted: requests.filter((r) => r.status === "CONVERTED_TO_PO").length,
                draft: requests.filter((r) => r.status === "DRAFT").length,
                total: requests.length,
            };

            return reply.code(200).send({ requests, metrics });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch purchase requests" });
        }
    };

    const createPurchaseRequestHandler = async (req, reply) => {
        try {
            const restaurantId = req.user?.restaurantId || req.body?.restaurantId || 1;
            const requestedById = req.user?.id || req.body?.requestedById || null;

            const count = await prisma.purchaseRequest.count({ where: { restaurantId: Number(restaurantId) } });
            const requestCode = `PR-${1000 + count + 1}`;

            const {
                itemName,
                category = "General",
                quantity,
                unit = "kg",
                priority = "MEDIUM",
                requiredDate,
                reason,
                rawMaterialId,
                supplierId,
                notes,
                submitImmediately = true,
            } = req.body || {};

            if (!itemName || !quantity) {
                return reply.code(400).send({ error: "Item name and quantity are required" });
            }

            const newRequest = await prisma.purchaseRequest.create({
                data: {
                    requestCode,
                    restaurantId: Number(restaurantId),
                    requestedById: requestedById ? Number(requestedById) : null,
                    rawMaterialId: rawMaterialId ? Number(rawMaterialId) : null,
                    supplierId: supplierId ? Number(supplierId) : null,
                    itemName: String(itemName).trim(),
                    category: String(category),
                    quantity: Number(quantity),
                    unit: String(unit),
                    priority: String(priority).toUpperCase(),
                    status: submitImmediately ? "SUBMITTED" : "DRAFT",
                    requiredDate: requiredDate ? new Date(requiredDate) : null,
                    reason: reason ? String(reason) : null,
                    notes: notes ? String(notes) : null,
                },
                include: {
                    requestedBy: { select: { id: true, name: true, role: true } },
                    rawMaterial: true,
                    supplier: { include: { profile: true } },
                },
            });

            return reply.code(201).send({ message: "Purchase request created successfully", request: newRequest });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to create purchase request" });
        }
    };

    const updatePurchaseRequestStatusHandler = async (req, reply) => {
        try {
            const requestId = Number(req.params.id);
            const { status, rejectionReason, notes } = req.body || {};
            const userRole = String(req.user?.role || "OWNER").toUpperCase();
            const userId = req.user?.id || null;

            const existing = await prisma.purchaseRequest.findUnique({ where: { id: requestId } });
            if (!existing) {
                return reply.code(404).send({ error: "Purchase request not found" });
            }

            const targetStatus = String(status).toUpperCase();

            // Authorization check for Approval/Rejection
            if (["APPROVED", "REJECTED"].includes(targetStatus)) {
                const isAuthorized = ["OWNER", "MANAGER", "SUPER_ADMIN", "ADMIN"].includes(userRole);
                if (!isAuthorized) {
                    return reply.code(403).send({ error: "Unauthorized. Approval or rejection requires Owner or Manager privileges." });
                }
            }

            const updateData = { status: targetStatus };
            if (targetStatus === "APPROVED") {
                updateData.approvedById = userId ? Number(userId) : null;
            }
            if (targetStatus === "REJECTED" && rejectionReason) {
                updateData.rejectionReason = String(rejectionReason);
            }
            if (notes) {
                updateData.notes = String(notes);
            }

            const updated = await prisma.purchaseRequest.update({
                where: { id: requestId },
                data: updateData,
                include: {
                    requestedBy: { select: { id: true, name: true, role: true } },
                    approvedBy: { select: { id: true, name: true, role: true } },
                    rawMaterial: true,
                    supplier: { include: { profile: true } },
                },
            });

            return reply.code(200).send({ message: `Purchase request status updated to ${targetStatus}`, request: updated });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to update purchase request status" });
        }
    };

    const convertPurchaseRequestToPOHandler = async (req, reply) => {
        try {
            const requestId = Number(req.params.id);
            const userRole = String(req.user?.role || "OWNER").toUpperCase();

            const isAuthorized = ["OWNER", "MANAGER", "SUPER_ADMIN", "ADMIN"].includes(userRole);
            if (!isAuthorized) {
                return reply.code(403).send({ error: "Unauthorized. Converting to PO requires Owner or Manager privileges." });
            }

            const pr = await prisma.purchaseRequest.findUnique({ where: { id: requestId } });
            if (!pr) {
                return reply.code(404).send({ error: "Purchase request not found" });
            }

            // Create or update supply cart item if supplier is selected
            let createdOrder = null;
            if (pr.supplierId) {
                // Pre-add to supply cart or create draft order
                const existingProduct = await prisma.supplyProduct.findFirst({
                    where: { supplierId: pr.supplierId, isAvailable: true },
                });

                if (existingProduct) {
                    await updateSupplyCartItem(pr.restaurantId, existingProduct.id, Math.ceil(pr.quantity));
                }
            }

            const updated = await prisma.purchaseRequest.update({
                where: { id: requestId },
                data: {
                    status: "CONVERTED_TO_PO",
                    convertedOrderId: createdOrder ? createdOrder.id : null,
                },
                include: {
                    requestedBy: { select: { id: true, name: true, role: true } },
                    approvedBy: { select: { id: true, name: true, role: true } },
                    rawMaterial: true,
                    supplier: { include: { profile: true } },
                },
            });

            return reply.code(200).send({
                message: "Purchase request successfully converted to Purchase Order",
                request: updated,
            });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to convert purchase request to PO" });
        }
    };

    app.get("/marketplace/products", { preHandler: [authUser] }, browseProductsHandler);
    app.get("/api/marketplace/products", { preHandler: [authUser] }, browseProductsHandler);
    app.get("/api/v1/marketplace/products", { preHandler: [authUser] }, browseProductsHandler);

    app.get("/supply-cart", { preHandler: [authUser] }, getCartHandler);
    app.get("/api/supply-cart", { preHandler: [authUser] }, getCartHandler);
    app.get("/api/v1/supply-cart", { preHandler: [authUser] }, getCartHandler);

    app.post("/supply-cart/items", { preHandler: [authUser] }, updateCartItemHandler);
    app.post("/api/supply-cart/items", { preHandler: [authUser] }, updateCartItemHandler);
    app.post("/api/v1/supply-cart/items", { preHandler: [authUser] }, updateCartItemHandler);

    app.put("/supply-cart/items", { preHandler: [authUser] }, updateCartItemHandler);
    app.put("/api/supply-cart/items", { preHandler: [authUser] }, updateCartItemHandler);
    app.put("/api/v1/supply-cart/items", { preHandler: [authUser] }, updateCartItemHandler);

    app.put("/supply-cart/items/:id", { preHandler: [authUser] }, updateCartItemHandler);
    app.put("/api/supply-cart/items/:id", { preHandler: [authUser] }, updateCartItemHandler);
    app.put("/api/v1/supply-cart/items/:id", { preHandler: [authUser] }, updateCartItemHandler);

    app.delete("/supply-cart/items", { preHandler: [authUser] }, removeCartItemHandler);
    app.delete("/api/supply-cart/items", { preHandler: [authUser] }, removeCartItemHandler);
    app.delete("/api/v1/supply-cart/items", { preHandler: [authUser] }, removeCartItemHandler);

    app.delete("/supply-cart/items/:id", { preHandler: [authUser] }, removeCartItemHandler);
    app.delete("/api/supply-cart/items/:id", { preHandler: [authUser] }, removeCartItemHandler);
    app.delete("/api/v1/supply-cart/items/:id", { preHandler: [authUser] }, removeCartItemHandler);

    app.post("/supply-orders", { preHandler: [authUser] }, placeOrderHandler);
    app.post("/api/supply-orders", { preHandler: [authUser] }, placeOrderHandler);
    app.post("/api/v1/supply-orders", { preHandler: [authUser] }, placeOrderHandler);

    app.get("/supply-orders", { preHandler: [authUser] }, listRestaurantOrdersHandler);
    app.get("/api/supply-orders", { preHandler: [authUser] }, listRestaurantOrdersHandler);
    app.get("/api/v1/supply-orders", { preHandler: [authUser] }, listRestaurantOrdersHandler);

    app.get("/supplier/orders", { preHandler: [authSupplier] }, listSupplierOrdersHandler);
    app.get("/api/supplier/orders", { preHandler: [authSupplier] }, listSupplierOrdersHandler);
    app.get("/api/v1/supplier/orders", { preHandler: [authSupplier] }, listSupplierOrdersHandler);

    app.get("/owner/suppliers", { preHandler: [authUser] }, listSuppliersForOwnerHandler);
    app.get("/api/owner/suppliers", { preHandler: [authUser] }, listSuppliersForOwnerHandler);
    app.get("/api/v1/owner/suppliers", { preHandler: [authUser] }, listSuppliersForOwnerHandler);

    // PURCHASE REQUEST ROUTES
    app.get("/owner/purchase-requests", { preHandler: [authUser] }, listPurchaseRequestsHandler);
    app.get("/api/owner/purchase-requests", { preHandler: [authUser] }, listPurchaseRequestsHandler);
    app.get("/api/v1/owner/purchase-requests", { preHandler: [authUser] }, listPurchaseRequestsHandler);

    app.post("/owner/purchase-requests", { preHandler: [authUser] }, createPurchaseRequestHandler);
    app.post("/api/owner/purchase-requests", { preHandler: [authUser] }, createPurchaseRequestHandler);
    app.post("/api/v1/owner/purchase-requests", { preHandler: [authUser] }, createPurchaseRequestHandler);

    app.put("/owner/purchase-requests/:id/status", { preHandler: [authUser] }, updatePurchaseRequestStatusHandler);
    app.put("/api/owner/purchase-requests/:id/status", { preHandler: [authUser] }, updatePurchaseRequestStatusHandler);
    app.put("/api/v1/owner/purchase-requests/:id/status", { preHandler: [authUser] }, updatePurchaseRequestStatusHandler);

    app.post("/owner/purchase-requests/:id/convert", { preHandler: [authUser] }, convertPurchaseRequestToPOHandler);
    app.post("/api/owner/purchase-requests/:id/convert", { preHandler: [authUser] }, convertPurchaseRequestToPOHandler);
    app.post("/api/v1/owner/purchase-requests/:id/convert", { preHandler: [authUser] }, convertPurchaseRequestToPOHandler);

    app.post("/supplier/orders/:id/accept", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "ACCEPTED"));
    app.post("/supplier/orders/:id/dispatch", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "DISPATCHED"));
    app.post("/supplier/orders/:id/complete", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "COMPLETED"));
    app.post("/supplier/orders/:id/reject", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "REJECTED"));
}

