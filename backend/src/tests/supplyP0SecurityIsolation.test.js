import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import supplyMarketplaceRoutes from "../routes/supplyMarketplace.routes.js";
import supplyChatRoutes from "../routes/supplyChat.routes.js";
import inventoryRoutes from "../routes/inventory.js";

test("Supply Chain P0 Security & Tenant-Isolation Suite", async (t) => {
    const app = Fastify();
    await app.register(fastifyJwt, { secret: "p0_supply_security_test_secret" });
    app.addHook("onRequest", async (req) => {
        req.prisma = prisma;
    });
    await supplyMarketplaceRoutes(app, {});
    await supplyChatRoutes(app, {});
    await inventoryRoutes(app, {});

    // Stubbed in-memory records for deterministic testing without live Postgres
    const users = new Map([
        [101, { id: 101, role: "OWNER", designation: "Owner", name: "Owner 10", restaurantId: 10, branchId: null, sessionVersion: 1, isActive: true, mustChangePassword: false }],
        [102, { id: 102, role: "MANAGER", designation: "Manager", name: "Manager 10", restaurantId: 10, branchId: null, sessionVersion: 1, isActive: true, mustChangePassword: false }],
        [103, { id: 103, role: "CHEF", designation: "Chef", name: "Chef 10", restaurantId: 10, branchId: null, sessionVersion: 1, isActive: true, mustChangePassword: false }],
        [104, { id: 104, role: "WAITER", designation: "Server", name: "Waiter 10", restaurantId: 10, branchId: null, sessionVersion: 1, isActive: true, mustChangePassword: false }],
        [201, { id: 201, role: "OWNER", designation: "Owner", name: "Owner 20", restaurantId: 20, branchId: null, sessionVersion: 1, isActive: true, mustChangePassword: false }],
        [501, { id: 501, role: "USER", designation: null, name: "Regular User", restaurantId: null, branchId: null, sessionVersion: 1, isActive: true, mustChangePassword: false }],
    ]);

    const staffPermissions = new Map([
        [103, { inventory: true, supply: false }], // Chef has inventory, not supply
        [104, { inventory: false, supply: false }], // Waiter has neither
    ]);

    const originals = {
        userFindUnique: prisma.user.findUnique,
        staffAccessFindUnique: prisma.staffAccess.findUnique,
        supplierFindMany: prisma.supplier.findMany,
        supplyOrderFindMany: prisma.supplyOrder.findMany,
        supplyOrderFindUnique: prisma.supplyOrder.findUnique,
        supplyOrderUpdate: prisma.supplyOrder.update,
        purchaseInvoiceFindUnique: prisma.purchaseInvoice.findUnique,
        supplierPaymentCreate: prisma.supplierPayment.create,
        storageLocationFindUnique: prisma.storageLocation.findUnique,
        storageLocationUpdate: prisma.storageLocation.update,
        purchaseRequestFindUnique: prisma.purchaseRequest.findUnique,
        negotiationFindUnique: prisma.supplierNegotiation.findUnique,
        negotiationUpdate: prisma.supplierNegotiation.update,
        supplyProductFindMany: prisma.supplyProduct.findMany,
        rawMaterialFindMany: prisma.rawMaterial.findMany,
    };

    let lastSupplierFindManyArgs = null;
    let crossTenantMutationCalled = false;

    t.before(() => {
        prisma.user.findUnique = async ({ where }) => users.get(Number(where?.id)) || null;
        prisma.staffAccess.findUnique = async ({ where }) => ({
            permissions: staffPermissions.get(Number(where?.userId)) || {},
        });
        prisma.supplier.findMany = async (args) => {
            lastSupplierFindManyArgs = args;
            const filterRid = args?.include?.orders?.where?.restaurantId;
            const allOrders = [
                { id: 1, restaurantId: 10, totalAmount: 500, items: [] },
                { id: 2, restaurantId: 20, totalAmount: 900, items: [] },
            ];
            return [
                {
                    id: 50,
                    name: "Fresh Farms",
                    profile: { companyName: "Fresh Farms Co" },
                    addresses: [],
                    products: [{ id: 1, name: "Tomatoes", availability: true }],
                    orders: filterRid ? allOrders.filter((o) => o.restaurantId === Number(filterRid)) : allOrders,
                    _count: { products: 1 },
                },
            ];
        };
        prisma.supplyOrder.findMany = async () => [];
        prisma.supplyOrder.findUnique = async ({ where }) =>
            Number(where?.id) === 999 ? { id: 999, restaurantId: 20, status: "PLACED" } : null;
        prisma.supplyOrder.update = async () => {
            crossTenantMutationCalled = true;
            return {};
        };
        prisma.purchaseInvoice.findUnique = async ({ where }) =>
            Number(where?.id) === 888 ? { id: 888, restaurantId: 20, totalAmount: 1000, paidAmount: 0, balance: 1000 } : null;
        prisma.supplierPayment.create = async () => {
            crossTenantMutationCalled = true;
            return {};
        };
        prisma.storageLocation.findUnique = async ({ where }) =>
            Number(where?.id) === 777 ? { id: 777, restaurantId: 20, name: "Rest 20 Freezer" } : null;
        prisma.storageLocation.update = async () => {
            crossTenantMutationCalled = true;
            return {};
        };
        prisma.purchaseRequest.findUnique = async ({ where }) =>
            Number(where?.id) === 555 ? { id: 555, restaurantId: 20, status: "PENDING" } : null;
        prisma.supplierNegotiation.findUnique = async ({ where }) =>
            Number(where?.id) === 666 ? { id: 666, restaurantId: 20, status: "ACTIVE", currentOffer: 100 } : null;
        prisma.supplierNegotiation.update = async () => {
            crossTenantMutationCalled = true;
            return {};
        };
        prisma.supplyProduct.findMany = async () => [];
        prisma.rawMaterial.findMany = async () => [];
    });

    t.after(() => {
        prisma.user.findUnique = originals.userFindUnique;
        prisma.staffAccess.findUnique = originals.staffAccessFindUnique;
        prisma.supplier.findMany = originals.supplierFindMany;
        prisma.supplyOrder.findMany = originals.supplyOrderFindMany;
        prisma.supplyOrder.findUnique = originals.supplyOrderFindUnique;
        prisma.supplyOrder.update = originals.supplyOrderUpdate;
        prisma.purchaseInvoice.findUnique = originals.purchaseInvoiceFindUnique;
        prisma.supplierPayment.create = originals.supplierPaymentCreate;
        prisma.storageLocation.findUnique = originals.storageLocationFindUnique;
        prisma.storageLocation.update = originals.storageLocationUpdate;
        prisma.purchaseRequest.findUnique = originals.purchaseRequestFindUnique;
        prisma.supplierNegotiation.findUnique = originals.negotiationFindUnique;
        prisma.supplierNegotiation.update = originals.negotiationUpdate;
        prisma.supplyProduct.findMany = originals.supplyProductFindMany;
        prisma.rawMaterial.findMany = originals.rawMaterialFindMany;
    });

    const owner10Token = app.jwt.sign({ id: 101, role: "OWNER", restaurantId: 10, sessionVersion: 1 });
    const manager10Token = app.jwt.sign({ id: 102, role: "MANAGER", restaurantId: 10, sessionVersion: 1 });
    const chef10Token = app.jwt.sign({ id: 103, role: "CHEF", restaurantId: 10, sessionVersion: 1 });
    const waiter10Token = app.jwt.sign({ id: 104, role: "WAITER", restaurantId: 10, sessionVersion: 1 });
    const supplier11Token = app.jwt.sign({ supplierId: 11, role: "SUPPLIER", sessionVersion: 1 });
    const customerToken = app.jwt.sign({ id: 500, role: "CUSTOMER", type: "customer" });
    const userToken = app.jwt.sign({ id: 501, role: "USER", sessionVersion: 1 });

    await t.test("1. Missing and invalid JWTs are rejected with 401", async () => {
        const endpoints = [
            { method: "GET", url: "/owner/suppliers" },
            { method: "GET", url: "/api/v1/owner/purchase-orders" },
            { method: "GET", url: "/api/supply/payments" },
            { method: "GET", url: "/supply-orders" },
            { method: "GET", url: "/supply-cart" },
            { method: "GET", url: "/owner/10/inventory/materials" },
            { method: "GET", url: "/supply-chat/threads" },
            { method: "GET", url: "/marketplace/products" },
        ];

        for (const ep of endpoints) {
            const noAuth = await app.inject({ method: ep.method, url: ep.url });
            assert.equal(noAuth.statusCode, 401, `Expected 401 for unauthenticated ${ep.url}`);

            const badAuth = await app.inject({
                method: ep.method,
                url: ep.url,
                headers: { authorization: "Bearer invalid.jwt.token" },
            });
            assert.equal(badAuth.statusCode, 401, `Expected 401 for invalid JWT on ${ep.url}`);
        }
    });

    await t.test("2. CUSTOMER, USER, and unauthorized SUPPLIER roles receive 403 on owner Supply Chain endpoints", async () => {
        const ownerOnlyEndpoints = [
            { method: "GET", url: "/owner/suppliers" },
            { method: "GET", url: "/api/v1/owner/purchase-orders" },
            { method: "GET", url: "/api/supply/payments" },
            { method: "GET", url: "/supply-orders" },
            { method: "GET", url: "/supply-cart" },
            { method: "GET", url: "/owner/10/inventory/materials" },
        ];

        for (const [label, token] of [
            ["CUSTOMER", customerToken],
            ["USER", userToken],
            ["SUPPLIER", supplier11Token],
        ]) {
            for (const ep of ownerOnlyEndpoints) {
                const res = await app.inject({
                    method: ep.method,
                    url: ep.url,
                    headers: { authorization: `Bearer ${token}` },
                });
                assert.equal(res.statusCode, 403, `Expected 403 for ${label} on ${ep.url}, got ${res.statusCode}`);
            }
        }

        // Suppliers may still browse marketplace products (read-only) and view their own supplier orders
        const browseRes = await app.inject({
            method: "GET",
            url: "/marketplace/products",
            headers: { authorization: `Bearer ${supplier11Token}` },
        });
        assert.equal(browseRes.statusCode, 200);
    });

    await t.test("3. Owner and Manager can access their own restaurant's Supply Chain endpoints", async () => {
        for (const token of [owner10Token, manager10Token]) {
            const suppRes = await app.inject({
                method: "GET",
                url: "/owner/suppliers",
                headers: { authorization: `Bearer ${token}` },
            });
            assert.equal(suppRes.statusCode, 200);

            const poRes = await app.inject({
                method: "GET",
                url: "/api/v1/owner/purchase-orders",
                headers: { authorization: `Bearer ${token}` },
            });
            assert.equal(poRes.statusCode, 200);

            const invRes = await app.inject({
                method: "GET",
                url: "/owner/10/inventory/materials",
                headers: { authorization: `Bearer ${token}` },
            });
            assert.equal(invRes.statusCode, 200);
        }
    });

    await t.test("4. Staff permissions distinguish inventory vs supply capabilities", async () => {
        // Chef has inventory: true, supply: false
        const chefInv = await app.inject({
            method: "GET",
            url: "/owner/10/inventory/materials",
            headers: { authorization: `Bearer ${chef10Token}` },
        });
        assert.equal(chefInv.statusCode, 200);

        const chefSupply = await app.inject({
            method: "GET",
            url: "/api/v1/owner/purchase-orders",
            headers: { authorization: `Bearer ${chef10Token}` },
        });
        assert.equal(chefSupply.statusCode, 403);

        // Waiter has inventory: false, supply: false
        const waiterInv = await app.inject({
            method: "GET",
            url: "/owner/10/inventory/materials",
            headers: { authorization: `Bearer ${waiter10Token}` },
        });
        assert.equal(waiterInv.statusCode, 403);

        const waiterSupply = await app.inject({
            method: "GET",
            url: "/owner/suppliers",
            headers: { authorization: `Bearer ${waiter10Token}` },
        });
        assert.equal(waiterSupply.statusCode, 403);

        // Granting supply: true allows Waiter to access supply endpoints for Restaurant 10
        staffPermissions.set(104, { inventory: false, supply: true });
        const waiterSupplyGranted = await app.inject({
            method: "GET",
            url: "/owner/suppliers",
            headers: { authorization: `Bearer ${waiter10Token}` },
        });
        assert.equal(waiterSupplyGranted.statusCode, 200);
        staffPermissions.set(104, { inventory: false, supply: false });
    });

    await t.test("5. Cross-restaurant query, body, and path restaurantId attempts are rejected with 403", async () => {
        const queryAttempt = await app.inject({
            method: "GET",
            url: "/api/v1/owner/purchase-orders?restaurantId=20",
            headers: { authorization: `Bearer ${owner10Token}` },
        });
        assert.equal(queryAttempt.statusCode, 403);

        const bodyAttempt = await app.inject({
            method: "POST",
            url: "/supply-orders",
            headers: { authorization: `Bearer ${owner10Token}` },
            payload: { restaurantId: 20, notes: "Cross-tenant attack" },
        });
        assert.equal(bodyAttempt.statusCode, 403);

        const pathAttempt = await app.inject({
            method: "GET",
            url: "/owner/20/inventory/materials",
            headers: { authorization: `Bearer ${owner10Token}` },
        });
        assert.equal(pathAttempt.statusCode, 403);
    });

    await t.test("6. listSuppliersForOwnerHandler scopes orders and counts to authenticated restaurantId", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/owner/suppliers",
            headers: { authorization: `Bearer ${owner10Token}` },
        });
        assert.equal(res.statusCode, 200);
        assert.equal(lastSupplierFindManyArgs?.include?.orders?.where?.restaurantId, 10);

        const payload = JSON.parse(res.payload);
        assert.equal(payload.suppliers[0].orders.length, 1);
        assert.equal(payload.suppliers[0].orders[0].restaurantId, 10);
        assert.equal(payload.suppliers[0]._count.orders, 1);
    });

    await t.test("7. Cross-restaurant ID-based mutations are rejected with 403 without modifying data", async () => {
        crossTenantMutationCalled = false;

        const poMut = await app.inject({
            method: "PUT",
            url: "/owner/purchase-orders/999/status",
            headers: { authorization: `Bearer ${owner10Token}` },
            payload: { status: "CANCELLED" },
        });
        assert.equal(poMut.statusCode, 403);

        const payMut = await app.inject({
            method: "POST",
            url: "/owner/purchase-invoices/888/payments",
            headers: { authorization: `Bearer ${owner10Token}` },
            payload: { amount: 500, paymentMethod: "CASH" },
        });
        assert.equal(payMut.statusCode, 403);

        const locMut = await app.inject({
            method: "PUT",
            url: "/owner/storage-locations/777",
            headers: { authorization: `Bearer ${owner10Token}` },
            payload: { name: "Hijacked" },
        });
        assert.equal(locMut.statusCode, 403);

        const negMut = await app.inject({
            method: "POST",
            url: "/api/supply/negotiations/666/messages",
            headers: { authorization: `Bearer ${owner10Token}` },
            payload: { action: "ACCEPT", message: "Hijack" },
        });
        assert.equal(negMut.statusCode, 403);

        const prConvertMut = await app.inject({
            method: "POST",
            url: "/api/v1/owner/purchase-requests/555/convert",
            headers: { authorization: `Bearer ${owner10Token}` },
        });
        assert.equal(prConvertMut.statusCode, 403);

        const aliasCheck = await app.inject({
            method: "GET",
            url: "/api/v1/owner/suppliers?restaurantId=20",
            headers: { authorization: `Bearer ${owner10Token}` },
        });
        assert.equal(aliasCheck.statusCode, 403);

        assert.equal(crossTenantMutationCalled, false);
    });

    await t.test("8. Supply chat enforces strict dual-auth and participant ownership", async () => {
        // Supplier 11 can access own thread with Restaurant 10
        const suppOwn = await app.inject({
            method: "GET",
            url: "/supply-chat/threads/thread_supp_11_rest_10/messages",
            headers: { authorization: `Bearer ${supplier11Token}` },
        });
        assert.equal(suppOwn.statusCode, 200);

        // Supplier 11 cannot access Supplier 99's thread
        const suppOther = await app.inject({
            method: "GET",
            url: "/supply-chat/threads/thread_supp_99_rest_10/messages",
            headers: { authorization: `Bearer ${supplier11Token}` },
        });
        assert.equal(suppOther.statusCode, 403);

        // Owner 10 can access Restaurant 10's thread, cannot access Restaurant 20's thread
        const ownerOwn = await app.inject({
            method: "GET",
            url: "/supply-chat/threads/thread_supp_11_rest_10/messages",
            headers: { authorization: `Bearer ${owner10Token}` },
        });
        assert.equal(ownerOwn.statusCode, 200);

        const ownerOther = await app.inject({
            method: "GET",
            url: "/supply-chat/threads/thread_supp_11_rest_20/messages",
            headers: { authorization: `Bearer ${owner10Token}` },
        });
        assert.equal(ownerOther.statusCode, 403);
    });
});
