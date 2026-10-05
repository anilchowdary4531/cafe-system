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

            let createdOrder = null;
            if (pr.supplierId) {
                const count = await prisma.supplyOrder.count({ where: { restaurantId: pr.restaurantId } });
                const orderNo = `PO-${new Date().getFullYear()}-${1000 + count + 1}`;

                createdOrder = await prisma.supplyOrder.create({
                    data: {
                        orderNo,
                        restaurantId: pr.restaurantId,
                        supplierId: pr.supplierId,
                        subtotal: pr.quantity * 100,
                        totalAmount: pr.quantity * 100,
                        status: "DRAFT",
                        receivingStatus: "PENDING",
                        paymentStatus: "PENDING",
                        notes: `Converted from Purchase Request #${pr.requestCode}`,
                        items: {
                            create: [
                                {
                                    productName: pr.itemName,
                                    quantity: pr.quantity,
                                    unit: pr.unit,
                                    unitPrice: 100,
                                    totalPrice: pr.quantity * 100,
                                },
                            ],
                        },
                    },
                });
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
                order: createdOrder,
            });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to convert purchase request to PO" });
        }
    };

    // PURCHASE ORDER MANAGEMENT HANDLERS
    const listPurchaseOrdersHandler = async (req, reply) => {
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

            const metrics = {
                draft: orders.filter((o) => o.status === "DRAFT").length,
                pendingApproval: orders.filter((o) => o.status === "PENDING_APPROVAL").length,
                sent: orders.filter((o) => o.status === "SENT" || o.status === "PLACED").length,
                confirmed: orders.filter((o) => o.status === "CONFIRMED" || o.status === "ACCEPTED").length,
                partiallyReceived: orders.filter(
                    (o) => o.receivingStatus === "PARTIALLY_RECEIVED" || o.status === "PARTIALLY_RECEIVED"
                ).length,
                completed: orders.filter(
                    (o) => o.status === "COMPLETED" || o.status === "DELIVERED" || o.receivingStatus === "FULLY_RECEIVED"
                ).length,
                total: orders.length,
            };

            return reply.code(200).send({ orders, metrics });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch purchase orders" });
        }
    };

    const createPurchaseOrderHandler = async (req, reply) => {
        try {
            const restaurantId = req.user?.restaurantId || req.body?.restaurantId || 1;
            const { supplierId, deliveryAddress, expectedDeliveryDate, items = [], notes, status = "DRAFT" } = req.body || {};

            if (!supplierId || !items.length) {
                return reply.code(400).send({ error: "Supplier and at least one item are required" });
            }

            const count = await prisma.supplyOrder.count({ where: { restaurantId: Number(restaurantId) } });
            const orderNo = `PO-${new Date().getFullYear()}-${1000 + count + 1}`;

            let subtotal = 0;
            let taxAmount = 0;
            let discountAmount = 0;

            const formattedItems = items.map((item) => {
                const qty = Number(item.quantity || 1);
                const rate = Number(item.unitPrice || item.rate || 0);
                const taxPct = Number(item.taxRate || item.tax || 0);
                const discPct = Number(item.discount || 0);

                const lineGross = qty * rate;
                const lineDisc = (lineGross * discPct) / 100;
                const lineNet = lineGross - lineDisc;
                const lineTax = (lineNet * taxPct) / 100;
                const lineTotal = lineNet + lineTax;

                subtotal += lineNet;
                taxAmount += lineTax;
                discountAmount += lineDisc;

                return {
                    productId: item.productId ? Number(item.productId) : null,
                    productName: String(item.productName || item.itemName || "Item"),
                    unit: String(item.unit || "pcs"),
                    quantity: qty,
                    unitPrice: rate,
                    discount: lineDisc,
                    totalPrice: lineTotal,
                };
            });

            const totalAmount = subtotal + taxAmount;

            const newPO = await prisma.supplyOrder.create({
                data: {
                    orderNo,
                    restaurantId: Number(restaurantId),
                    supplierId: Number(supplierId),
                    subtotal,
                    taxAmount,
                    discountAmount,
                    totalAmount,
                    status: String(status).toUpperCase(),
                    receivingStatus: "PENDING",
                    paymentStatus: "PENDING",
                    deliveryAddress: deliveryAddress ? String(deliveryAddress) : null,
                    expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
                    notes: notes ? String(notes) : null,
                    items: {
                        create: formattedItems,
                    },
                    statusEvents: {
                        create: [
                            {
                                status: String(status).toUpperCase(),
                                notes: `PO created as ${status}`,
                                createdRole: req.user?.role || "OWNER",
                                createdBy: req.user?.name || "User",
                            },
                        ],
                    },
                },
                include: {
                    supplier: { include: { profile: true } },
                    items: true,
                    statusEvents: true,
                },
            });

            return reply.code(201).send({ message: "Purchase Order created successfully", order: newPO });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to create Purchase Order" });
        }
    };

    const updatePOStatusHandler = async (req, reply) => {
        try {
            const orderId = Number(req.params.id);
            const { status, notes } = req.body || {};

            const existing = await prisma.supplyOrder.findUnique({ where: { id: orderId } });
            if (!existing) {
                return reply.code(404).send({ error: "Purchase Order not found" });
            }

            const targetStatus = String(status).toUpperCase();

            const updated = await prisma.supplyOrder.update({
                where: { id: orderId },
                data: {
                    status: targetStatus,
                    statusEvents: {
                        create: {
                            status: targetStatus,
                            notes: notes || `Status changed to ${targetStatus}`,
                            createdRole: req.user?.role || "OWNER",
                            createdBy: req.user?.name || "User",
                        },
                    },
                },
                include: {
                    supplier: { include: { profile: true } },
                    items: true,
                    statusEvents: { orderBy: { createdAt: "desc" } },
                },
            });

            return reply.code(200).send({ message: `PO status updated to ${targetStatus}`, order: updated });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to update PO status" });
        }
    };

    const receivePOItemsHandler = async (req, reply) => {
        try {
            const orderId = Number(req.params.id);
            const { receivingStatus = "FULLY_RECEIVED", notes } = req.body || {};

            const existing = await prisma.supplyOrder.findUnique({
                where: { id: orderId },
                include: { items: true },
            });
            if (!existing) {
                return reply.code(404).send({ error: "Purchase Order not found" });
            }

            const targetReceivingStatus = String(receivingStatus).toUpperCase();
            const poStatus = targetReceivingStatus === "FULLY_RECEIVED" ? "COMPLETED" : "PARTIALLY_RECEIVED";

            // Update inventory stock for items
            for (const item of existing.items) {
                const mat = await prisma.rawMaterial.findFirst({
                    where: { restaurantId: existing.restaurantId, name: { equals: item.productName, mode: "insensitive" } },
                });

                if (mat) {
                    await prisma.rawMaterial.update({
                        where: { id: mat.id },
                        data: { currentStock: mat.currentStock + item.quantity },
                    });

                    await prisma.stockMovement.create({
                        data: {
                            restaurantId: existing.restaurantId,
                            rawMaterialId: mat.id,
                            movementType: "PURCHASE",
                            quantity: item.quantity,
                            beforeBalance: mat.currentStock,
                            afterBalance: mat.currentStock + item.quantity,
                            reference: existing.orderNo,
                            notes: `Received from PO #${existing.orderNo}`,
                        },
                    });
                }
            }

            const updated = await prisma.supplyOrder.update({
                where: { id: orderId },
                data: {
                    receivingStatus: targetReceivingStatus,
                    status: poStatus,
                    statusEvents: {
                        create: {
                            status: poStatus,
                            notes: notes || `Goods received: ${targetReceivingStatus}`,
                            createdRole: req.user?.role || "OWNER",
                            createdBy: req.user?.name || "User",
                        },
                    },
                },
                include: {
                    supplier: { include: { profile: true } },
                    items: true,
                    statusEvents: { orderBy: { createdAt: "desc" } },
                },
            });

            return reply.code(200).send({ message: "Goods received and inventory updated!", order: updated });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to process receipt" });
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

    // PURCHASE ORDER MANAGEMENT ROUTES
    app.get("/owner/purchase-orders", { preHandler: [authUser] }, listPurchaseOrdersHandler);
    app.get("/api/owner/purchase-orders", { preHandler: [authUser] }, listPurchaseOrdersHandler);
    app.get("/api/v1/owner/purchase-orders", { preHandler: [authUser] }, listPurchaseOrdersHandler);

    app.post("/owner/purchase-orders", { preHandler: [authUser] }, createPurchaseOrderHandler);
    app.post("/api/owner/purchase-orders", { preHandler: [authUser] }, createPurchaseOrderHandler);
    app.post("/api/v1/owner/purchase-orders", { preHandler: [authUser] }, createPurchaseOrderHandler);

    app.put("/owner/purchase-orders/:id/status", { preHandler: [authUser] }, updatePOStatusHandler);
    app.put("/api/owner/purchase-orders/:id/status", { preHandler: [authUser] }, updatePOStatusHandler);
    app.put("/api/v1/owner/purchase-orders/:id/status", { preHandler: [authUser] }, updatePOStatusHandler);

    app.put("/owner/purchase-orders/:id/receive", { preHandler: [authUser] }, receivePOItemsHandler);
    app.put("/api/owner/purchase-orders/:id/receive", { preHandler: [authUser] }, receivePOItemsHandler);
    app.put("/api/v1/owner/purchase-orders/:id/receive", { preHandler: [authUser] }, receivePOItemsHandler);

    app.post("/supplier/orders/:id/accept", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "ACCEPTED"));
    app.post("/supplier/orders/:id/dispatch", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "DISPATCHED"));
    app.post("/supplier/orders/:id/complete", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "COMPLETED"));
    app.post("/supplier/orders/:id/reject", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "REJECTED"));
}


