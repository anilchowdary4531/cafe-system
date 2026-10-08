import prisma from "../prisma.js";
import { createAndDispatchNotification } from "./notificationService.js";

function slugify(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}

export function calculateFinalPrice(basePrice, taxPercent = 5.0, discountType = null, discountValue = 0) {
    const base = Math.max(0, Number(basePrice || 0));
    const taxRate = Math.max(0, Number(taxPercent || 0)) / 100;
    const priceWithTax = base * (1 + taxRate);

    let discountAmount = 0;
    if (discountType === "PERCENTAGE" && discountValue > 0) {
        discountAmount = (priceWithTax * Math.min(100, Number(discountValue))) / 100;
    } else if (discountType === "FIXED" && discountValue > 0) {
        discountAmount = Math.min(priceWithTax, Number(discountValue));
    }

    const finalPrice = Math.max(0, priceWithTax - discountAmount);

    return {
        basePrice: base,
        taxPercent,
        discountType,
        discountValue,
        discountAmount,
        finalPrice: Number(finalPrice.toFixed(2)),
    };
}

export async function createSupplierProduct(supplierId, data) {
    const sId = Number(supplierId);
    if (!sId) throw { statusCode: 400, message: "Invalid supplier ID" };

    const {
        name,
        categoryId,
        description,
        unit = "KG",
        moq = 1,
        basePrice,
        taxPercent = 5.0,
        discountType,
        discountValue = 0,
        initialStock = 100,
        lowStockAlert = 10,
        imageUrl,
        imageUrls = [],
    } = data || {};

    const imagesList = Array.isArray(imageUrls) && imageUrls.length > 0
        ? imageUrls
        : (imageUrl ? [imageUrl] : []);

    const cleanName = String(name || "").trim();
    if (!cleanName) throw { statusCode: 400, message: "Product name is required" };
    if (!basePrice || Number(basePrice) <= 0) throw { statusCode: 400, message: "Base price must be greater than 0" };

    const generatedSlug = `${slugify(cleanName)}-${Date.now()}`;

    const pricing = calculateFinalPrice(basePrice, taxPercent, discountType, discountValue);

    const product = await prisma.$transaction(async (tx) => {
        const createdProduct = await tx.supplyProduct.create({
            data: {
                supplierId: sId,
                categoryId: categoryId ? Number(categoryId) : null,
                name: cleanName,
                slug: generatedSlug,
                description: description ? String(description).trim() : null,
                unit: String(unit).toUpperCase(),
                moq: Math.max(1, Number(moq || 1)),
                availability: true,
                status: "APPROVED", // Auto-approved for verified active suppliers
            },
        });

        await tx.supplyPrice.create({
            data: {
                productId: createdProduct.id,
                basePrice: pricing.basePrice,
                taxPercent: pricing.taxPercent,
                isActive: true,
            },
        });

        if (discountType && discountValue > 0) {
            await tx.supplyDiscount.create({
                data: {
                    productId: createdProduct.id,
                    type: String(discountType).toUpperCase(),
                    value: Number(discountValue),
                    isActive: true,
                },
            });
        }

        const stockQty = Math.max(1, Number(initialStock ?? 100));
        const inventory = await tx.supplyInventory.create({
            data: {
                productId: createdProduct.id,
                totalStock: stockQty,
                reservedStock: 0,
                availableStock: stockQty,
                lowStockAlert: Number(lowStockAlert || 10),
            },
        });

        if (stockQty > 0) {
            await tx.supplyInventoryTransaction.create({
                data: {
                    inventoryId: inventory.id,
                    type: "STOCK_ADD",
                    quantity: stockQty,
                    balanceBefore: 0,
                    balanceAfter: stockQty,
                    notes: "Initial inventory setup",
                },
            });
        }

        if (Array.isArray(imagesList) && imagesList.length > 0) {
            await tx.supplyProductImage.createMany({
                data: imagesList.map((url, idx) => ({
                    productId: createdProduct.id,
                    imageUrl: String(url).trim(),
                    priority: idx,
                    isPrimary: idx === 0,
                })),
            });
        }

        return createdProduct;
    });

    return getSupplierProductById(product.id);
}

export async function getSupplierProductById(productId) {
    const id = Number(productId);
    if (!id) throw { statusCode: 400, message: "Invalid product ID" };

    const product = await prisma.supplyProduct.findUnique({
        where: { id },
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
    });

    if (!product || product.isDeleted) throw { statusCode: 404, message: "Supply product not found" };

    const currentPrice = product.prices[0] || { basePrice: 0, taxPercent: 5 };
    const currentDiscount = product.discounts[0] || null;

    const pricing = calculateFinalPrice(
        currentPrice.basePrice,
        currentPrice.taxPercent,
        currentDiscount?.type,
        currentDiscount?.value
    );

    return {
        id: product.id,
        supplierId: product.supplierId,
        supplierName: product.supplier?.profile?.businessName || "ABC Foods",
        supplierRating: product.supplier?.profile?.rating || 4.8,
        supplierCity: product.supplier?.addresses?.[0]?.city || "Main Market",
        name: product.name,
        slug: product.slug,
        description: product.description,
        unit: product.unit,
        moq: product.moq,
        availability: product.availability,
        status: product.status,
        category: product.category,
        images: product.images,
        primaryImage: product.images.find((img) => img.isPrimary)?.imageUrl || product.images[0]?.imageUrl || "",
        basePrice: pricing.basePrice,
        taxPercent: pricing.taxPercent,
        discountType: pricing.discountType,
        discountValue: pricing.discountValue,
        discountAmount: pricing.discountAmount,
        finalPrice: pricing.finalPrice,
        totalStock: product.inventory?.totalStock || 0,
        reservedStock: product.inventory?.reservedStock || 0,
        availableStock: product.inventory?.availableStock || 0,
        lowStockAlert: product.inventory?.lowStockAlert || 10,
    };
}

export async function updateSupplierProduct(productId, supplierId, data) {
    const pId = Number(productId);
    const sId = Number(supplierId);
    if (!pId || !sId) throw { statusCode: 400, message: "Invalid IDs" };

    const existing = await prisma.supplyProduct.findFirst({
        where: { id: pId, supplierId: sId, isDeleted: false },
    });

    if (!existing) throw { statusCode: 404, message: "Product not found or access denied" };

    const {
        name,
        categoryId,
        description,
        unit,
        moq,
        availability,
        basePrice,
        taxPercent,
        discountType,
        discountValue,
        lowStockAlert,
    } = data || {};

    await prisma.$transaction(async (tx) => {
        await tx.supplyProduct.update({
            where: { id: pId },
            data: {
                ...(name ? { name: String(name).trim() } : {}),
                ...(categoryId !== undefined ? { categoryId: categoryId ? Number(categoryId) : null } : {}),
                ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
                ...(unit ? { unit: String(unit).toUpperCase() } : {}),
                ...(moq ? { moq: Math.max(1, Number(moq)) } : {}),
                ...(availability !== undefined ? { availability: Boolean(availability) } : {}),
            },
        });

        if (basePrice !== undefined || taxPercent !== undefined) {
            await tx.supplyPrice.updateMany({
                where: { productId: pId },
                data: { isActive: false },
            });
            await tx.supplyPrice.create({
                data: {
                    productId: pId,
                    basePrice: Number(basePrice || existing.prices?.[0]?.basePrice || 100),
                    taxPercent: Number(taxPercent !== undefined ? taxPercent : 5.0),
                    isActive: true,
                },
            });
        }

        if (discountType !== undefined) {
            await tx.supplyDiscount.updateMany({
                where: { productId: pId },
                data: { isActive: false },
            });
            if (discountType && Number(discountValue) > 0) {
                await tx.supplyDiscount.create({
                    data: {
                        productId: pId,
                        type: String(discountType).toUpperCase(),
                        value: Number(discountValue),
                        isActive: true,
                    },
                });
            }
        }

        if (lowStockAlert !== undefined) {
            await tx.supplyInventory.update({
                where: { productId: pId },
                data: { lowStockAlert: Number(lowStockAlert) },
            });
        }
    });

    return getSupplierProductById(pId);
}

export async function addSupplierProductStock(productId, supplierId, quantity, notes = "Stock addition") {
    const pId = Number(productId);
    const sId = Number(supplierId);
    const qty = Number(quantity);

    if (!pId || !sId || isNaN(qty) || qty <= 0) {
        throw { statusCode: 400, message: "Invalid product ID or quantity" };
    }

    const inventory = await prisma.supplyInventory.findUnique({
        where: { productId: pId },
        include: { product: true },
    });

    if (!inventory || inventory.product.supplierId !== sId) {
        throw { statusCode: 404, message: "Inventory record not found for supplier" };
    }

    const updated = await prisma.$transaction(async (tx) => {
        const newTotal = inventory.totalStock + qty;
        const newAvailable = newTotal - inventory.reservedStock;

        const updatedInv = await tx.supplyInventory.update({
            where: { id: inventory.id },
            data: {
                totalStock: newTotal,
                availableStock: newAvailable,
            },
        });

        await tx.supplyInventoryTransaction.create({
            data: {
                inventoryId: inventory.id,
                type: "STOCK_ADD",
                quantity: qty,
                balanceBefore: inventory.availableStock,
                balanceAfter: newAvailable,
                notes: String(notes || "Stock added").trim(),
            },
        });

        return updatedInv;
    });

    return {
        productId: pId,
        totalStock: updated.totalStock,
        reservedStock: updated.reservedStock,
        availableStock: updated.availableStock,
        message: `Successfully added ${qty} ${inventory.product.unit} stock`,
    };
}

/**
 * Check and dispatch low-stock notification for a supplier product
 */
export async function checkAndDispatchLowStockNotification({ prismaInstance = prisma, realtime = null, productId, supplierId }) {
    try {
        const pId = Number(productId);
        const sId = Number(supplierId);
        if (!pId || !sId) return null;

        const inventory = await (prismaInstance || prisma).supplyInventory.findUnique({
            where: { productId: pId },
            include: { product: true },
        });

        if (!inventory || !inventory.product) return null;

        const available = Number(inventory.availableStock || 0);
        const lowAlert = Number(inventory.lowStockAlert || 10);

        if (available <= lowAlert) {
            const isCritical = available <= (lowAlert / 2) || available <= 0;
            const priority = isCritical ? "HIGH" : "NORMAL";
            const unit = inventory.product.unit || "units";
            const title = isCritical ? "Critical Low Stock Alert" : "Low Stock Alert";
            const message = `Low stock: ${inventory.product.name} has ${available} ${unit} remaining. Minimum safety stock is ${lowAlert} ${unit}.`;

            const idempotencyKey = `LOW_STOCK_SUPP:${sId}:${pId}:${Math.floor(available)}`;

            return await createAndDispatchNotification({
                prisma: prismaInstance || prisma,
                realtime,
                recipientType: "SUPPLIER",
                recipientId: sId,
                notificationType: "LOW_STOCK",
                title,
                message,
                priority,
                idempotencyKey,
                data: {
                    category: "INVENTORY",
                    screen: "INVENTORY",
                    actionUrl: "/supplier?tab=products",
                    productId: pId,
                    availableStock: available,
                    lowStockAlert: lowAlert,
                },
            });
        }
    } catch (err) {
        console.error("[LowStockNotification] Error dispatching alert:", err?.message || err);
    }
    return null;
}

/**
 * Check and dispatch batch expiry notifications for a supplier's inventory batches
 */
export async function checkAndDispatchBatchExpiryNotifications({ prismaInstance = prisma, realtime = null, supplierId }) {
    try {
        const sId = Number(supplierId);
        if (!sId) return [];

        const batches = await (prismaInstance || prisma).supplyInventoryBatch.findMany({
            where: {
                quantity: { gt: 0 },
                expiryDate: { not: null },
                inventory: { product: { supplierId: sId } },
            },
            include: {
                inventory: { include: { product: true } },
            },
        });

        const todayStr = new Date().toISOString().slice(0, 10);
        const notifications = [];

        for (const batch of batches) {
            const expiry = new Date(batch.expiryDate).getTime();
            const now = Date.now();
            const daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

            if (daysRemaining <= 30) {
                let notificationType = "BATCH_EXPIRING";
                let priority = "LOW";
                let title = "Batch Expiry Notice";

                if (daysRemaining <= 3) {
                    notificationType = "EXPIRY_CRITICAL";
                    priority = "HIGH";
                    title = "Critical Expiry Warning";
                } else if (daysRemaining <= 7) {
                    notificationType = "EXPIRY_WARNING";
                    priority = "NORMAL";
                    title = "Batch Expiry Warning";
                }

                const prodName = batch.inventory?.product?.name || "Product";
                const message = daysRemaining <= 0
                    ? `Critical: ${prodName} batch ${batch.batchNumber} has expired.`
                    : `Expiry warning: ${prodName} batch ${batch.batchNumber} expires in ${daysRemaining} days.`;

                const idempotencyKey = `EXPIRY_SUPP:${sId}:${batch.id}:${todayStr}`;

                const notif = await createAndDispatchNotification({
                    prisma: prismaInstance || prisma,
                    realtime,
                    recipientType: "SUPPLIER",
                    recipientId: sId,
                    notificationType,
                    title,
                    message,
                    priority,
                    idempotencyKey,
                    data: {
                        category: "INVENTORY",
                        screen: "INVENTORY",
                        actionUrl: "/supplier?tab=products",
                        batchId: batch.id,
                        daysRemaining,
                    },
                });

                if (notif) notifications.push(notif);
            }
        }
        return notifications;
    } catch (err) {
        console.error("[BatchExpiryNotification] Error dispatching alert:", err?.message || err);
    }
    return [];
}
