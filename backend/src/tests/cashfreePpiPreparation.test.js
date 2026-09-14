import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import {
  getPpiBaseUrl,
  isPpiConfigured,
  getPpiConfigStatus,
  getPpiApiHeaders,
} from "../config/cashfreePpi.config.js";
import {
  createPpiUser,
  checkWalletEligibility,
  createWallet,
  getWalletDetails,
  getWalletStatement,
  creditWallet,
  debitWallet,
  refundWallet,
} from "../services/cashfreePpiService.js";
import ppiWalletRoutes from "../routes/ppiWallet.routes.js";

describe("Cashfree PPI Wallet Preparation Layer Tests", () => {
  test("1. Application and PPI Config start safely without PPI credentials", () => {
    assert.strictEqual(typeof getPpiBaseUrl(), "string");
    assert.strictEqual(getPpiBaseUrl(), "https://sandbox.cashfree.com/ppi");
    assert.strictEqual(isPpiConfigured(), false);
  });

  test("2. PPI Configuration status never exposes secrets or sensitive credentials", () => {
    const status = getPpiConfigStatus();
    assert.strictEqual(status.isConfigured, false);
    assert.strictEqual(status.env, "SANDBOX");
    assert.strictEqual(status.baseUrl, "https://sandbox.cashfree.com/ppi");
    assert.strictEqual(status.programId, "PENDING_TICKET_8374090");
    assert.strictEqual(status.clientIdMasked, "NOT_CONFIGURED");
    assert.ok(status.statusMessage.includes("8374090"));

    // Verify error thrown when headers requested without config
    assert.throws(
      () => getPpiApiHeaders(),
      /Cashfree PPI integration is not configured/
    );
  });

  test("3. PPI Service skeleton functions fail safely with controlled error when unconfigured", async () => {
    await assert.rejects(
      async () => createPpiUser({ phone: "9999999999", name: "Test User", email: "test@tiffzy.com" }),
      /Cashfree PPI integration is not configured/
    );

    await assert.rejects(
      async () => checkWalletEligibility({ phone: "9999999999" }),
      /Cashfree PPI integration is not configured/
    );

    await assert.rejects(
      async () => createWallet({ cashfreePpiUserId: "user_123" }),
      /Cashfree PPI integration is not configured/
    );

    await assert.rejects(
      async () => getWalletDetails({ cashfreeWalletId: "w_123" }),
      /Cashfree PPI integration is not configured/
    );

    await assert.rejects(
      async () => getWalletStatement({ cashfreeWalletId: "w_123" }),
      /Cashfree PPI integration is not configured/
    );

    await assert.rejects(
      async () => creditWallet({ cashfreeWalletId: "w_123", amount: 100 }),
      /Cashfree PPI integration is not configured/
    );

    await assert.rejects(
      async () => debitWallet({ cashfreeWalletId: "w_123", amount: 50, orderId: "1" }),
      /Cashfree PPI integration is not configured/
    );

    await assert.rejects(
      async () => refundWallet({ cashfreeWalletId: "w_123", amount: 50 }),
      /Cashfree PPI integration is not configured/
    );
  });

  test("4. PPI Routes reject unauthenticated requests and return 503 for unconfigured endpoints", async () => {
    const app = Fastify();
    await app.register(jwt, { secret: "test_jwt_secret_key_12345" });

    // Mock dependencies
    const deps = {
      prisma: {
        customerAccount: {
          findUnique: async () => null,
        },
      },
    };

    await ppiWalletRoutes(app, deps);
    await app.ready();

    // 4a. Status check endpoint (Public)
    const statusRes = await app.inject({
      method: "GET",
      url: "/api/v1/wallet/ppi/status",
    });
    assert.strictEqual(statusRes.statusCode, 200);
    const statusBody = JSON.parse(statusRes.body);
    assert.strictEqual(statusBody.success, true);
    assert.strictEqual(statusBody.ppiStatus.isConfigured, false);

    // 4b. Protected route without auth header -> 401 Unauthorized
    const unauthRes = await app.inject({
      method: "POST",
      url: "/api/v1/wallet/ppi/user",
      payload: { name: "Test" },
    });
    assert.strictEqual(unauthRes.statusCode, 401);

    // 4c. Protected route with valid customer JWT but unconfigured PPI -> 503 Service Unavailable
    const customerToken = app.jwt.sign({ customerAccountId: 99999, type: "customer" });

    // Mock prisma finding user
    deps.prisma.customerAccount.findUnique = async () => ({ id: 99999, name: "Test Customer", phone: "9876543210" });

    const ppiUserRes = await app.inject({
      method: "POST",
      url: "/api/v1/wallet/ppi/user",
      headers: {
        authorization: `Bearer ${customerToken}`,
      },
      payload: { name: "Test Customer" },
    });

    assert.strictEqual(ppiUserRes.statusCode, 503);
    const ppiUserBody = JSON.parse(ppiUserRes.body);
    assert.strictEqual(ppiUserBody.code, "PPI_NOT_CONFIGURED");
    assert.ok(ppiUserBody.message.includes("Ticket ID: 8374090"));
  });
});
