import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import paymentRoutes from "../routes/payment.routes.js";
import walletRoutes from "../routes/wallet.routes.js";
import {
  computeTwmSignature,
  verifyTwmSignature,
  normalizeTwmStatus,
  toPaise,
  fromPaise,
} from "../services/twmPay.service.js";
import { validateCreateOrderPayload } from "../middleware/paymentValidation.js";
import { getRuntimeConfig } from "../config.js";

/**
 * Stateful in-memory Prisma double tailored for Payment / Order / TableSession workflows.
 * Simulates atomic transactions, unique idempotency keys, and multi-tenant records deterministically.
 */
function createInMemoryPaymentPrisma() {
  let paymentSeq = 1;
  const restaurants = new Map([
    [1, { id: 1, slug: "cafe-alpha", name: "Cafe Alpha" }],
    [2, { id: 2, slug: "cafe-beta", name: "Cafe Beta" }],
  ]);

  const orders = new Map([
    [
      101,
      {
        id: 101,
        restaurantId: 1,
        orderNo: "ORD-101",
        invoiceNo: "INV-101",
        total: 249.5,
        subtotal: 249.5,
        status: "PLACED",
        paymentStatus: "UNPAID",
        paymentMode: null,
        paidAt: null,
        tableSessionId: null,
        fulfillment: "pickup",
        customerName: "Asha",
        phone: "9876543210",
        email: "asha@example.com",
      },
    ],
    [
      102,
      {
        id: 102,
        restaurantId: 2,
        orderNo: "ORD-102",
        invoiceNo: "INV-102",
        total: 500,
        subtotal: 500,
        status: "PLACED",
        paymentStatus: "UNPAID",
        paymentMode: null,
        paidAt: null,
        tableSessionId: null,
        fulfillment: "delivery",
        customerName: "Vikram",
        phone: "9123456789",
        email: "vikram@example.com",
      },
    ],
    [
      103,
      {
        id: 103,
        restaurantId: 1,
        orderNo: "ORD-103",
        invoiceNo: "INV-103",
        total: 100,
        subtotal: 100,
        status: "PLACED",
        paymentStatus: "PAID",
        paymentMode: "ONLINE",
        paidAt: new Date(),
        tableSessionId: null,
        fulfillment: "pickup",
        customerName: "Neha",
        phone: "9000000000",
        email: "neha@example.com",
      },
    ],
  ]);

  const payments = [];

  const enrichOrder = (o, include) => {
    if (!o) return null;
    const copy = { ...o };
    if (include?.restaurant) {
      copy.restaurant = restaurants.get(o.restaurantId) || null;
    }
    return copy;
  };

  const matchPayment = (p, where = {}) => {
    for (const [k, v] of Object.entries(where)) {
      if (v && typeof v === "object" && Array.isArray(v.in)) {
        if (!v.in.includes(p[k])) return false;
      } else if (v && typeof v === "object" && v.gt !== undefined) {
        if (!(p[k] > v.gt)) return false;
      } else if (p[k] !== v) {
        return false;
      }
    }
    return true;
  };

  const db = {
    $queryRaw: async () => [{ ok: 1 }],
    order: {
      findUnique: async ({ where, include } = {}) => {
        return enrichOrder(orders.get(where.id) || null, include);
      },
      findFirst: async ({ where, include } = {}) => {
        for (const o of orders.values()) {
          if (Array.isArray(where?.OR)) {
            if (where.OR.some((cond) => Object.entries(cond).every(([k, v]) => o[k] === v))) {
              return enrichOrder(o, include);
            }
          } else if (Object.entries(where || {}).every(([k, v]) => o[k] === v)) {
            return enrichOrder(o, include);
          }
        }
        return null;
      },
      update: async ({ where, data, include } = {}) => {
        const existing = orders.get(where.id);
        if (!existing) throw new Error(`Order ${where.id} not found`);
        const updated = { ...existing, ...data };
        orders.set(where.id, updated);
        return enrichOrder(updated, include);
      },
    },
    payment: {
      findUnique: async ({ where } = {}) => {
        if (where.id !== undefined) return payments.find((p) => p.id === where.id) || null;
        if (where.idempotencyKey !== undefined) {
          return payments.find((p) => p.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      },
      findFirst: async ({ where, orderBy } = {}) => {
        const matches = payments.filter((p) => matchPayment(p, where));
        if (orderBy?.id === "desc") matches.sort((a, b) => b.id - a.id);
        return matches[0] ? { ...matches[0] } : null;
      },
      findMany: async ({ where, orderBy } = {}) => {
        const matches = payments.filter((p) => matchPayment(p, where));
        if (orderBy?.id === "desc") matches.sort((a, b) => b.id - a.id);
        return matches.map((m) => ({ ...m }));
      },
      create: async ({ data } = {}) => {
        if (data.idempotencyKey && payments.some((p) => p.idempotencyKey === data.idempotencyKey)) {
          throw new Error("Unique constraint failed on idempotencyKey");
        }
        const row = {
          id: paymentSeq++,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        payments.push(row);
        return { ...row };
      },
      update: async ({ where, data } = {}) => {
        const idx = payments.findIndex((p) => p.id === where.id);
        if (idx === -1) throw new Error(`Payment ${where.id} not found`);
        payments[idx] = { ...payments[idx], ...data, updatedAt: new Date() };
        return { ...payments[idx] };
      },
    },
    _orders: orders,
    _payments: payments,
  };

  db.$transaction = async (fn) => fn(db);
  return db;
}

describe("TWM Pay Payment Gateway Integration Suite", () => {
  const TEST_MERCHANT = "twm_test_merchant_01";
  const TEST_SECRET = "twm_test_secret_xyz_987";
  const TEST_SIGNING_KEY = "twm_test_signing_key_hmac_123";
  const TEST_URL = "https://mock-twm.example.test";

  let origEnv;

  before(() => {
    origEnv = {
      TWM_MERCHANT_ID: process.env.TWM_MERCHANT_ID,
      TWM_API_SECRET: process.env.TWM_API_SECRET,
      TWM_SIGNING_KEY: process.env.TWM_SIGNING_KEY,
      TWM_URL: process.env.TWM_URL,
      TWM_ENABLED: process.env.TWM_ENABLED,
    };
  });

  after(() => {
    for (const [k, v] of Object.entries(origEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  beforeEach(() => {
    process.env.TWM_MERCHANT_ID = TEST_MERCHANT;
    process.env.TWM_API_SECRET = TEST_SECRET;
    process.env.TWM_SIGNING_KEY = TEST_SIGNING_KEY;
    process.env.TWM_URL = TEST_URL;
    process.env.TWM_ENABLED = "true";
  });

  it("1. Crypto & Status Mapping: computes exact HMAC-SHA256 hex signature and rejects tampering", () => {
    assert.equal(toPaise(249.5), 24950);
    assert.equal(fromPaise(24950), 249.5);

    const payload = {
      order_ref: "TWM_1_101_1_ORD_101",
      status: "paid",
      amount_paise: "24950",
      txn: "UTR123456789",
    };
    const sig = computeTwmSignature(payload);
    assert.equal(sig.length, 64);

    assert.equal(verifyTwmSignature({ ...payload, signature: sig }), true);
    // Tampering attempts
    assert.equal(verifyTwmSignature({ ...payload, status: "paid", amount_paise: "100", signature: sig }), false);
    assert.equal(verifyTwmSignature({ ...payload, txn: "OTHER_TXN", signature: sig }), false);
    assert.equal(verifyTwmSignature({ ...payload, order_ref: "OTHER_REF", signature: sig }), false);
    assert.equal(verifyTwmSignature({ ...payload, signature: "a".repeat(64) }), false);
    assert.equal(verifyTwmSignature({ ...payload, signature: "short" }), false);
    assert.equal(verifyTwmSignature({ order_ref: "x", status: "paid", amount_paise: "100" }), false);

    assert.equal(normalizeTwmStatus("paid").paymentStatus, "PAID");
    assert.equal(normalizeTwmStatus("utr_submitted").paymentStatus, "PENDING");
    assert.equal(normalizeTwmStatus("utr_submitted").gatewayStatus, "UTR_SUBMITTED");
    assert.equal(normalizeTwmStatus("rejected").paymentStatus, "FAILED");
    assert.equal(normalizeTwmStatus("expired").paymentStatus, "FAILED");
    assert.equal(normalizeTwmStatus("created").gatewayStatus, "CREATED");
  });

  it("2. Security & Secret Isolation: fails safely when unconfigured and never exposes secrets in health/providers", async () => {
    delete process.env.TWM_API_SECRET;
    delete process.env.TWM_SIGNING_KEY;

    const prisma = createInMemoryPaymentPrisma();
    const app = Fastify({ logger: false });
    await app.register(paymentRoutes, { prisma });

    const healthRes = await app.inject({ method: "GET", url: "/api/payments/health" });
    assert.equal(healthRes.statusCode, 200);
    assert.equal(healthRes.body.includes(TEST_SECRET), false);
    assert.equal(healthRes.body.includes(TEST_SIGNING_KEY), false);

    const providersRes = await app.inject({ method: "GET", url: "/api/payments/providers" });
    assert.equal(providersRes.statusCode, 200);
    const providersBody = providersRes.json();
    assert.equal(providersBody.twmPay.configured, false);
    assert.equal(providersRes.body.includes(TEST_SECRET), false);

    const createRes = await app.inject({
      method: "POST",
      url: "/api/payments/create-order",
      payload: { orderId: "101", provider: "TWM_PAY" },
    });
    assert.equal(createRes.statusCode, 503);
    assert.equal(createRes.json().code, "TWM_NOT_CONFIGURED");
    await app.close();
  });

  it("3. Checkout Creation & Authoritative Paise + Idempotency + Retry OrderRef Uniqueness", async () => {
    const prisma = createInMemoryPaymentPrisma();
    const gatewayCalls = [];
    const mockFetch = async (url, opts) => {
      gatewayCalls.push({ url, opts, body: JSON.parse(opts.body) });
      const parsed = JSON.parse(opts.body);
      return new Response(
        JSON.stringify({
          order_ref: parsed.order_ref,
          amount_paise: parsed.amount_paise,
          checkout_url: `https://pay.thewebsitemakers.in/checkout/${parsed.order_ref}`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const app = Fastify({ logger: false });
    await app.register(paymentRoutes, { prisma, fetchImpl: mockFetch });

    // Attacker tries sending tampered amount=1 on ₹249.50 order 101
    const res1 = await app.inject({
      method: "POST",
      url: "/api/payments/create-order",
      headers: { origin: "https://www.tiffzy.com" },
      payload: {
        orderId: "101",
        amount: 1,
        provider: "TWM_PAY",
        idempotencyKey: "idem-key-1",
      },
    });

    assert.equal(res1.statusCode, 200);
    const body1 = res1.json();
    assert.equal(body1.provider, "TWM_PAY");
    assert.equal(body1.amountPaise, 24950);
    assert.equal(gatewayCalls.length, 1);
    assert.equal(gatewayCalls[0].opts.headers["X-TWM-Merchant"], TEST_MERCHANT);
    assert.equal(gatewayCalls[0].opts.headers["X-TWM-Secret"], TEST_SECRET);
    assert.equal(gatewayCalls[0].body.amount_paise, 24950);
    assert.equal(gatewayCalls[0].body.return_url, "https://www.tiffzy.com/payment-status");
    assert.ok(body1.checkoutUrl.startsWith("https://pay.thewebsitemakers.in/checkout/"));

    // Duplicate click / same idempotencyKey reuses session without creating a second TWM order
    const resDup = await app.inject({
      method: "POST",
      url: "/api/payments/create-order",
      payload: {
        orderId: "101",
        provider: "TWM_PAY",
        idempotencyKey: "idem-key-1",
      },
    });
    assert.equal(resDup.statusCode, 200);
    assert.equal(resDup.json().idempotentReplay, true);
    assert.equal(resDup.json().orderRef, body1.orderRef);
    assert.equal(gatewayCalls.length, 1);

    // Simulate previous attempt expiring -> next attempt creates a fresh unique order_ref
    const expSig = computeTwmSignature({
      order_ref: body1.orderRef,
      status: "expired",
      amount_paise: "24950",
      txn: "",
    });
    await app.inject({
      method: "POST",
      url: "/api/payments/twm/notify",
      payload: {
        order_ref: body1.orderRef,
        status: "expired",
        amount_paise: "24950",
        txn: "",
        signature: expSig,
      },
    });

    const resRetry = await app.inject({
      method: "POST",
      url: "/api/payments/create-order",
      payload: {
        orderId: "101",
        provider: "TWM_PAY",
        idempotencyKey: "idem-key-2",
      },
    });
    assert.equal(resRetry.statusCode, 200);
    assert.notEqual(resRetry.json().orderRef, body1.orderRef);
    assert.equal(gatewayCalls.length, 2);

    // Already paid order 103 cannot create a new TWM checkout
    const paidAttempt = await app.inject({
      method: "POST",
      url: "/api/payments/create-order",
      payload: { orderId: "103", provider: "TWM_PAY" },
    });
    assert.equal(paidAttempt.statusCode, 409);
    assert.equal(paidAttempt.json().code, "ORDER_ALREADY_PAID");

    await app.close();
  });

  it("4. Return Verification, UTR Pending Lifecycle, Reconciliation & Non-Downgrade Protection", async () => {
    const prisma = createInMemoryPaymentPrisma();
    let remoteStatus = "utr_submitted";
    let remoteTxn = "UTR998877";
    let remoteAmountPaise = 24950;
    const emittedEvents = [];

    const mockFetch = async (url) => {
      if (url.includes("/api/create-order.php")) {
        return new Response(
          JSON.stringify({
            order_ref: "TWM_1_101_1_ORD_101",
            amount_paise: 24950,
            checkout_url: "https://pay.thewebsitemakers.in/checkout/TWM_1_101_1_ORD_101",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/order-status.php")) {
        return new Response(
          JSON.stringify({
            order_ref: "TWM_1_101_1_ORD_101",
            status: remoteStatus,
            amount_paise: remoteAmountPaise,
            txn: remoteTxn,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 404 });
    };

    const app = Fastify({ logger: false });
    app.decorate("realtime", {
      io: {
        to: (room) => ({
          emit: (evt, payload) => emittedEvents.push({ channel: "io", room, evt, payload }),
        }),
      },
      staff: {
        to: (room) => ({
          emit: (evt, payload) => emittedEvents.push({ channel: "staff", room, evt, payload }),
        }),
      },
    });
    await app.register(paymentRoutes, { prisma, fetchImpl: mockFetch });

    const createRes = await app.inject({
      method: "POST",
      url: "/api/payments/twm/create-order",
      payload: { orderId: "101" },
    });
    const { orderRef } = createRes.json();

    // Tampered return signature MUST fail with 400 and NEVER mark order paid
    const forgedReturn = await app.inject({
      method: "POST",
      url: "/api/payments/twm/return",
      payload: {
        order_ref: orderRef,
        status: "paid",
        amount_paise: "24950",
        txn: "FORGED",
        signature: "f".repeat(64),
      },
    });
    assert.equal(forgedReturn.statusCode, 400);
    assert.equal(prisma._orders.get(101).paymentStatus, "UNPAID");

    // Wrong amount in paise even with valid signature MUST fail with 400
    const badAmtSig = computeTwmSignature({
      order_ref: orderRef,
      status: "paid",
      amount_paise: "100",
      txn: "UTR1",
    });
    const wrongAmtReturn = await app.inject({
      method: "POST",
      url: "/api/payments/twm/return",
      payload: {
        order_ref: orderRef,
        status: "paid",
        amount_paise: "100",
        txn: "UTR1",
        signature: badAmtSig,
      },
    });
    assert.equal(wrongAmtReturn.statusCode, 400);
    assert.equal(wrongAmtReturn.json().error, "AMOUNT_MISMATCH");

    // Valid utr_submitted return keeps order PENDING (NOT PAID!)
    const utrSig = computeTwmSignature({
      order_ref: orderRef,
      status: "utr_submitted",
      amount_paise: "24950",
      txn: "UTR998877",
    });
    const utrReturn = await app.inject({
      method: "POST",
      url: "/api/payments/twm/return",
      payload: {
        order_ref: orderRef,
        status: "utr_submitted",
        amount_paise: "24950",
        txn: "UTR998877",
        signature: utrSig,
      },
    });
    assert.equal(utrReturn.statusCode, 200);
    assert.equal(utrReturn.json().paymentStatus, "PENDING");
    assert.equal(utrReturn.json().gatewayStatus, "UTR_SUBMITTED");
    assert.equal(utrReturn.json().verified, false);
    assert.equal(prisma._orders.get(101).paymentStatus, "PENDING");

    // Attempting duplicate checkout while UTR_SUBMITTED is pending returns 409 conflict
    const blockedRetry = await app.inject({
      method: "POST",
      url: "/api/payments/twm/create-order",
      payload: { orderId: "101" },
    });
    assert.equal(blockedRetry.statusCode, 409);
    assert.equal(blockedRetry.json().code, "PAYMENT_VERIFICATION_PENDING");

    // Reconciliation polls order-status.php -> gateway now confirms "paid"
    remoteStatus = "paid";
    const statusRes = await app.inject({
      method: "GET",
      url: "/api/payments/status/101",
    });
    assert.equal(statusRes.statusCode, 200);
    assert.equal(statusRes.json().verified, true);
    assert.equal(statusRes.json().paymentStatus, "PAID");
    assert.equal(statusRes.json().gatewayStatus, "PAID");
    assert.equal(prisma._orders.get(101).paymentStatus, "PAID");
    assert.equal(prisma._orders.get(101).paymentMode, "ONLINE");
    assert.equal(prisma._payments[0].status, "SUCCESS");
    assert.ok(emittedEvents.some((e) => e.evt === "payment:updated" && e.payload.paymentStatus === "PAID"));

    // Duplicate + late rejected webhook NEVER downgrades a PAID order!
    const lateRejectedSig = computeTwmSignature({
      order_ref: orderRef,
      status: "rejected",
      amount_paise: "24950",
      txn: "UTR998877",
    });
    const lateWebhook = await app.inject({
      method: "POST",
      url: "/api/payments/twm/notify",
      payload: {
        order_ref: orderRef,
        status: "rejected",
        amount_paise: "24950",
        txn: "UTR998877",
        signature: lateRejectedSig,
      },
    });
    assert.equal(lateWebhook.statusCode, 200);
    assert.equal(lateWebhook.json().alreadyPaid, true);
    assert.equal(lateWebhook.json().paymentStatus, "PAID");
    assert.equal(prisma._orders.get(101).paymentStatus, "PAID");
    assert.equal(prisma._payments[0].status, "SUCCESS");

    await app.close();
  });

  it("5. Webhook HTTP Semantics (400/404/200), Form-UrlEncoded & Multi-Tenant Isolation", async () => {
    const prisma = createInMemoryPaymentPrisma();
    const mockFetch = async () =>
      new Response(
        JSON.stringify({ checkout_url: "https://pay.thewebsitemakers.in/checkout/TWM_1_101_1_ORD_101" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    const app = Fastify({ logger: false });
    await app.register(paymentRoutes, { prisma, fetchImpl: mockFetch });

    // Cross-tenant attempt: Restaurant 2 slug tries creating checkout for Restaurant 1's order 101
    const crossTenantCreate = await app.inject({
      method: "POST",
      url: "/r/cafe-beta/payments/create-order",
      payload: { orderId: "101", provider: "TWM_PAY" },
    });
    assert.equal(crossTenantCreate.statusCode, 403);

    const createRes = await app.inject({
      method: "POST",
      url: "/r/cafe-alpha/payments/create-order",
      payload: { orderId: "101", provider: "TWM_PAY" },
    });
    assert.equal(createRes.statusCode, 200);
    const { orderRef } = createRes.json();

    // Cross-tenant status query fails with 403
    const crossTenantStatus = await app.inject({
      method: "GET",
      url: "/api/payments/twm/status/101?restaurantId=2",
    });
    assert.equal(crossTenantStatus.statusCode, 403);

    // Notify unknown order_ref returns 404
    const unknownSig = computeTwmSignature({
      order_ref: "UNKNOWN_REF",
      status: "paid",
      amount_paise: "24950",
      txn: "TX1",
    });
    const notify404 = await app.inject({
      method: "POST",
      url: "/api/payments/twm/notify",
      payload: { order_ref: "UNKNOWN_REF", status: "paid", amount_paise: "24950", txn: "TX1", signature: unknownSig },
    });
    assert.equal(notify404.statusCode, 404);

    // Notify with invalid signature returns 400
    const notify400 = await app.inject({
      method: "POST",
      url: "/api/payments/twm/notify",
      payload: { order_ref: orderRef, status: "paid", amount_paise: "24950", txn: "TX1", signature: "0".repeat(64) },
    });
    assert.equal(notify400.statusCode, 400);

    // Valid application/x-www-form-urlencoded notify works cleanly (200)
    const validSig = computeTwmSignature({
      order_ref: orderRef,
      status: "paid",
      amount_paise: "24950",
      txn: "TX_FORM_1",
    });
    const formBody = new URLSearchParams({
      order_ref: orderRef,
      status: "paid",
      amount_paise: "24950",
      txn: "TX_FORM_1",
      signature: validSig,
    }).toString();

    const notifyFormOk = await app.inject({
      method: "POST",
      url: "/api/payments/twm/notify",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: formBody,
    });
    assert.equal(notifyFormOk.statusCode, 200);
    assert.equal(notifyFormOk.json().paymentStatus, "PAID");
    assert.equal(prisma._orders.get(101).paymentStatus, "PAID");

    await app.close();
  });

  it("6. Regression: Default provider remains CASHFREE when provider param is omitted", () => {
    const defaultValidation = validateCreateOrderPayload({ orderId: "99", amount: 150 });
    assert.equal(defaultValidation.isValid, true);
    assert.equal(defaultValidation.data.provider, "CASHFREE");

    const twmValidation = validateCreateOrderPayload({ orderId: "99", provider: "twm_pay" });
    assert.equal(twmValidation.isValid, true);
    assert.equal(twmValidation.data.provider, "TWM_PAY");
  });

  it("7. Runtime CORS pattern config compiles Vercel Preview wildcard origins for staging", () => {
    const prev = {
      DATABASE_URL: process.env.DATABASE_URL,
      JWT_SECRET: process.env.JWT_SECRET,
      FRONTEND_URL: process.env.FRONTEND_URL,
      CORS_ORIGINS: process.env.CORS_ORIGINS,
      CORS_ORIGIN_PATTERNS: process.env.CORS_ORIGIN_PATTERNS,
    };
    try {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/tiffzy_staging";
      process.env.JWT_SECRET = "staging_secret_value";
      process.env.FRONTEND_URL = "https://cafe-system-git-feature-twm-p-ebc5a0-anilchowdary4531s-projects.vercel.app";
      process.env.CORS_ORIGINS = "http://localhost:5173";
      process.env.CORS_ORIGIN_PATTERNS = "https://cafe-system-*.vercel.app";

      const cfg = getRuntimeConfig();
      assert.equal(cfg.CORS_ORIGIN_PATTERNS.length, 1);
      assert.equal(
        cfg.CORS_ORIGIN_PATTERNS[0].test("https://cafe-system-3ttgzslpf-anilchowdary4531s-projects.vercel.app"),
        true
      );
      assert.equal(cfg.CORS_ORIGIN_PATTERNS[0].test("https://evil-vercel.app"), false);
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it("8. Handles CREATED, REJECTED, EXPIRED, Same-Key Retry After Failure/Amount Change, and Prevents Stale Downgrades", async () => {
    const prisma = createInMemoryPaymentPrisma();
    const gatewayCalls = [];
    const mockFetch = async (_url, opts) => {
      const parsed = JSON.parse(opts.body);
      gatewayCalls.push(parsed);
      return new Response(
        JSON.stringify({
          order_ref: parsed.order_ref,
          amount_paise: parsed.amount_paise,
          checkout_url: `https://pay.thewebsitemakers.in/checkout/${parsed.order_ref}`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const app = Fastify({ logger: false });
    await app.register(paymentRoutes, { prisma, fetchImpl: mockFetch });

    // Create initial checkout with explicit client idempotencyKey on order 101 (₹249.50 = 24950 paise)
    const create1 = await app.inject({
      method: "POST",
      url: "/api/payments/create-order",
      payload: {
        orderId: "101",
        provider: "TWM_PAY",
        idempotencyKey: "client-retry-key",
      },
    });
    assert.equal(create1.statusCode, 200);
    const ref1 = create1.json().orderRef;

    // CREATED status webhook keeps order PENDING and never marks PAID
    const createdSig = computeTwmSignature({
      order_ref: ref1,
      status: "created",
      amount_paise: "24950",
      txn: "",
    });
    const createdRes = await app.inject({
      method: "POST",
      url: "/api/payments/twm/notify",
      payload: { order_ref: ref1, status: "created", amount_paise: "24950", txn: "", signature: createdSig },
    });
    assert.equal(createdRes.statusCode, 200);
    assert.equal(createdRes.json().verified, false);
    assert.equal(createdRes.json().paymentStatus, "PENDING");
    assert.equal(createdRes.json().gatewayStatus, "CREATED");
    assert.equal(prisma._orders.get(101).paymentStatus, "UNPAID");

    // REJECTED return marks order & payment FAILED, populates reason + slug, and never marks PAID
    const rejectedSig = computeTwmSignature({
      order_ref: ref1,
      status: "rejected",
      amount_paise: "24950",
      txn: "TX_REJ_1",
    });
    const rejectedRes = await app.inject({
      method: "POST",
      url: "/api/payments/twm/return",
      payload: {
        order_ref: ref1,
        status: "rejected",
        amount_paise: "24950",
        txn: "TX_REJ_1",
        signature: rejectedSig,
      },
    });
    assert.equal(rejectedRes.statusCode, 200);
    const rejBody = rejectedRes.json();
    assert.equal(rejBody.verified, false);
    assert.equal(rejBody.paymentStatus, "FAILED");
    assert.equal(rejBody.gatewayStatus, "REJECTED");
    assert.equal(rejBody.slug, "cafe-alpha");
    assert.ok(rejBody.reason && rejBody.reason.toLowerCase().includes("rejected"));
    assert.equal(prisma._orders.get(101).paymentStatus, "FAILED");

    // Out-of-order delayed 'created' webhook CANNOT downgrade REJECTED back to CREATED
    const staleCreatedOnFailed = await app.inject({
      method: "POST",
      url: "/api/payments/twm/notify",
      payload: { order_ref: ref1, status: "created", amount_paise: "24950", txn: "", signature: createdSig },
    });
    assert.equal(staleCreatedOnFailed.statusCode, 200);
    assert.equal(staleCreatedOnFailed.json().paymentStatus, "FAILED");
    assert.equal(staleCreatedOnFailed.json().gatewayStatus, "REJECTED");

    // Retrying with the SAME idempotencyKey after REJECTED must NOT throw unique constraint 500
    const retrySameKey = await app.inject({
      method: "POST",
      url: "/api/payments/create-order",
      payload: {
        orderId: "101",
        provider: "TWM_PAY",
        idempotencyKey: "client-retry-key",
      },
    });
    assert.equal(retrySameKey.statusCode, 200);
    const ref2 = retrySameKey.json().orderRef;
    assert.notEqual(ref2, ref1);
    assert.equal(prisma._orders.get(101).paymentStatus, "PENDING");

    // UTR_SUBMITTED cannot be downgraded back to CREATED by an out-of-order webhook
    const utrSig2 = computeTwmSignature({
      order_ref: ref2,
      status: "utr_submitted",
      amount_paise: "24950",
      txn: "UTR222",
    });
    await app.inject({
      method: "POST",
      url: "/api/payments/twm/notify",
      payload: { order_ref: ref2, status: "utr_submitted", amount_paise: "24950", txn: "UTR222", signature: utrSig2 },
    });
    const createdSig2 = computeTwmSignature({
      order_ref: ref2,
      status: "created",
      amount_paise: "24950",
      txn: "",
    });
    const staleCreatedOnUtr = await app.inject({
      method: "POST",
      url: "/api/payments/twm/notify",
      payload: { order_ref: ref2, status: "created", amount_paise: "24950", txn: "", signature: createdSig2 },
    });
    assert.equal(staleCreatedOnUtr.statusCode, 200);
    assert.equal(staleCreatedOnUtr.json().gatewayStatus, "UTR_SUBMITTED");
    assert.equal(staleCreatedOnUtr.json().paymentStatus, "PENDING");

    // Amount mutation between retries invalidates same-idempotencyKey replay on order 102 (₹500 -> ₹600)
    const ord102Create1 = await app.inject({
      method: "POST",
      url: "/api/payments/create-order",
      payload: { orderId: "102", provider: "TWM_PAY", idempotencyKey: "ord102-key" },
    });
    assert.equal(ord102Create1.statusCode, 200);
    assert.equal(ord102Create1.json().amountPaise, 50000);

    const updatedOrder102 = { ...prisma._orders.get(102), total: 600, subtotal: 600 };
    prisma._orders.set(102, updatedOrder102);

    const ord102Create2 = await app.inject({
      method: "POST",
      url: "/api/payments/create-order",
      payload: { orderId: "102", provider: "TWM_PAY", idempotencyKey: "ord102-key" },
    });
    assert.equal(ord102Create2.statusCode, 200);
    assert.equal(ord102Create2.json().amountPaise, 60000);
    assert.notEqual(ord102Create2.json().orderRef, ord102Create1.json().orderRef);

    await app.close();
  });

  it("9. Regression: Cashfree orders preserve existing status verification without misrouting to TWM Pay", async () => {
    const prisma = createInMemoryPaymentPrisma();
    await prisma.payment.create({
      data: {
        orderId: 102,
        restaurantId: 2,
        provider: "CASHFREE",
        providerOrderId: "CF_ORD_102",
        amount: 500,
        amountSubunit: 50000,
        currency: "INR",
        status: "PENDING",
        method: "ONLINE",
      },
    });

    const app = Fastify({ logger: false });
    await app.register(paymentRoutes, { prisma });

    // Cashfree paid order 103 continues to return verified SUCCESS without invoking TWM Pay
    const paidRes = await app.inject({ method: "GET", url: "/api/payments/cashfree/status/103" });
    assert.equal(paidRes.statusCode, 200);
    assert.equal(paidRes.json().verified, true);
    assert.equal(paidRes.json().paymentStatus, "PAID");

    // Pending Cashfree order 102 stays on Cashfree path and never throws TWM PAYMENT_SESSION_NOT_FOUND
    const pendingRes = await app.inject({ method: "GET", url: "/api/payments/status/102" });
    assert.equal(pendingRes.statusCode, 200);
    assert.equal(pendingRes.json().verified, false);
    assert.notEqual(pendingRes.json().code, "PAYMENT_SESSION_NOT_FOUND");

    await app.close();
  });

  it("10. Wallet Top-Up via TWM Pay converts paise accurately, handles all statuses, and credits atomically once", async () => {
    let topupSeq = 1;
    let ledgerSeq = 1;
    const customerAccount = { id: 77, name: "Rohan", phone: "9988776655", email: "rohan@test.com" };
    const walletRow = { id: 9, customerAccountId: 77, balance: 100, currency: "INR", status: "ACTIVE" };
    const topups = [];
    const ledger = [];

    const walletPrisma = {
      customerAccount: {
        findUnique: async ({ where } = {}) => (where?.id === 77 ? { ...customerAccount } : null),
      },
      wallet: {
        findUnique: async ({ where } = {}) =>
          where?.id === 9 || where?.customerAccountId === 77 ? { ...walletRow } : null,
        update: async ({ where, data } = {}) => {
          if (where?.id !== 9) throw new Error("Wallet not found");
          Object.assign(walletRow, data);
          return { ...walletRow };
        },
      },
      walletTopup: {
        findUnique: async ({ where } = {}) => {
          if (where?.topupTxnId) {
            const m = topups.find((t) => t.topupTxnId === where.topupTxnId);
            return m ? { ...m, wallet: { ...walletRow } } : null;
          }
          if (where?.idempotencyKey) {
            const m = topups.find((t) => t.idempotencyKey === where.idempotencyKey);
            return m ? { ...m, wallet: { ...walletRow } } : null;
          }
          return null;
        },
        findFirst: async ({ where } = {}) => {
          const matches = topups
            .filter((t) => !where?.gatewayOrderId || t.gatewayOrderId === where.gatewayOrderId)
            .sort((a, b) => b.id - a.id);
          return matches[0] ? { ...matches[0], wallet: { ...walletRow } } : null;
        },
        create: async ({ data } = {}) => {
          if (data.idempotencyKey && topups.some((t) => t.idempotencyKey === data.idempotencyKey)) {
            throw new Error("Unique idempotencyKey conflict");
          }
          const row = { id: topupSeq++, ...data };
          topups.push(row);
          return { ...row };
        },
        update: async ({ where, data } = {}) => {
          const target = topups.find((t) => t.id === where?.id);
          if (!target) throw new Error("Topup not found");
          Object.assign(target, data);
          return { ...target };
        },
        updateMany: async ({ where, data } = {}) => {
          let count = 0;
          for (const t of topups) {
            const idOk = where?.id === undefined || t.id === where.id;
            const notStatusOk = !where?.status?.not || t.status !== where.status.not;
            if (idOk && notStatusOk) {
              Object.assign(t, data);
              count += 1;
            }
          }
          return { count };
        },
      },
      walletLedger: {
        create: async ({ data } = {}) => {
          if (data.idempotencyKey && ledger.some((l) => l.idempotencyKey === data.idempotencyKey)) {
            throw new Error("Duplicate ledger entry blocked");
          }
          const row = { id: ledgerSeq++, ...data };
          ledger.push(row);
          return { ...row };
        },
      },
      $transaction: async (fn) => fn(walletPrisma),
    };

    const gatewayCalls = [];
    let expectedCreatePaise = 25050;
    let gatewayStatusPayload = { status: "utr_submitted", amount_paise: 25050, txn: "UTR_WALLET_1" };
    const mockFetch = async (url, init = {}) => {
      gatewayCalls.push({ url, init });
      if (url.includes("/api/create-order.php")) {
        const body = JSON.parse(init.body);
        assert.equal(body.amount_paise, expectedCreatePaise);
        assert.equal(init.headers["X-TWM-Merchant"], process.env.TWM_MERCHANT_ID);
        assert.equal(init.headers["X-TWM-Secret"], process.env.TWM_API_SECRET);
        return new Response(
          JSON.stringify({
            order_ref: body.order_ref,
            checkout_url: `https://pay.thewebsitemakers.in/checkout/${body.order_ref}`,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/order-status.php")) {
        const parsed = new URL(url);
        return new Response(
          JSON.stringify({
            order_ref: parsed.searchParams.get("order_ref"),
            ...gatewayStatusPayload,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const app = Fastify({ logger: false });
    await app.register(fastifyJwt, { secret: "test_jwt_secret" });
    await app.register(paymentRoutes, { prisma: walletPrisma, fetchImpl: mockFetch });
    await app.register(walletRoutes, { prisma: walletPrisma, fetchImpl: mockFetch });
    const customerJwt = app.jwt.sign({ customerAccountId: 77 });

    // 1) Create TWM Pay wallet top-up for ₹250.50 -> 25050 paise
    const createRes = await app.inject({
      method: "POST",
      url: "/api/wallet/topup/create",
      headers: { Authorization: `Bearer ${customerJwt}` },
      payload: { amount: 250.5, provider: "TWM_PAY" },
    });
    assert.equal(createRes.statusCode, 200);
    const createdJson = createRes.json();
    assert.equal(createdJson.provider, "TWM_PAY");
    assert.equal(createdJson.amountPaise, 25050);
    assert.ok(createdJson.topupTxnId.startsWith("TOPUP_9_"));
    assert.ok(createdJson.checkoutUrl.includes(createdJson.topupTxnId));

    const ref = createdJson.topupTxnId;

    // 2) Tampered amount on return fails verification without crediting
    const badAmountSig = computeTwmSignature({
      order_ref: ref,
      status: "paid",
      amount_paise: "100",
      txn: "UTR_BAD",
    });
    const badRes = await app.inject({
      method: "POST",
      url: "/api/wallet/topup/twm/return",
      headers: { Authorization: `Bearer ${customerJwt}` },
      payload: { order_ref: ref, status: "paid", amount_paise: "100", txn: "UTR_BAD", signature: badAmountSig },
    });
    assert.equal(badRes.statusCode, 400);
    assert.equal(walletRow.balance, 100);

    // 3) Polling when UTR_SUBMITTED leaves wallet at ₹100
    const pendingRes = await app.inject({
      method: "GET",
      url: `/api/wallet/topup/twm/status/${ref}`,
      headers: { Authorization: `Bearer ${customerJwt}` },
    });
    assert.equal(pendingRes.statusCode, 200);
    assert.equal(pendingRes.json().gatewayStatus, "UTR_SUBMITTED");
    assert.equal(pendingRes.json().paymentStatus, "PENDING");
    assert.equal(walletRow.balance, 100);

    // 4) Signed PAID return credits wallet to ₹350.50 with 1 ledger row
    const paidSig = computeTwmSignature({
      order_ref: ref,
      status: "paid",
      amount_paise: "25050",
      txn: "UTR_WALLET_PAID",
    });
    const paidReturnRes = await app.inject({
      method: "POST",
      url: "/api/wallet/topup/twm/return",
      headers: { Authorization: `Bearer ${customerJwt}` },
      payload: {
        order_ref: ref,
        status: "paid",
        amount_paise: "25050",
        txn: "UTR_WALLET_PAID",
        signature: paidSig,
      },
    });
    assert.equal(paidReturnRes.statusCode, 200);
    assert.equal(paidReturnRes.json().paymentStatus, "PAID");
    assert.equal(paidReturnRes.json().balance, 350.5);
    assert.equal(walletRow.balance, 350.5);
    assert.equal(ledger.length, 1);

    // 5) Duplicate webhook via unified /api/payments/twm/notify is idempotent (no double credit)
    const dupNotify = await app.inject({
      method: "POST",
      url: "/api/payments/twm/notify",
      payload: `order_ref=${encodeURIComponent(ref)}&status=paid&amount_paise=25050&txn=UTR_WALLET_PAID&signature=${paidSig}`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    assert.equal(dupNotify.statusCode, 200);
    assert.equal(dupNotify.json().ok, true);
    assert.equal(dupNotify.json().alreadyProcessed, true);
    assert.equal(walletRow.balance, 350.5);
    assert.equal(ledger.length, 1);

    // 6) Expired session marks second topup FAILED with zero credit
    expectedCreatePaise = 15000;
    const createRes2 = await app.inject({
      method: "POST",
      url: "/api/wallet/topup/twm/create",
      headers: { Authorization: `Bearer ${customerJwt}` },
      payload: { amount: 150 },
    });
    assert.equal(createRes2.statusCode, 200);
    const ref2 = createRes2.json().topupTxnId;
    gatewayStatusPayload = { status: "expired", amount_paise: 15000, txn: "" };
    const expiredStatus = await app.inject({
      method: "GET",
      url: `/api/wallet/topup/twm/status/${ref2}`,
      headers: { Authorization: `Bearer ${customerJwt}` },
    });
    assert.equal(expiredStatus.statusCode, 200);
    assert.equal(expiredStatus.json().gatewayStatus, "EXPIRED");
    assert.equal(expiredStatus.json().paymentStatus, "FAILED");
    assert.equal(walletRow.balance, 350.5);

    await app.close();
  });
});

