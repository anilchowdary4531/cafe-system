import {
    getSuperAdminSupplyDashboard,
    updateSupplierStatus,
    moderateSupplyProduct,
    processSupplierSettlement,
} from "../services/superAdminSupplyService.js";
import authorizeRoles from "../middleware/rbacGuard.js";
import prisma from "../prisma.js";

export default async function superAdminSupplyRoutes(app) {
    const authAdmin = authorizeRoles("SUPER_ADMIN");

    const dashboardHandler = async (req, reply) => {
        try {
            const data = await getSuperAdminSupplyDashboard();
            return reply.code(200).send(data);
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch supply chain dashboard" });
        }
    };

    const listSuppliersHandler = async (req, reply) => {
        try {
            const suppliers = await prisma.supplier.findMany({
                include: {
                    profile: true,
                    addresses: true,
                    _count: { select: { products: true, orders: true } },
                },
                orderBy: { createdAt: "desc" },
            });

            return reply.code(200).send({ suppliers });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch suppliers" });
        }
    };

    const supplierStatusHandler = async (req, reply) => {
        try {
            const { status } = req.body || {};
            const result = await updateSupplierStatus(req.params.id, status);
            return reply.code(200).send({ message: "Supplier status updated", supplier: result });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to update supplier status" });
        }
    };

    const listProductsHandler = async (req, reply) => {
        try {
            const products = await prisma.supplyProduct.findMany({
                where: { isDeleted: false },
                include: {
                    supplier: { include: { profile: true } },
                    category: true,
                    prices: { where: { isActive: true }, take: 1 },
                    inventory: true,
                },
                orderBy: { createdAt: "desc" },
            });

            return reply.code(200).send({ products });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch products" });
        }
    };

    const productStatusHandler = async (req, reply) => {
        try {
            const { status } = req.body || {};
            const result = await moderateSupplyProduct(req.params.id, status);
            return reply.code(200).send({ message: "Product status updated", product: result });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to moderate product" });
        }
    };

    const listOrdersHandler = async (req, reply) => {
        try {
            const orders = await prisma.supplyOrder.findMany({
                include: {
                    restaurant: true,
                    supplier: { include: { profile: true } },
                    items: true,
                },
                orderBy: { createdAt: "desc" },
            });

            return reply.code(200).send({ orders });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch supply orders" });
        }
    };

    const processSettlementHandler = async (req, reply) => {
        try {
            const { supplierId, commissionPercent } = req.body || {};
            const settlement = await processSupplierSettlement(supplierId, { commissionPercent });
            return reply.code(201).send({ message: "Settlement processed successfully", settlement });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to process settlement" });
        }
    };

    app.get("/super-admin/supply/dashboard", { preHandler: [authAdmin] }, dashboardHandler);
    app.get("/api/v1/super-admin/supply/dashboard", { preHandler: [authAdmin] }, dashboardHandler);

    app.get("/super-admin/supply/suppliers", { preHandler: [authAdmin] }, listSuppliersHandler);
    app.get("/api/v1/super-admin/supply/suppliers", { preHandler: [authAdmin] }, listSuppliersHandler);

    app.post("/super-admin/supply/suppliers/:id/status", { preHandler: [authAdmin] }, supplierStatusHandler);
    app.post("/api/v1/super-admin/supply/suppliers/:id/status", { preHandler: [authAdmin] }, supplierStatusHandler);

    app.get("/super-admin/supply/products", { preHandler: [authAdmin] }, listProductsHandler);
    app.get("/api/v1/super-admin/supply/products", { preHandler: [authAdmin] }, listProductsHandler);

    app.post("/super-admin/supply/products/:id/status", { preHandler: [authAdmin] }, productStatusHandler);
    app.post("/api/v1/super-admin/supply/products/:id/status", { preHandler: [authAdmin] }, productStatusHandler);

    app.get("/super-admin/supply/orders", { preHandler: [authAdmin] }, listOrdersHandler);
    app.get("/api/v1/super-admin/supply/orders", { preHandler: [authAdmin] }, listOrdersHandler);

    app.post("/super-admin/supply/settlements", { preHandler: [authAdmin] }, processSettlementHandler);
    app.post("/api/v1/super-admin/supply/settlements", { preHandler: [authAdmin] }, processSettlementHandler);
}
