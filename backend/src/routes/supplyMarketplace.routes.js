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

    // GOODS RECEIPT NOTE (GRN) HANDLERS
    const listGoodsReceiptsHandler = async (req, reply) => {
        try {
            const restaurantId = req.user?.restaurantId || req.query?.restaurantId || 1;
            const grns = await prisma.goodsReceiptNote.findMany({
                where: { restaurantId: Number(restaurantId) },
                include: {
                    supplyOrder: true,
                    supplier: { include: { profile: true } },
                    receivedBy: { select: { id: true, name: true, role: true } },
                    items: { include: { rawMaterial: true } },
                },
                orderBy: { createdAt: "desc" },
            });

            const todayStr = new Date().toISOString().split("T")[0];
            const metrics = {
                expectedToday: grns.filter((g) => new Date(g.receivedDate).toISOString().split("T")[0] === todayStr).length,
                pending: grns.filter((g) => g.status === "PENDING").length,
                partiallyReceived: grns.filter((g) => g.status === "PARTIALLY_RECEIVED").length,
                receivedToday: grns.filter((g) => (g.status === "FULLY_RECEIVED" || g.status === "PARTIALLY_RECEIVED") && new Date(g.createdAt).toISOString().split("T")[0] === todayStr).length,
                rejected: grns.filter((g) => g.status === "REJECTED" || g.totalRejectedQty > 0).length,
                total: grns.length,
            };

            return reply.code(200).send({ grns, metrics });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch Goods Receipt Notes" });
        }
    };

    const createGoodsReceiptHandler = async (req, reply) => {
        try {
            const restaurantId = req.user?.restaurantId || req.body?.restaurantId || 1;
            const receivedById = req.user?.id || req.body?.receivedById || null;

            const {
                supplyOrderId,
                supplierId,
                deliveryReference,
                invoiceNumber,
                receivedDate,
                notes,
                items = [],
            } = req.body || {};

            if (!items.length) {
                return reply.code(400).send({ error: "At least one item is required for Goods Receiving" });
            }

            const count = await prisma.goodsReceiptNote.count({ where: { restaurantId: Number(restaurantId) } });
            const grnNumber = `GRN-${new Date().getFullYear()}-${1000 + count + 1}`;

            let totalExpectedQty = 0;
            let totalReceivedQty = 0;
            let totalDamagedQty = 0;
            let totalRejectedQty = 0;

            const formattedItems = items.map((item) => {
                const exp = Number(item.expectedQty || 0);
                const rec = Number(item.receivedQty || 0);
                const dam = Number(item.damagedQty || 0);
                const rej = Number(item.rejectedQty || 0);
                const diff = exp - rec;

                totalExpectedQty += exp;
                totalReceivedQty += rec;
                totalDamagedQty += dam;
                totalRejectedQty += rej;

                return {
                    rawMaterialId: item.rawMaterialId ? Number(item.rawMaterialId) : null,
                    itemName: String(item.itemName || "Item"),
                    unit: String(item.unit || "kg"),
                    expectedQty: exp,
                    receivedQty: rec,
                    damagedQty: dam,
                    rejectedQty: rej,
                    differenceQty: diff,
                    batchNumber: item.batchNumber ? String(item.batchNumber) : null,
                    expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                    storageLocation: item.storageLocation ? String(item.storageLocation) : "Main Kitchen",
                    notes: item.notes ? String(item.notes) : null,
                };
            });

            const differenceQty = totalExpectedQty - totalReceivedQty;

            let grnStatus = "FULLY_RECEIVED";
            if (totalReceivedQty === 0 && totalRejectedQty > 0) {
                grnStatus = "REJECTED";
            } else if (totalReceivedQty < totalExpectedQty) {
                grnStatus = "PARTIALLY_RECEIVED";
            }

            const grn = await prisma.goodsReceiptNote.create({
                data: {
                    grnNumber,
                    restaurantId: Number(restaurantId),
                    supplyOrderId: supplyOrderId ? Number(supplyOrderId) : null,
                    supplierId: supplierId ? Number(supplierId) : null,
                    receivedById: receivedById ? Number(receivedById) : null,
                    deliveryReference: deliveryReference ? String(deliveryReference) : null,
                    invoiceNumber: invoiceNumber ? String(invoiceNumber) : null,
                    totalExpectedQty,
                    totalReceivedQty,
                    totalDamagedQty,
                    totalRejectedQty,
                    differenceQty,
                    status: grnStatus,
                    receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
                    notes: notes ? String(notes) : null,
                    items: {
                        create: formattedItems,
                    },
                },
                include: {
                    supplyOrder: true,
                    supplier: { include: { profile: true } },
                    receivedBy: { select: { id: true, name: true, role: true } },
                    items: { include: { rawMaterial: true } },
                },
            });

            // CRITICAL INVENTORY UPDATE: Increase inventory strictly by actual accepted quantity (totalReceivedQty)
            for (const item of items) {
                const acceptedQty = Number(item.receivedQty || 0);
                if (acceptedQty <= 0) continue;

                let mat = null;
                if (item.rawMaterialId) {
                    mat = await prisma.rawMaterial.findUnique({ where: { id: Number(item.rawMaterialId) } });
                } else if (item.itemName) {
                    mat = await prisma.rawMaterial.findFirst({
                        where: { restaurantId: Number(restaurantId), name: { equals: String(item.itemName), mode: "insensitive" } },
                    });
                }

                if (mat) {
                    const beforeBalance = mat.currentStock;
                    const afterBalance = beforeBalance + acceptedQty;

                    await prisma.rawMaterial.update({
                        where: { id: mat.id },
                        data: { currentStock: afterBalance },
                    });

                    await prisma.stockMovement.create({
                        data: {
                            restaurantId: Number(restaurantId),
                            rawMaterialId: mat.id,
                            movementType: "PURCHASE",
                            quantity: acceptedQty,
                            beforeBalance,
                            afterBalance,
                            reference: grnNumber,
                            notes: `GRN Receipt #${grnNumber}: Accepted ${acceptedQty} ${item.unit || "kg"} (Ordered ${item.expectedQty || acceptedQty}, Shortage ${item.expectedQty - acceptedQty})`,
                        },
                    });
                }
            }

            // Update SupplyOrder status if linked
            if (supplyOrderId) {
                await prisma.supplyOrder.update({
                    where: { id: Number(supplyOrderId) },
                    data: {
                        receivingStatus: grnStatus,
                        status: grnStatus === "FULLY_RECEIVED" ? "COMPLETED" : "PARTIALLY_RECEIVED",
                    },
                });
            }

            return reply.code(201).send({
                message: `Auditable Goods Receipt Note ${grnNumber} created successfully! Inventory updated.`,
                grn,
            });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to create Goods Receipt Note" });
        }
    };

    // PURCHASE RETURNS HANDLERS
    const listPurchaseReturnsHandler = async (req, reply) => {
        try {
            const restaurantId = req.user?.restaurantId || req.query?.restaurantId || 1;
            const returns = await prisma.purchaseReturn.findMany({
                where: { restaurantId: Number(restaurantId) },
                include: {
                    supplier: { include: { profile: true } },
                    supplyOrder: true,
                    grn: true,
                    rawMaterial: true,
                    createdBy: { select: { id: true, name: true, role: true } },
                },
                orderBy: { createdAt: "desc" },
            });

            const metrics = {
                pending: returns.filter((r) => r.status === "PENDING" || r.status === "DRAFT").length,
                approved: returns.filter((r) => r.status === "APPROVED").length,
                returned: returns.filter((r) => r.status === "RETURNED" || r.status === "COMPLETED").length,
                replacementPending: returns.filter(
                    (r) => r.resolution === "REPLACEMENT" && r.status !== "COMPLETED" && r.status !== "REJECTED"
                ).length,
                refundPending: returns.filter(
                    (r) => r.resolution === "REFUND" && r.status !== "COMPLETED" && r.status !== "REJECTED"
                ).length,
                total: returns.length,
            };

            return reply.code(200).send({ returns, metrics });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch Purchase Returns" });
        }
    };

    const createPurchaseReturnHandler = async (req, reply) => {
        try {
            const restaurantId = req.user?.restaurantId || req.body?.restaurantId || 1;
            const createdById = req.user?.id || req.body?.createdById || null;

            const {
                supplierId,
                supplyOrderId,
                grnId,
                rawMaterialId,
                itemName,
                quantity,
                unit = "kg",
                unitPrice = 0,
                reason = "Damaged",
                resolution = "REFUND",
                notes,
                attachmentUrl,
            } = req.body || {};

            if (!itemName || !quantity) {
                return reply.code(400).send({ error: "Item name and return quantity are required" });
            }

            const count = await prisma.purchaseReturn.count({ where: { restaurantId: Number(restaurantId) } });
            const returnCode = `RET-${new Date().getFullYear()}-${1000 + count + 1}`;
            const totalValue = Number(quantity) * Number(unitPrice);

            const newReturn = await prisma.purchaseReturn.create({
                data: {
                    returnCode,
                    restaurantId: Number(restaurantId),
                    supplierId: supplierId ? Number(supplierId) : null,
                    supplyOrderId: supplyOrderId ? Number(supplyOrderId) : null,
                    grnId: grnId ? Number(grnId) : null,
                    rawMaterialId: rawMaterialId ? Number(rawMaterialId) : null,
                    createdById: createdById ? Number(createdById) : null,
                    itemName: String(itemName).trim(),
                    quantity: Number(quantity),
                    unit: String(unit),
                    unitPrice: Number(unitPrice),
                    totalValue,
                    reason: String(reason),
                    resolution: String(resolution).toUpperCase(),
                    status: "PENDING", // Stock is NOT deducted yet!
                    stockDeducted: false,
                    notes: notes ? String(notes) : null,
                    attachmentUrl: attachmentUrl ? String(attachmentUrl) : null,
                },
                include: {
                    supplier: { include: { profile: true } },
                    supplyOrder: true,
                    grn: true,
                    rawMaterial: true,
                    createdBy: { select: { id: true, name: true, role: true } },
                },
            });

            return reply.code(201).send({
                message: "Purchase Return initiated! Stock will be deducted upon confirmation.",
                purchaseReturn: newReturn,
            });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to create Purchase Return" });
        }
    };

    const updatePurchaseReturnStatusHandler = async (req, reply) => {
        try {
            const returnId = Number(req.params.id);
            const { status, notes } = req.body || {};

            const existing = await prisma.purchaseReturn.findUnique({
                where: { id: returnId },
                include: { rawMaterial: true },
            });
            if (!existing) {
                return reply.code(404).send({ error: "Purchase Return record not found" });
            }

            const targetStatus = String(status).toUpperCase();
            let stockDeducted = existing.stockDeducted;

            // CRITICAL INVENTORY RULE: Remove returned stock ONLY when confirmed/approved
            const isConfirmationStatus = ["APPROVED", "RETURNED", "COMPLETED", "REPLACEMENT_PENDING", "REFUND_PENDING"].includes(targetStatus);

            if (isConfirmationStatus && !stockDeducted) {
                let mat = existing.rawMaterial;
                if (!mat && existing.itemName) {
                    mat = await prisma.rawMaterial.findFirst({
                        where: { restaurantId: existing.restaurantId, name: { equals: existing.itemName, mode: "insensitive" } },
                    });
                }

                if (mat) {
                    const beforeBalance = mat.currentStock;
                    const afterBalance = Math.max(0, beforeBalance - existing.quantity);

                    await prisma.rawMaterial.update({
                        where: { id: mat.id },
                        data: { currentStock: afterBalance },
                    });

                    await prisma.stockMovement.create({
                        data: {
                            restaurantId: existing.restaurantId,
                            rawMaterialId: mat.id,
                            movementType: "RETURN",
                            quantity: -existing.quantity,
                            beforeBalance,
                            afterBalance,
                            reference: existing.returnCode,
                            notes: `Purchase Return #${existing.returnCode}: Deducted ${existing.quantity} ${existing.unit} due to ${existing.reason}.`,
                        },
                    });

                    stockDeducted = true;
                }
            }

            const updated = await prisma.purchaseReturn.update({
                where: { id: returnId },
                data: {
                    status: targetStatus,
                    stockDeducted,
                    notes: notes ? String(notes) : existing.notes,
                },
                include: {
                    supplier: { include: { profile: true } },
                    supplyOrder: true,
                    grn: true,
                    rawMaterial: true,
                    createdBy: { select: { id: true, name: true, role: true } },
                },
            });

            return reply.code(200).send({
                message: `Purchase Return status updated to ${targetStatus}${stockDeducted ? " (Returned inventory deducted)" : ""}`,
                purchaseReturn: updated,
            });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to update Purchase Return status" });
        }
    };

    const listPurchaseInvoicesHandler = async (req, reply) => {
        try {
            const restaurantId = getRestaurantId(req);

            const now = new Date();
            await prisma.purchaseInvoice.updateMany({
                where: {
                    restaurantId,
                    status: { in: ["UNPAID", "PARTIALLY_PAID"] },
                    dueDate: { lt: now },
                },
                data: { status: "OVERDUE" },
            });

            const invoices = await prisma.purchaseInvoice.findMany({
                where: { restaurantId },
                include: {
                    supplier: { include: { profile: true } },
                    supplyOrder: true,
                    grn: true,
                    createdBy: { select: { id: true, name: true, role: true } },
                    items: { include: { rawMaterial: true } },
                    payments: {
                        include: { recordedBy: { select: { id: true, name: true } } },
                        orderBy: { paymentDate: "desc" },
                    },
                },
                orderBy: { invoiceDate: "desc" },
            });

            let totalPurchases = 0;
            let unpaidCount = 0;
            let partiallyPaidCount = 0;
            let paidCount = 0;
            let overdueCount = 0;
            let totalUnpaidAmount = 0;
            let totalPaidAmount = 0;
            let totalBalanceAmount = 0;

            invoices.forEach((inv) => {
                totalPurchases += inv.totalAmount || 0;
                totalPaidAmount += inv.paidAmount || 0;
                totalBalanceAmount += inv.balance || 0;

                const st = String(inv.status).toUpperCase();
                if (st === "UNPAID") unpaidCount++;
                else if (st === "PARTIALLY_PAID") partiallyPaidCount++;
                else if (st === "PAID") paidCount++;
                else if (st === "OVERDUE") overdueCount++;

                if (["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(st)) {
                    totalUnpaidAmount += inv.balance || 0;
                }
            });

            return reply.code(200).send({
                invoices,
                metrics: {
                    totalInvoices: invoices.length,
                    totalPurchases,
                    unpaidCount,
                    partiallyPaidCount,
                    paidCount,
                    overdueCount,
                    totalUnpaidAmount,
                    totalPaidAmount,
                    totalBalanceAmount,
                },
            });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to list purchase invoices" });
        }
    };

    const createPurchaseInvoiceHandler = async (req, reply) => {
        try {
            const restaurantId = getRestaurantId(req);
            const createdById = req.user?.id || null;
            const {
                supplierId,
                supplyOrderId,
                grnId,
                vendorInvoiceNo,
                invoiceDate,
                dueDate,
                paymentTerms,
                gstin,
                notes,
                items = [],
                discount = 0,
            } = req.body || {};

            const rand = Math.floor(1000 + Math.random() * 9000);
            const invoiceNumber = `INV-${new Date().toISOString().slice(0, 7).replace("-", "")}-${rand}`;

            let subtotal = 0;
            let totalTax = 0;

            const parsedItems = items.map((it) => {
                const qty = Number(it.quantity || 0);
                const rate = Number(it.unitPrice || 0);
                const itemSubtotal = qty * rate;
                const taxRate = Number(it.taxRate || 0);
                const taxAmount = (itemSubtotal * taxRate) / 100;
                const itemTotal = itemSubtotal + taxAmount;

                subtotal += itemSubtotal;
                totalTax += taxAmount;

                return {
                    rawMaterialId: it.rawMaterialId ? Number(it.rawMaterialId) : null,
                    itemName: it.itemName ? String(it.itemName) : "Raw Material",
                    quantity: qty,
                    unit: it.unit || "kg",
                    unitPrice: rate,
                    taxRate,
                    taxAmount,
                    subtotal: itemSubtotal,
                    total: itemTotal,
                };
            });

            const discountVal = Number(discount || 0);
            const totalAmount = Math.max(0, subtotal + totalTax - discountVal);

            const invDate = invoiceDate ? new Date(invoiceDate) : new Date();
            const due = dueDate ? new Date(dueDate) : new Date(invDate.getTime() + 30 * 24 * 60 * 60 * 1000);

            const isOverdue = due < new Date();
            const status = isOverdue ? "OVERDUE" : "UNPAID";

            const newInvoice = await prisma.purchaseInvoice.create({
                data: {
                    invoiceNumber,
                    vendorInvoiceNo: vendorInvoiceNo ? String(vendorInvoiceNo) : null,
                    restaurantId,
                    supplierId: supplierId ? Number(supplierId) : null,
                    supplyOrderId: supplyOrderId ? Number(supplyOrderId) : null,
                    grnId: grnId ? Number(grnId) : null,
                    createdById,
                    invoiceDate: invDate,
                    dueDate: due,
                    paymentTerms: paymentTerms ? String(paymentTerms) : "Net 30",
                    gstin: gstin ? String(gstin) : null,
                    notes: notes ? String(notes) : null,
                    subtotal,
                    taxAmount: totalTax,
                    discount: discountVal,
                    totalAmount,
                    paidAmount: 0,
                    balance: totalAmount,
                    status,
                    items: {
                        create: parsedItems,
                    },
                },
                include: {
                    supplier: { include: { profile: true } },
                    supplyOrder: true,
                    grn: true,
                    createdBy: { select: { id: true, name: true, role: true } },
                    items: true,
                    payments: true,
                },
            });

            return reply.code(201).send({
                message: "Purchase Invoice created successfully",
                purchaseInvoice: newInvoice,
            });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to create Purchase Invoice" });
        }
    };

    const recordSupplierPaymentHandler = async (req, reply) => {
        try {
            const restaurantId = getRestaurantId(req);
            const recordedById = req.user?.id || null;
            const invoiceId = Number(req.params.id);
            const { amount, paymentMethod, referenceNo, paymentDate, notes } = req.body || {};

            const existingInv = await prisma.purchaseInvoice.findUnique({
                where: { id: invoiceId },
                include: { supplier: true },
            });

            if (!existingInv) {
                return reply.code(404).send({ error: "Purchase Invoice not found" });
            }

            const payAmount = Number(amount || 0);
            if (payAmount <= 0) {
                return reply.code(400).send({ error: "Payment amount must be greater than zero" });
            }

            const rand = Math.floor(1000 + Math.random() * 9000);
            const paymentCode = `PAY-${new Date().toISOString().slice(0, 7).replace("-", "")}-${rand}`;

            const newPayment = await prisma.supplierPayment.create({
                data: {
                    paymentCode,
                    restaurantId,
                    invoiceId: existingInv.id,
                    supplierId: existingInv.supplierId,
                    recordedById,
                    paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
                    amount: payAmount,
                    paymentMethod: paymentMethod ? String(paymentMethod).toUpperCase() : "BANK_TRANSFER",
                    referenceNo: referenceNo ? String(referenceNo) : null,
                    notes: notes ? String(notes) : null,
                },
                include: {
                    recordedBy: { select: { id: true, name: true, role: true } },
                },
            });

            const newPaidAmount = (existingInv.paidAmount || 0) + payAmount;
            const newBalance = Math.max(0, existingInv.totalAmount - newPaidAmount);

            let newStatus = existingInv.status;
            if (newBalance <= 0) {
                newStatus = "PAID";
            } else if (newPaidAmount > 0) {
                newStatus = "PARTIALLY_PAID";
            }

            const updatedInvoice = await prisma.purchaseInvoice.update({
                where: { id: existingInv.id },
                data: {
                    paidAmount: newPaidAmount,
                    balance: newBalance,
                    status: newStatus,
                },
                include: {
                    supplier: { include: { profile: true } },
                    items: true,
                    payments: {
                        include: { recordedBy: { select: { id: true, name: true } } },
                        orderBy: { paymentDate: "desc" },
                    },
                },
            });

            return reply.code(200).send({
                message: `Payment of ₹${payAmount.toFixed(2)} recorded successfully! Invoice status updated to ${newStatus}.`,
                payment: newPayment,
                invoice: updatedInvoice,
            });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to record payment" });
        }
    };

    const listStorageLocationsHandler = async (req, reply) => {
        try {
            const restaurantId = getRestaurantId(req);

            const defaultLocations = [
                { name: "Main Store", code: "LOC-MAIN", type: "DRY", isDefault: true, description: "Primary central inventory warehouse", temperature: "Ambient (20-25°C)" },
                { name: "Cold Storage", code: "LOC-COLD", type: "COLD", isDefault: false, description: "Chilled dairy, produce & fresh ingredients", temperature: "2°C to 8°C" },
                { name: "Freezer", code: "LOC-FREEZER", type: "FREEZER", isDefault: false, description: "Frozen meats, seafood & frozen items", temperature: "-18°C" },
                { name: "Dry Storage", code: "LOC-DRY", type: "DRY", isDefault: false, description: "Grains, pulses, flours, spices & canned goods", temperature: "Ambient (20-25°C)" },
                { name: "Beverage Store", code: "LOC-BEVERAGE", type: "BEVERAGE", isDefault: false, description: "Syrups, squashes, coffee beans, tea leaves & sodas", temperature: "Ambient (18-22°C)" },
                { name: "Packaging Store", code: "LOC-PACKAGING", type: "PACKAGING", isDefault: false, description: "Takeaway containers, cups, bags, boxes & cutlery", temperature: "Dry Ambient" },
            ];

            for (const loc of defaultLocations) {
                await prisma.storageLocation.upsert({
                    where: { restaurantId_name: { restaurantId, name: loc.name } },
                    update: {},
                    create: {
                        restaurantId,
                        name: loc.name,
                        code: `${loc.code}-${restaurantId}`,
                        type: loc.type,
                        description: loc.description,
                        temperature: loc.temperature,
                        isDefault: loc.isDefault,
                    },
                });
            }

            const rawMaterials = await prisma.rawMaterial.findMany({ where: { restaurantId, isActive: true } });
            const locations = await prisma.storageLocation.findMany({ where: { restaurantId, isActive: true } });

            const mainStoreLoc = locations.find((l) => l.name === "Main Store") || locations[0];

            if (mainStoreLoc && rawMaterials.length > 0) {
                for (const mat of rawMaterials) {
                    await prisma.rawMaterialLocation.upsert({
                        where: {
                            locationId_rawMaterialId: {
                                locationId: mainStoreLoc.id,
                                rawMaterialId: mat.id,
                            },
                        },
                        update: {},
                        create: {
                            restaurantId,
                            locationId: mainStoreLoc.id,
                            rawMaterialId: mat.id,
                            quantity: mat.currentStock || 0,
                            minStock: mat.minimumStock || 0,
                        },
                    });
                }
            }

            const allLocations = await prisma.storageLocation.findMany({
                where: { restaurantId, isActive: true },
                include: {
                    manager: { select: { id: true, name: true, role: true } },
                    items: {
                        include: {
                            rawMaterial: true,
                        },
                    },
                    sourceTransfers: {
                        include: { rawMaterial: true, toLocation: true },
                        orderBy: { createdAt: "desc" },
                        take: 10,
                    },
                    destTransfers: {
                        include: { rawMaterial: true, fromLocation: true },
                        orderBy: { createdAt: "desc" },
                        take: 10,
                    },
                },
                orderBy: { id: "asc" },
            });

            let totalStockItems = 0;
            let totalWarehouseValue = 0;
            let totalLowStockCount = 0;

            const enrichedLocations = allLocations.map((loc) => {
                let locValue = 0;
                let lowStock = 0;
                let expiringCount = 0;

                const locItems = (loc.items || []).map((it) => {
                    const mat = it.rawMaterial;
                    const qty = it.quantity || 0;
                    const cost = mat?.costPerBaseUnit || 0;
                    const val = qty * cost;

                    locValue += val;

                    if (qty <= (it.minStock || mat?.minimumStock || 0)) {
                        lowStock++;
                    }

                    return {
                        id: it.id,
                        rawMaterialId: it.rawMaterialId,
                        name: mat?.name || "Raw Material",
                        code: mat?.code || `RM-${it.rawMaterialId}`,
                        category: mat?.category || "General",
                        quantity: qty,
                        unit: mat?.displayUnit || mat?.baseUnit || "kg",
                        minStock: it.minStock || mat?.minimumStock || 0,
                        costPerUnit: cost,
                        totalValue: val,
                        rackNumber: it.rackNumber,
                        shelfNumber: it.shelfNumber,
                    };
                });

                totalStockItems += locItems.length;
                totalWarehouseValue += locValue;
                totalLowStockCount += lowStock;

                return {
                    id: loc.id,
                    code: loc.code,
                    name: loc.name,
                    type: loc.type,
                    description: loc.description,
                    temperature: loc.temperature,
                    capacityUnit: loc.capacityUnit,
                    capacityValue: loc.capacityValue,
                    isDefault: loc.isDefault,
                    manager: loc.manager,
                    metrics: {
                        stockItemsCount: locItems.length,
                        inventoryValue: locValue,
                        lowStockCount: lowStock,
                        expiringItemsCount: expiringCount,
                    },
                    items: locItems,
                    transfers: [
                        ...(loc.sourceTransfers || []).map((t) => ({ ...t, direction: "OUTGOING" })),
                        ...(loc.destTransfers || []).map((t) => ({ ...t, direction: "INCOMING" })),
                    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
                };
            });

            return reply.code(200).send({
                locations: enrichedLocations,
                summary: {
                    totalLocations: enrichedLocations.length,
                    totalStockItems,
                    totalWarehouseValue,
                    totalLowStockCount,
                },
            });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to fetch storage locations" });
        }
    };

    const createStorageLocationHandler = async (req, reply) => {
        try {
            const restaurantId = getRestaurantId(req);
            const { name, type, description, temperature, capacityValue, managerId } = req.body || {};

            if (!name) {
                return reply.code(400).send({ error: "Location name is required" });
            }

            const rand = Math.floor(1000 + Math.random() * 9000);
            const code = `LOC-${name.slice(0, 4).toUpperCase()}-${rand}`;

            const newLoc = await prisma.storageLocation.create({
                data: {
                    restaurantId,
                    code,
                    name: String(name),
                    type: type ? String(type).toUpperCase() : "DRY",
                    description: description ? String(description) : null,
                    temperature: temperature ? String(temperature) : null,
                    capacityValue: capacityValue ? Number(capacityValue) : 0,
                    managerId: managerId ? Number(managerId) : null,
                },
                include: {
                    manager: { select: { id: true, name: true, role: true } },
                },
            });

            return reply.code(201).send({
                message: "Storage location created successfully",
                location: newLoc,
            });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to create storage location" });
        }
    };

    const updateStorageLocationHandler = async (req, reply) => {
        try {
            const locId = Number(req.params.id);
            const { name, type, description, temperature, capacityValue, managerId } = req.body || {};

            const updatedLoc = await prisma.storageLocation.update({
                where: { id: locId },
                data: {
                    name: name ? String(name) : undefined,
                    type: type ? String(type).toUpperCase() : undefined,
                    description: description ? String(description) : undefined,
                    temperature: temperature ? String(temperature) : undefined,
                    capacityValue: capacityValue !== undefined ? Number(capacityValue) : undefined,
                    managerId: managerId ? Number(managerId) : undefined,
                },
                include: {
                    manager: { select: { id: true, name: true, role: true } },
                },
            });

            return reply.code(200).send({
                message: "Storage location updated successfully",
                location: updatedLoc,
            });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to update storage location" });
        }
    };

    const transferStockHandler = async (req, reply) => {
        try {
            const restaurantId = getRestaurantId(req);
            const requestedById = req.user?.id || null;
            const { fromLocationId, toLocationId, rawMaterialId, quantity, reason } = req.body || {};

            const fromLocId = Number(fromLocationId);
            const toLocId = Number(toLocationId);
            const matId = Number(rawMaterialId);
            const qty = Number(quantity || 0);

            if (fromLocId === toLocId) {
                return reply.code(400).send({ error: "Source and Destination locations must be different" });
            }
            if (qty <= 0) {
                return reply.code(400).send({ error: "Transfer quantity must be greater than zero" });
            }

            const mat = await prisma.rawMaterial.findUnique({ where: { id: matId } });
            if (!mat) {
                return reply.code(404).send({ error: "Raw Material not found" });
            }

            const sourceItem = await prisma.rawMaterialLocation.findUnique({
                where: { locationId_rawMaterialId: { locationId: fromLocId, rawMaterialId: matId } },
            });
            const sourceQty = sourceItem?.quantity || 0;
            if (sourceQty < qty) {
                return reply.code(400).send({ error: `Insufficient stock in source location. Available: ${sourceQty}` });
            }

            await prisma.rawMaterialLocation.update({
                where: { id: sourceItem.id },
                data: { quantity: Math.max(0, sourceQty - qty) },
            });

            await prisma.rawMaterialLocation.upsert({
                where: { locationId_rawMaterialId: { locationId: toLocId, rawMaterialId: matId } },
                update: { quantity: { increment: qty } },
                create: {
                    restaurantId,
                    locationId: toLocId,
                    rawMaterialId: matId,
                    quantity: qty,
                    minStock: mat.minimumStock || 0,
                },
            });

            const rand = Math.floor(1000 + Math.random() * 9000);
            const transferCode = `TRF-${new Date().toISOString().slice(0, 7).replace("-", "")}-${rand}`;

            const transfer = await prisma.stockTransfer.create({
                data: {
                    transferCode,
                    restaurantId,
                    fromLocationId: fromLocId,
                    toLocationId: toLocId,
                    rawMaterialId: matId,
                    itemName: mat.name,
                    quantity: qty,
                    unit: mat.displayUnit || mat.baseUnit || "kg",
                    reason: reason ? String(reason) : "Internal Warehouse Transfer",
                    status: "COMPLETED",
                    requestedById,
                },
                include: {
                    fromLocation: true,
                    toLocation: true,
                    rawMaterial: true,
                },
            });

            await prisma.stockMovement.create({
                data: {
                    restaurantId,
                    rawMaterialId: matId,
                    movementType: "TRANSFER",
                    quantity: 0,
                    beforeBalance: mat.currentStock,
                    afterBalance: mat.currentStock,
                    reference: transferCode,
                    notes: `Transferred ${qty} ${mat.displayUnit || mat.baseUnit || "kg"} from ${transfer.fromLocation?.name} to ${transfer.toLocation?.name}.`,
                },
            });

            return reply.code(200).send({
                message: `Stock transfer of ${qty} ${mat.name} completed successfully!`,
                transfer,
            });
        } catch (err) {
            return reply.code(500).send({ error: err.message || "Failed to execute stock transfer" });
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

    // GOODS RECEIVING / GRN ROUTES
    app.get("/owner/goods-receipts", { preHandler: [authUser] }, listGoodsReceiptsHandler);
    app.get("/api/owner/goods-receipts", { preHandler: [authUser] }, listGoodsReceiptsHandler);
    app.get("/api/v1/owner/goods-receipts", { preHandler: [authUser] }, listGoodsReceiptsHandler);

    app.post("/owner/goods-receipts", { preHandler: [authUser] }, createGoodsReceiptHandler);
    app.post("/api/owner/goods-receipts", { preHandler: [authUser] }, createGoodsReceiptHandler);
    app.post("/api/v1/owner/goods-receipts", { preHandler: [authUser] }, createGoodsReceiptHandler);

    // PURCHASE RETURNS ROUTES
    app.get("/owner/purchase-returns", { preHandler: [authUser] }, listPurchaseReturnsHandler);
    app.get("/api/owner/purchase-returns", { preHandler: [authUser] }, listPurchaseReturnsHandler);
    app.get("/api/v1/owner/purchase-returns", { preHandler: [authUser] }, listPurchaseReturnsHandler);

    app.post("/owner/purchase-returns", { preHandler: [authUser] }, createPurchaseReturnHandler);
    app.post("/api/owner/purchase-returns", { preHandler: [authUser] }, createPurchaseReturnHandler);
    app.post("/api/v1/owner/purchase-returns", { preHandler: [authUser] }, createPurchaseReturnHandler);

    app.put("/owner/purchase-returns/:id/status", { preHandler: [authUser] }, updatePurchaseReturnStatusHandler);
    app.put("/api/owner/purchase-returns/:id/status", { preHandler: [authUser] }, updatePurchaseReturnStatusHandler);
    app.put("/api/v1/owner/purchase-returns/:id/status", { preHandler: [authUser] }, updatePurchaseReturnStatusHandler);

    // PURCHASE INVOICES & PAYMENTS ROUTES
    app.get("/owner/purchase-invoices", { preHandler: [authUser] }, listPurchaseInvoicesHandler);
    app.get("/api/owner/purchase-invoices", { preHandler: [authUser] }, listPurchaseInvoicesHandler);
    app.get("/api/v1/owner/purchase-invoices", { preHandler: [authUser] }, listPurchaseInvoicesHandler);

    app.post("/owner/purchase-invoices", { preHandler: [authUser] }, createPurchaseInvoiceHandler);
    app.post("/api/owner/purchase-invoices", { preHandler: [authUser] }, createPurchaseInvoiceHandler);
    app.post("/api/v1/owner/purchase-invoices", { preHandler: [authUser] }, createPurchaseInvoiceHandler);

    app.post("/owner/purchase-invoices/:id/payments", { preHandler: [authUser] }, recordSupplierPaymentHandler);
    app.post("/api/owner/purchase-invoices/:id/payments", { preHandler: [authUser] }, recordSupplierPaymentHandler);
    app.post("/api/v1/owner/purchase-invoices/:id/payments", { preHandler: [authUser] }, recordSupplierPaymentHandler);

    // WAREHOUSE & STORAGE LOCATION ROUTES
    app.get("/owner/storage-locations", { preHandler: [authUser] }, listStorageLocationsHandler);
    app.get("/api/owner/storage-locations", { preHandler: [authUser] }, listStorageLocationsHandler);
    app.get("/api/v1/owner/storage-locations", { preHandler: [authUser] }, listStorageLocationsHandler);

    app.post("/owner/storage-locations", { preHandler: [authUser] }, createStorageLocationHandler);
    app.post("/api/owner/storage-locations", { preHandler: [authUser] }, createStorageLocationHandler);
    app.post("/api/v1/owner/storage-locations", { preHandler: [authUser] }, createStorageLocationHandler);

    app.put("/owner/storage-locations/:id", { preHandler: [authUser] }, updateStorageLocationHandler);
    app.put("/api/owner/storage-locations/:id", { preHandler: [authUser] }, updateStorageLocationHandler);
    app.put("/api/v1/owner/storage-locations/:id", { preHandler: [authUser] }, updateStorageLocationHandler);

    app.post("/owner/stock-transfers", { preHandler: [authUser] }, transferStockHandler);
    app.post("/api/owner/stock-transfers", { preHandler: [authUser] }, transferStockHandler);
    app.post("/api/v1/owner/stock-transfers", { preHandler: [authUser] }, transferStockHandler);

    app.post("/supplier/orders/:id/accept", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "ACCEPTED"));
    app.post("/supplier/orders/:id/dispatch", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "DISPATCHED"));
    app.post("/supplier/orders/:id/complete", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "COMPLETED"));
    app.post("/supplier/orders/:id/reject", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "REJECTED"));
}




