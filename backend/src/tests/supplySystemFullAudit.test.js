import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import routes from "../routes/index.js";
import prisma from "../prisma.js";
import { calculateFinalPrice } from "../services/supplierProductService.js";

test("Tiffzy Supply Chain Application — Full End-to-End System Audit", async (t) => {
    const app = Fastify();
    await app.register(jwt, { secret: "full_audit_jwt_secret_key_2026" });
    await routes(app, {});

    const testEmail = `full_supplier_${Date.now()}@tiffzytest.com`;
    const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const testPassword = "Password123!";
    let supplierId = null;
    let otpCode = null;
    let supplierToken = null;
    let productId = null;
    let orderId = null;

    t.after(async () => {
        if (orderId) {
            await prisma.supplyOrderItem.deleteMany({ where: { orderId } }).catch(() => {});
            await prisma.supplyOrderStatusEvent.deleteMany({ where: { orderId } }).catch(() => {});
            await prisma.supplyOrder.delete({ where: { id: orderId } }).catch(() => {});
        }
        if (productId) {
            await prisma.supplyInventoryTransaction.deleteMany({ where: { inventory: { productId } } }).catch(() => {});
            await prisma.supplyInventory.deleteMany({ where: { productId } }).catch(() => {});
            await prisma.supplyPrice.deleteMany({ where: { productId } }).catch(() => {});
            await prisma.supplyDiscount.deleteMany({ where: { productId } }).catch(() => {});
            await prisma.supplyProduct.delete({ where: { id: productId } }).catch(() => {});
        }
        if (supplierId) {
            await prisma.supplierProfile.deleteMany({ where: { supplierId } }).catch(() => {});
            await prisma.supplierAddress.deleteMany({ where: { supplierId } }).catch(() => {});
            await prisma.supplier.delete({ where: { id: supplierId } }).catch(() => {});
        }
        await prisma.authOtp.deleteMany({ where: { phone: testPhone } }).catch(() => {});
    });

    await t.test("Pricing Engine Unit Test — calculateFinalPrice formula", () => {
        const base = 500;
        const tax = 5;
        const discountVal = 10;
        const pricing = calculateFinalPrice(base, tax, "PERCENTAGE", discountVal);

        assert.equal(pricing.basePrice, 500);
        assert.equal(pricing.taxPercent, 5);
        // Price with 5% tax = 525. 10% discount on 525 = 52.5. Final price = 472.5
        assert.equal(pricing.finalPrice, 472.5);
    });

    await t.test("E2E Step 1: Supplier Registration & OTP Activation", async () => {
        const regRes = await app.inject({
            method: "POST",
            url: "/auth/supplier/register",
            payload: {
                email: testEmail,
                phone: testPhone,
                password: testPassword,
                businessName: "Super Fresh Poultry & Spices",
            },
        });

        assert.equal(regRes.statusCode, 201);
        const regPayload = JSON.parse(regRes.payload);
        supplierId = regPayload.supplierId;
        otpCode = regPayload.otpDebug;

        const verifyRes = await app.inject({
            method: "POST",
            url: "/auth/supplier/verify-otp",
            payload: { phone: testPhone, otp: otpCode },
        });

        assert.equal(verifyRes.statusCode, 200);
        const verifyPayload = JSON.parse(verifyRes.payload);
        assert.equal(verifyPayload.isVerified, true);
        assert.equal(verifyPayload.status, "ACTIVE");
    });

    await t.test("E2E Step 2: Supplier Login & Profile Setup", async () => {
        const loginRes = await app.inject({
            method: "POST",
            url: "/auth/supplier/login",
            payload: { email: testEmail, password: testPassword },
        });

        assert.equal(loginRes.statusCode, 200);
        const loginPayload = JSON.parse(loginRes.payload);
        assert.ok(loginPayload.token);
        supplierToken = loginPayload.token;

        const profileRes = await app.inject({
            method: "PUT",
            url: "/suppliers/me",
            headers: { authorization: `Bearer ${supplierToken}` },
            payload: {
                legalName: "Super Fresh Trading Pvt Ltd",
                gstin: `36AAAC${Math.floor(1000 + Math.random() * 9000)}B1Z5`,
                fssaiLicense: "10020011000123",
            },
        });

        assert.equal(profileRes.statusCode, 200);
    });

    await t.test("E2E Step 3: Product Studio Creation & Stock Setup", async () => {
        const createRes = await app.inject({
            method: "POST",
            url: "/supplier/products",
            headers: { authorization: `Bearer ${supplierToken}` },
            payload: {
                name: "Organic Farm Egg Tray",
                unit: "TRAY",
                moq: 5,
                basePrice: 180,
                taxPercent: 5,
                discountType: "PERCENTAGE",
                discountValue: 5,
                initialStock: 200,
            },
        });

        assert.equal(createRes.statusCode, 201);
        const createPayload = JSON.parse(createRes.payload);
        assert.ok(createPayload.product?.id);
        productId = createPayload.product.id;
        assert.equal(createPayload.product.availableStock, 200);
    });

    await t.test("E2E Step 4: Marketplace Browsing & Product Discovery", async () => {
        const browseRes = await app.inject({
            method: "GET",
            url: "/marketplace/products?search=Organic",
            headers: { authorization: `Bearer ${supplierToken}` },
        });

        assert.equal(browseRes.statusCode, 200);
        const browsePayload = JSON.parse(browseRes.payload);
        assert.ok(Array.isArray(browsePayload.products));
        assert.ok(browsePayload.products.length >= 1);
    });

    await t.test("E2E Step 5: Supply Cart Item Addition & MOQ Validation", async () => {
        const cartRes = await app.inject({
            method: "POST",
            url: "/supply-cart/items",
            headers: { authorization: `Bearer ${supplierToken}` },
            payload: {
                productId,
                quantity: 10,
                restaurantId: 1,
            },
        });

        assert.equal(cartRes.statusCode, 200);
        const cartPayload = JSON.parse(cartRes.payload);
        assert.ok(cartPayload.items.length >= 1);
        assert.ok(cartPayload.cartTotal > 0);
    });

    await t.test("E2E Step 6: Atomic Supply Order Placement & Stock Reservation", async () => {
        const orderRes = await app.inject({
            method: "POST",
            url: "/supply-orders",
            headers: { authorization: `Bearer ${supplierToken}` },
            payload: {
                restaurantId: 1,
                deliveryAddress: "Restaurant Central Kitchen",
                notes: "Fast delivery required",
            },
        });

        assert.equal(orderRes.statusCode, 201);
        const orderPayload = JSON.parse(orderRes.payload);
        assert.ok(orderPayload.orders?.length >= 1);
        orderId = orderPayload.orders[0].id;

        // Verify stock reservation in database
        const inv = await prisma.supplyInventory.findUnique({ where: { productId } });
        assert.equal(inv.reservedStock, 10);
        assert.equal(inv.availableStock, 190);
    });

    await t.test("E2E Step 7: Order Status Updates (ACCEPT -> DISPATCH -> COMPLETE) & Stock Consumption", async () => {
        const acceptRes = await app.inject({
            method: "POST",
            url: `/supplier/orders/${orderId}/accept`,
            headers: { authorization: `Bearer ${supplierToken}` },
        });
        assert.equal(acceptRes.statusCode, 200);

        const dispatchRes = await app.inject({
            method: "POST",
            url: `/supplier/orders/${orderId}/dispatch`,
            headers: { authorization: `Bearer ${supplierToken}` },
        });
        assert.equal(dispatchRes.statusCode, 200);

        const completeRes = await app.inject({
            method: "POST",
            url: `/supplier/orders/${orderId}/complete`,
            headers: { authorization: `Bearer ${supplierToken}` },
        });
        assert.equal(completeRes.statusCode, 200);

        // Verify total stock was consumed and reserved stock released
        const inv = await prisma.supplyInventory.findUnique({ where: { productId } });
        assert.equal(inv.totalStock, 190);
        assert.equal(inv.reservedStock, 0);
        assert.equal(inv.availableStock, 190);
    });

    await t.test("E2E Step 8: Super Admin Supply Chain Dashboard & Settlement Audit", async () => {
        const adminToken = app.jwt.sign({ role: "SUPER_ADMIN", userId: 1 });
        const dashRes = await app.inject({
            method: "GET",
            url: "/super-admin/supply/dashboard",
            headers: { authorization: `Bearer ${adminToken}` },
        });

        assert.equal(dashRes.statusCode, 200);
        const dashPayload = JSON.parse(dashRes.payload);
        assert.ok(dashPayload.suppliers?.total >= 1);
        assert.ok(dashPayload.products?.total >= 1);
        assert.ok(dashPayload.orders?.total >= 1);
    });
});
