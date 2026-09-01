import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import supplierAuthRoutes from "../routes/supplierAuth.routes.js";
import prisma from "../prisma.js";

test("Phase 4 — Supplier Authentication Integration Tests", async (t) => {
    const app = Fastify();
    await app.register(jwt, { secret: "test_supplier_secret_key_123" });
    await supplierAuthRoutes(app);

    const testEmail = `supplier_${Date.now()}@tiffzytest.com`;
    const testPhone = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
    const testPassword = "Password123!";
    let testSupplierId = null;
    let testOtp = null;
    let accessToken = null;
    let refreshToken = null;

    t.after(async () => {
        if (testSupplierId) {
            await prisma.supplier.delete({ where: { id: testSupplierId } }).catch(() => {});
        }
        await prisma.authOtp.deleteMany({ where: { phone: testPhone } }).catch(() => {});
    });

    await t.test("POST /auth/supplier/register — should validate payload inputs", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/supplier/register",
            payload: { email: "invalid-email", phone: "123", password: "12" },
        });

        assert.equal(res.statusCode, 400);
        const payload = JSON.parse(res.payload);
        assert.ok(payload.error);
    });

    await t.test("POST /auth/supplier/register — should create supplier account & send OTP", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/supplier/register",
            payload: {
                email: testEmail,
                phone: testPhone,
                password: testPassword,
                businessName: "Tiffzy Quality Organic Foods",
            },
        });

        assert.equal(res.statusCode, 201);
        const payload = JSON.parse(res.payload);
        assert.ok(payload.supplierId);
        assert.equal(payload.email, testEmail);
        assert.ok(payload.otpDebug);
        testSupplierId = payload.supplierId;
        testOtp = payload.otpDebug;
    });

    await t.test("POST /auth/supplier/register — should reject duplicate registration", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/supplier/register",
            payload: {
                email: testEmail,
                phone: testPhone,
                password: testPassword,
                businessName: "Duplicate Foods",
            },
        });

        assert.equal(res.statusCode, 409);
    });

    await t.test("POST /auth/supplier/verify-otp — should reject invalid OTP", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/supplier/verify-otp",
            payload: { phone: testPhone, otp: "000000" },
        });

        assert.equal(res.statusCode, 400);
    });

    await t.test("POST /auth/supplier/verify-otp — should verify OTP and activate account", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/supplier/verify-otp",
            payload: { phone: testPhone, otp: testOtp },
        });

        assert.equal(res.statusCode, 200);
        const payload = JSON.parse(res.payload);
        assert.equal(payload.isVerified, true);
        assert.equal(payload.status, "ACTIVE");
    });

    await t.test("POST /auth/supplier/login — should authenticate supplier and return JWT", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/supplier/login",
            payload: { email: testEmail, password: testPassword },
        });

        assert.equal(res.statusCode, 200);
        const payload = JSON.parse(res.payload);
        assert.ok(payload.token);
        assert.ok(payload.refreshToken);
        assert.equal(payload.supplier.email, testEmail);
        assert.equal(payload.supplier.role, "SUPPLIER");
        accessToken = payload.token;
        refreshToken = payload.refreshToken;
    });

    await t.test("POST /auth/supplier/refresh — should issue new access token using refresh token", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/supplier/refresh",
            payload: { refreshToken },
        });

        assert.equal(res.statusCode, 200);
        const payload = JSON.parse(res.payload);
        assert.ok(payload.token);
    });

    await t.test("POST /auth/supplier/forgot-password — should send password reset OTP", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/supplier/forgot-password",
            payload: { phone: testPhone },
        });

        assert.equal(res.statusCode, 200);
        const payload = JSON.parse(res.payload);
        assert.ok(payload.otpDebug);
        testOtp = payload.otpDebug;
    });

    await t.test("POST /auth/supplier/reset-password — should reset supplier password", async () => {
        const newPassword = "NewSecretPassword2026!";
        const res = await app.inject({
            method: "POST",
            url: "/auth/supplier/reset-password",
            payload: { phone: testPhone, otp: testOtp, newPassword },
        });

        assert.equal(res.statusCode, 200);

        // Verify login with new password
        const loginRes = await app.inject({
            method: "POST",
            url: "/auth/supplier/login",
            payload: { email: testEmail, password: newPassword },
        });
        assert.equal(loginRes.statusCode, 200);
    });

    await t.test("POST /auth/supplier/logout — should logout supplier", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/supplier/logout",
            payload: { supplierId: testSupplierId },
        });

        assert.equal(res.statusCode, 200);
    });
});
