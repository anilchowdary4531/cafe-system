import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import paymentRoutes from "../routes/payment.routes.js";
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
});

