import prisma from "../prisma.js";
import { calculateFinalPrice, getSupplierProductById } from "./supplierProductService.js";

export async function browseMarketplaceProducts(query = {}) {
    const {
        search = "",
        categoryId,
        supplierId,
        minPrice,
        maxPrice,
        page = 1,
        limit = 20,
    } = query;

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));

    const where = {
        isDeleted: false,
        status: "APPROVED",
        availability: true,
        ...(search
            ? {
                  OR: [
                      { name: { contains: String(search).trim(), mode: "insensitive" } },
                      { description: { contains: String(search).trim(), mode: "insensitive" } },
                  ],
              }
            : {}),
        ...(categoryId ? { categoryId: Number(categoryId) } : {}),
        ...(supplierId ? { supplierId: Number(supplierId) } : {}),
    };

    const products = await prisma.supplyProduct.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
            supplier: {
                include: { profile: true, addresses: true },
            },
            category: true,
            images: { orderBy: { priority: "asc" } },
            prices: { where: { isActive: true }, take: 1 },
            discounts: { where: { isActive: true }, take: 1 },
            inventory: true,
        },
        orderBy: { createdAt: "desc" },
    });

    const mapped = products.map((product) => {
        const price = product.prices[0] || { basePrice: 100, taxPercent: 5 };
        const discount = product.discounts[0] || null;
        const pricing = calculateFinalPrice(price.basePrice, price.taxPercent, discount?.type, discount?.value);

        return {
            id: product.id,
            supplierId: product.supplierId,
            supplierName: product.supplier?.profile?.businessName || "ABC Foods",
            supplierRating: product.supplier?.profile?.rating || 4.8,
            supplierCity: product.supplier?.addresses?.[0]?.city || "Main Warehouse",
            name: product.name,
            slug: product.slug,
            unit: product.unit,
            moq: product.moq,
            category: product.category?.name || "General",
            primaryImage: product.images.find((img) => img.isPrimary)?.imageUrl || product.images[0]?.imageUrl || "",
            basePrice: pricing.basePrice,
            discountPercent: discount?.type === "PERCENTAGE" ? discount.value : 0,
            finalPrice: pricing.finalPrice,
            availableStock: product.inventory?.availableStock || 0,
        };
    });

    return {
        products: mapped,
        page: Number(page),
        limit: Number(limit),
        count: mapped.length,
    };
}

export async function getSupplyCart(restaurantId) {
    const rId = Number(restaurantId);
    if (!rId) throw { statusCode: 400, message: "Invalid restaurant ID" };

    let cart = await prisma.supplyCart.findUnique({
        where: { restaurantId: rId },
        include: {
            items: {
                include: {
                    product: {
                        include: {
                            supplier: { include: { profile: true } },
                            images: true,
                            prices: { where: { isActive: true }, take: 1 },
                            discounts: { where: { isActive: true }, take: 1 },
                            inventory: true,
                        },
                    },
                },
            },
        },
    });

    if (!cart) {
        cart = await prisma.supplyCart.create({
            data: { restaurantId: rId },
            include: { items: { include: { product: true } } },
        });
    }

    const items = (cart.items || []).map((item) => {
        const prod = item.product;
        const price = prod.prices?.[0] || { basePrice: 100, taxPercent: 5 };
        const discount = prod.discounts?.[0] || null;
        const pricing = calculateFinalPrice(price.basePrice, price.taxPercent, discount?.type, discount?.value);

        return {
            id: item.id,
            productId: item.productId,
            name: prod.name,
            unit: prod.unit,
            moq: prod.moq,
            supplierId: prod.supplierId,
            supplierName: prod.supplier?.profile?.businessName || "ABC Foods",
            quantity: item.quantity,
            basePrice: pricing.basePrice,
            finalPrice: pricing.finalPrice,
            itemTotal: Number((pricing.finalPrice * item.quantity).toFixed(2)),
            availableStock: prod.inventory?.availableStock || 0,
        };
    });

    const cartTotal = items.reduce((sum, item) => sum + item.itemTotal, 0);

    return {
        cartId: cart.id,
        restaurantId: rId,
        items,
        cartTotal: Number(cartTotal.toFixed(2)),
    };
}

export async function updateSupplyCartItem(restaurantId, productId, quantity) {
    const rId = Number(restaurantId);
    const pId = Number(productId);
    const qty = Number(quantity);

    if (!rId || !pId || isNaN(qty)) throw { statusCode: 400, message: "Invalid parameters" };

    let cart = await prisma.supplyCart.findUnique({ where: { restaurantId: rId } });
    if (!cart) {
        cart = await prisma.supplyCart.create({ data: { restaurantId: rId } });
    }

    if (qty <= 0) {
        await prisma.supplyCartItem.deleteMany({
            where: { cartId: cart.id, productId: pId },
        });
    } else {
        const product = await getSupplierProductById(pId);
        if (qty < product.moq) {
            throw { statusCode: 400, message: `Minimum order quantity (MOQ) for ${product.name} is ${product.moq} ${product.unit}` };
        }
        if (qty > product.availableStock) {
            throw { statusCode: 400, message: `Requested quantity exceeds available stock (${product.availableStock} ${product.unit})` };
        }

        await prisma.supplyCartItem.upsert({
            where: { cartId_productId: { cartId: cart.id, productId: pId } },
            update: {
                quantity: qty,
                unitPrice: product.basePrice,
                discount: product.discountAmount,
                finalPrice: product.finalPrice,
            },
            create: {
                cartId: cart.id,
                productId: pId,
                quantity: qty,
                unitPrice: product.basePrice,
                discount: product.discountAmount,
                finalPrice: product.finalPrice,
            },
        });
    }

    return getSupplyCart(rId);
}

export async function placeSupplyOrder(restaurantId, { deliveryAddress, notes, paymentMode = "ONLINE" }) {
    const rId = Number(restaurantId);
    if (!rId) throw { statusCode: 400, message: "Invalid restaurant ID" };

    const cart = await getSupplyCart(rId);
    if (!cart.items || cart.items.length === 0) {
        throw { statusCode: 400, message: "Supply cart is empty" };
    }

    const createdOrders = [];

    // Group cart items by supplierId for split fulfillment
    const supplierGroups = new Map();
    for (const item of cart.items) {
        const group = supplierGroups.get(item.supplierId) || [];
        group.push(item);
        supplierGroups.set(item.supplierId, group);
    }

    for (const [supplierId, items] of supplierGroups.entries()) {
        const orderNo = `SUP-ORD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

        const order = await prisma.$transaction(async (tx) => {
            let orderSubtotal = 0;

            // 1. Verify stock availability and execute atomic stock reservation
            for (const item of items) {
                const inventory = await tx.supplyInventory.findUnique({
                    where: { productId: item.productId },
                });

                if (!inventory || inventory.availableStock < item.quantity) {
                    throw new Error(`Insufficient stock available for product ${item.name}`);
                }

                const newReserved = inventory.reservedStock + item.quantity;
                const newAvailable = inventory.totalStock - newReserved;

                await tx.supplyInventory.update({
                    where: { id: inventory.id },
                    data: {
                        reservedStock: newReserved,
                        availableStock: newAvailable,
                    },
                });

                await tx.supplyInventoryTransaction.create({
                    data: {
                        inventoryId: inventory.id,
                        type: "STOCK_RESERVE",
                        quantity: item.quantity,
                        balanceBefore: inventory.availableStock,
                        balanceAfter: newAvailable,
                        referenceType: "SUPPLY_ORDER",
                        referenceId: orderNo,
                        notes: `Reserved for Supply Order ${orderNo}`,
                    },
                });

                orderSubtotal += item.itemTotal;
            }

            // 2. Create Supply Order Record
            const createdOrder = await tx.supplyOrder.create({
                data: {
                    orderNo,
                    restaurantId: rId,
                    supplierId,
                    subtotal: orderSubtotal,
                    discountAmount: 0,
                    taxAmount: 0,
                    deliveryFee: 0,
                    totalAmount: orderSubtotal,
                    status: "PLACED",
                    paymentStatus: "PAID", // Auto-marked as PAID for prototype B2B checkout
                    paymentMode,
                    notes: notes ? String(notes).trim() : null,
                    deliveryAddress: deliveryAddress ? String(deliveryAddress).trim() : null,
                    items: {
                        create: items.map((item) => ({
                            productId: item.productId,
                            productName: item.name,
                            unit: item.unit,
                            quantity: item.quantity,
                            unitPrice: item.basePrice,
                            discount: item.basePrice - item.finalPrice,
                            totalPrice: item.itemTotal,
                        })),
                    },
                    statusEvents: {
                        create: {
                            status: "PLACED",
                            notes: "Order placed by restaurant",
                            createdRole: "RESTAURANT",
                        },
                    },
                },
                include: { items: true, statusEvents: true },
            });

            return createdOrder;
        });

        createdOrders.push(order);
    }

    // Clear cart items
    await prisma.supplyCartItem.deleteMany({
        where: { cart: { restaurantId: rId } },
    });

    return {
        message: "Supply order placed successfully",
        orders: createdOrders,
    };
}

export async function updateSupplyOrderStatus(orderId, supplierId, newStatus, notes = "") {
    const oId = Number(orderId);
    const sId = Number(supplierId);
    const status = String(newStatus).toUpperCase();

    const order = await prisma.supplyOrder.findFirst({
        where: { id: oId, ...(sId ? { supplierId: sId } : {}) },
        include: { items: true },
    });

    if (!order) throw { statusCode: 404, message: "Supply order not found" };

    const updated = await prisma.$transaction(async (tx) => {
        // If status changes to CANCELLED or REJECTED: Release reserved stock
        if ((status === "CANCELLED" || status === "REJECTED") && order.status !== "CANCELLED" && order.status !== "REJECTED") {
            for (const item of order.items) {
                if (item.productId) {
                    const inv = await tx.supplyInventory.findUnique({ where: { productId: item.productId } });
                    if (inv) {
                        const newReserved = Math.max(0, inv.reservedStock - item.quantity);
                        const newAvailable = inv.totalStock - newReserved;

                        await tx.supplyInventory.update({
                            where: { id: inv.id },
                            data: { reservedStock: newReserved, availableStock: newAvailable },
                        });

                        await tx.supplyInventoryTransaction.create({
                            data: {
                                inventoryId: inv.id,
                                type: "STOCK_RELEASE",
                                quantity: item.quantity,
                                balanceBefore: inv.availableStock,
                                balanceAfter: newAvailable,
                                referenceType: "SUPPLY_ORDER",
                                referenceId: order.orderNo,
                                notes: `Released reserved stock due to order ${status}`,
                            },
                        });
                    }
                }
            }
        }

        // If status changes to COMPLETED: Convert reserved stock to consumed stock
        if (status === "COMPLETED" && order.status !== "COMPLETED") {
            for (const item of order.items) {
                if (item.productId) {
                    const inv = await tx.supplyInventory.findUnique({ where: { productId: item.productId } });
                    if (inv) {
                        const newTotal = Math.max(0, inv.totalStock - item.quantity);
                        const newReserved = Math.max(0, inv.reservedStock - item.quantity);
                        const newAvailable = newTotal - newReserved;

                        await tx.supplyInventory.update({
                            where: { id: inv.id },
                            data: {
                                totalStock: newTotal,
                                reservedStock: newReserved,
                                availableStock: newAvailable,
                            },
                        });

                        await tx.supplyInventoryTransaction.create({
                            data: {
                                inventoryId: inv.id,
                                type: "STOCK_CONSUMED",
                                quantity: item.quantity,
                                balanceBefore: inv.availableStock,
                                balanceAfter: newAvailable,
                                referenceType: "SUPPLY_ORDER",
                                referenceId: order.orderNo,
                                notes: `Consumed stock for completed order ${order.orderNo}`,
                            },
                        });
                    }
                }
            }
        }

        const updatedOrder = await tx.supplyOrder.update({
            where: { id: oId },
            data: {
                status,
                statusEvents: {
                    create: {
                        status,
                        notes: notes ? String(notes).trim() : `Order status updated to ${status}`,
                        createdRole: "SUPPLIER",
                    },
                },
            },
            include: { items: true, statusEvents: { orderBy: { createdAt: "desc" } } },
        });

        return updatedOrder;
    });

    return updated;
}
