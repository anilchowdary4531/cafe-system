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
            const { productId, quantity } = req.body || {};
            const cart = await updateSupplyCartItem(restaurantId, productId, quantity);
            return reply.code(200).send(cart);
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to update cart" });
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

    app.get("/marketplace/products", { preHandler: [authUser] }, browseProductsHandler);
    app.get("/api/marketplace/products", { preHandler: [authUser] }, browseProductsHandler);
    app.get("/api/v1/marketplace/products", { preHandler: [authUser] }, browseProductsHandler);

    app.get("/supply-cart", { preHandler: [authUser] }, getCartHandler);
    app.get("/api/supply-cart", { preHandler: [authUser] }, getCartHandler);
    app.get("/api/v1/supply-cart", { preHandler: [authUser] }, getCartHandler);

    app.post("/supply-cart/items", { preHandler: [authUser] }, updateCartItemHandler);
    app.post("/api/supply-cart/items", { preHandler: [authUser] }, updateCartItemHandler);
    app.post("/api/v1/supply-cart/items", { preHandler: [authUser] }, updateCartItemHandler);

    app.post("/supply-orders", { preHandler: [authUser] }, placeOrderHandler);
    app.post("/api/supply-orders", { preHandler: [authUser] }, placeOrderHandler);
    app.post("/api/v1/supply-orders", { preHandler: [authUser] }, placeOrderHandler);

    app.get("/supply-orders", { preHandler: [authUser] }, listRestaurantOrdersHandler);
    app.get("/api/supply-orders", { preHandler: [authUser] }, listRestaurantOrdersHandler);
    app.get("/api/v1/supply-orders", { preHandler: [authUser] }, listRestaurantOrdersHandler);

    app.get("/supplier/orders", { preHandler: [authSupplier] }, listSupplierOrdersHandler);
    app.get("/api/supplier/orders", { preHandler: [authSupplier] }, listSupplierOrdersHandler);
    app.get("/api/v1/supplier/orders", { preHandler: [authSupplier] }, listSupplierOrdersHandler);

    app.post("/supplier/orders/:id/accept", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "ACCEPTED"));
    app.post("/supplier/orders/:id/dispatch", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "DISPATCHED"));
    app.post("/supplier/orders/:id/complete", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "COMPLETED"));
    app.post("/supplier/orders/:id/reject", { preHandler: [authSupplier] }, (req, reply) => updateOrderStatusHandler(req, reply, "REJECTED"));
}
