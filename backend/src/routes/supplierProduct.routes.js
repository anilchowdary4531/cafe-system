import {
    createSupplierProduct,
    getSupplierProductById,
    updateSupplierProduct,
    addSupplierProductStock,
} from "../services/supplierProductService.js";
import authorizeRoles from "../middleware/rbacGuard.js";
import prisma from "../prisma.js";

export default async function supplierProductRoutes(app) {
    const authSupplier = authorizeRoles("SUPPLIER", "SUPER_ADMIN", "OWNER", "MANAGER", "ADMIN", "STAFF", "USER");

    const resolveSupplierId = async (req) => {
        if (req.user?.supplierId) return Number(req.user.supplierId);

        const userEmail = req.user?.email;
        const userPhone = req.user?.phone;
        const userId = req.user?.id;

        if (userId) {
            const directSupplier = await prisma.supplier.findUnique({ where: { id: Number(userId) } }).catch(() => null);
            if (directSupplier) return directSupplier.id;
        }

        const matchedSupplier = await prisma.supplier.findFirst({
            where: {
                OR: [
                    ...(userEmail ? [{ email: userEmail }] : []),
                    ...(userPhone ? [{ phone: userPhone }] : []),
                ],
            },
        }).catch(() => null);

        if (matchedSupplier) return matchedSupplier.id;

        const firstSupplier = await prisma.supplier.findFirst({ orderBy: { id: "asc" } }).catch(() => null);
        if (firstSupplier) return firstSupplier.id;

        const createdSupplier = await prisma.supplier.create({
            data: {
                email: userEmail || `supplier_${Date.now()}@tiffzy.com`,
                phone: userPhone || `9999${Math.floor(100000 + Math.random() * 900000)}`,
                passwordHash: "$2a$10$defaultHashForAutoSupplierAccountCreation",
                status: "ACTIVE",
                isVerified: true,
                profile: {
                    create: {
                        businessName: "Tiffzy Verified Supplier",
                    },
                },
            },
        });

        return createdSupplier.id;
    };

    const createProductHandler = async (req, reply) => {
        try {
            const supplierId = await resolveSupplierId(req);
            const product = await createSupplierProduct(supplierId, req.body || {});
            return reply.code(201).send({ message: "Product created successfully", product });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to create product" });
        }
    };

    const listSupplierProductsHandler = async (req, reply) => {
        try {
            const supplierId = await resolveSupplierId(req);
            const products = await prisma.supplyProduct.findMany({
                where: { supplierId: Number(supplierId), isDeleted: false },
                include: {
                    images: { orderBy: { priority: "asc" } },
                    prices: { where: { isActive: true }, take: 1 },
                    discounts: { where: { isActive: true }, take: 1 },
                    inventory: true,
                    category: true,
                },
                orderBy: { createdAt: "desc" },
            });

            return reply.code(200).send({ products });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch supplier products" });
        }
    };

    const getProductHandler = async (req, reply) => {
        try {
            const product = await getSupplierProductById(req.params.id);
            return reply.code(200).send({ product });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Product not found" });
        }
    };

    const updateProductHandler = async (req, reply) => {
        try {
            const supplierId = await resolveSupplierId(req);
            const updated = await updateSupplierProduct(req.params.id, supplierId, req.body || {});
            return reply.code(200).send({ message: "Product updated successfully", product: updated });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to update product" });
        }
    };

    const addStockHandler = async (req, reply) => {
        try {
            const supplierId = await resolveSupplierId(req);
            const { quantity, notes } = req.body || {};
            const result = await addSupplierProductStock(req.params.id, supplierId, quantity, notes);
            return reply.code(200).send(result);
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to add stock" });
        }
    };

    const endpoints = [
        { method: "POST", path: "/supplier/products", handler: createProductHandler },
        { method: "POST", path: "/api/v1/supplier/products", handler: createProductHandler },
        { method: "GET", path: "/supplier/products", handler: listSupplierProductsHandler },
        { method: "GET", path: "/api/v1/supplier/products", handler: listSupplierProductsHandler },
        { method: "GET", path: "/supplier/products/:id", handler: getProductHandler },
        { method: "GET", path: "/api/v1/supplier/products/:id", handler: getProductHandler },
        { method: "PUT", path: "/supplier/products/:id", handler: updateProductHandler },
        { method: "PUT", path: "/api/v1/supplier/products/:id", handler: updateProductHandler },
        { method: "POST", path: "/supplier/products/:id/stock", handler: addStockHandler },
        { method: "POST", path: "/api/v1/supplier/products/:id/stock", handler: addStockHandler },
    ];

    for (const ep of endpoints) {
        if (ep.method === "GET") app.get(ep.path, { preHandler: [authSupplier] }, ep.handler);
        if (ep.method === "POST") app.post(ep.path, { preHandler: [authSupplier] }, ep.handler);
        if (ep.method === "PUT") app.put(ep.path, { preHandler: [authSupplier] }, ep.handler);
    }
}

