import prisma from "../prisma.js";

export async function getSuperAdminSupplyDashboard() {
    const [
        totalSuppliers,
        activeSuppliers,
        pendingSuppliers,
        suspendedSuppliers,
        totalProducts,
        activeProducts,
        totalOrders,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        lowStockProducts,
        orders,
    ] = await Promise.all([
        prisma.supplier.count(),
        prisma.supplier.count({ where: { status: "ACTIVE" } }),
        prisma.supplier.count({ where: { status: "PENDING" } }),
        prisma.supplier.count({ where: { status: "SUSPENDED" } }),
        prisma.supplyProduct.count({ where: { isDeleted: false } }),
        prisma.supplyProduct.count({ where: { isDeleted: false, status: "APPROVED", availability: true } }),
        prisma.supplyOrder.count(),
        prisma.supplyOrder.count({ where: { status: "PLACED" } }),
        prisma.supplyOrder.count({ where: { status: "COMPLETED" } }),
        prisma.supplyOrder.count({ where: { status: "CANCELLED" } }),
        prisma.supplyInventory.count({ where: { availableStock: { lte: 10 } } }),
        prisma.supplyOrder.findMany({ select: { totalAmount: true, createdAt: true, status: true } }),
    ]);

    const totalSales = orders
        .filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED")
        .reduce((sum, o) => sum + o.totalAmount, 0);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const todaySales = orders
        .filter((o) => o.createdAt >= startOfToday && o.status !== "CANCELLED" && o.status !== "REJECTED")
        .reduce((sum, o) => sum + o.totalAmount, 0);

    const monthlySales = orders
        .filter((o) => o.createdAt >= startOfMonth && o.status !== "CANCELLED" && o.status !== "REJECTED")
        .reduce((sum, o) => sum + o.totalAmount, 0);

    return {
        suppliers: {
            total: totalSuppliers,
            active: activeSuppliers,
            pending: pendingSuppliers,
            suspended: suspendedSuppliers,
        },
        products: {
            total: totalProducts,
            active: activeProducts,
            lowStock: lowStockProducts,
        },
        orders: {
            total: totalOrders,
            pending: pendingOrders,
            completed: completedOrders,
            cancelled: cancelledOrders,
        },
        sales: {
            totalSales: Number(totalSales.toFixed(2)),
            todaySales: Number(todaySales.toFixed(2)),
            monthlySales: Number(monthlySales.toFixed(2)),
        },
    };
}

export async function updateSupplierStatus(supplierId, status) {
    const sId = Number(supplierId);
    const validStatus = String(status).toUpperCase();

    if (!sId || !["APPROVED", "ACTIVE", "REJECTED", "SUSPENDED", "BLOCKED"].includes(validStatus)) {
        throw { statusCode: 400, message: "Invalid supplier ID or status" };
    }

    const updated = await prisma.supplier.update({
        where: { id: sId },
        data: {
            status: validStatus === "APPROVED" ? "ACTIVE" : validStatus,
            isVerified: validStatus === "APPROVED" || validStatus === "ACTIVE",
        },
        include: { profile: true },
    });

    return updated;
}

export async function moderateSupplyProduct(productId, status) {
    const pId = Number(productId);
    const validStatus = String(status).toUpperCase();

    if (!pId || !["APPROVED", "REJECTED", "DISABLED", "ENABLED"].includes(validStatus)) {
        throw { statusCode: 400, message: "Invalid product ID or status" };
    }

    const updated = await prisma.supplyProduct.update({
        where: { id: pId },
        data: {
            status: validStatus === "ENABLED" ? "APPROVED" : validStatus,
            availability: validStatus !== "DISABLED" && validStatus !== "REJECTED",
        },
    });

    return updated;
}

export async function processSupplierSettlement(supplierId, { commissionPercent = 5.0 }) {
    const sId = Number(supplierId);
    if (!sId) throw { statusCode: 400, message: "Invalid supplier ID" };

    const orders = await prisma.supplyOrder.findMany({
        where: { supplierId: sId, status: "COMPLETED", settlementItem: null },
    });

    if (orders.length === 0) {
        throw { statusCode: 400, message: "No unsettled completed orders found for this supplier" };
    }

    const grossAmount = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const commissionFee = (grossAmount * Math.max(0, Number(commissionPercent))) / 100;
    const netPayable = grossAmount - commissionFee;
    const settlementNo = `SETTLE-${Date.now()}-${sId}`;

    const settlement = await prisma.$transaction(async (tx) => {
        const createdSettlement = await tx.supplierSettlement.create({
            data: {
                settlementNo,
                supplierId: sId,
                grossAmount: Number(grossAmount.toFixed(2)),
                commissionFee: Number(commissionFee.toFixed(2)),
                taxDeductions: 0,
                netPayable: Number(netPayable.toFixed(2)),
                status: "COMPLETED",
                payoutRef: `PAYOUT-REF-${Date.now()}`,
                settledAt: new Date(),
                items: {
                    create: orders.map((o) => {
                        const oCommission = (o.totalAmount * Number(commissionPercent)) / 100;
                        return {
                            orderId: o.id,
                            orderAmount: o.totalAmount,
                            commission: Number(oCommission.toFixed(2)),
                            netAmount: Number((o.totalAmount - oCommission).toFixed(2)),
                        };
                    }),
                },
            },
            include: { items: true },
        });

        return createdSettlement;
    });

    return settlement;
}
