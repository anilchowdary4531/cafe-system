import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import walletRoutes from "../routes/wallet.routes.js";
import { getWalletAnalytics } from "../services/walletService.js";

test("Tiffzy Customer Wallet Analytics Backend Test Suite", async (t) => {
  const JWT_SECRET = "supersecret_jwt_key_for_tiffzy_secure_app_2025";

  // Build a test Fastify app instance with mock database
  const createTestApp = (mockPrisma) => {
    const app = Fastify();
    app.register(jwt, { secret: JWT_SECRET });
    app.register(walletRoutes, { prisma: mockPrisma });
    return app;
  };

  const customerA = { id: 101, name: "Customer Alpha", phone: "9876543210" };
  const customerB = { id: 102, name: "Customer Beta", phone: "9876543211" };

  const walletA = {
    id: 1,
    customerAccountId: 101,
    balance: 3500.0,
    currency: "INR",
    status: "ACTIVE",
    createdAt: new Date("2026-09-01T00:00:00Z"),
  };

  const walletB = {
    id: 2,
    customerAccountId: 102,
    balance: 100.0,
    currency: "INR",
    status: "ACTIVE",
    createdAt: new Date("2026-09-01T00:00:00Z"),
  };

  const now = new Date();
  const currentMonthDate1 = new Date(now.getFullYear(), now.getMonth(), 2, 10, 0, 0);
  const currentMonthDate2 = new Date(now.getFullYear(), now.getMonth(), 5, 14, 0, 0);
  const currentMonthDate3 = new Date(now.getFullYear(), now.getMonth(), 6, 16, 0, 0);
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 2, 10, 10, 0, 0);

  const ledgersA = [
    // Top-up in prev month (outside current month, inside 6m/all)
    {
      id: 1,
      walletId: 1,
      customerAccountId: 101,
      type: "WALLET_TOPUP",
      direction: "CREDIT",
      amount: 2000.0,
      balanceBefore: 0.0,
      balanceAfter: 2000.0,
      status: "SUCCESS",
      createdAt: prevMonthDate,
    },
    // Top-up in current month
    {
      id: 2,
      walletId: 1,
      customerAccountId: 101,
      type: "WALLET_TOPUP",
      direction: "CREDIT",
      amount: 1500.0,
      balanceBefore: 2000.0,
      balanceAfter: 3500.0,
      status: "SUCCESS",
      createdAt: currentMonthDate1,
    },
    // Food order payment in current month
    {
      id: 3,
      walletId: 1,
      customerAccountId: 101,
      type: "ORDER_PAYMENT",
      direction: "DEBIT",
      amount: 450.0,
      balanceBefore: 3500.0,
      balanceAfter: 3050.0,
      status: "SUCCESS",
      createdAt: currentMonthDate2,
    },
    // Refund in current month
    {
      id: 4,
      walletId: 1,
      customerAccountId: 101,
      type: "REFUND",
      direction: "CREDIT",
      amount: 450.0,
      balanceBefore: 3050.0,
      balanceAfter: 3500.0,
      status: "SUCCESS",
      createdAt: currentMonthDate3,
    },
  ];

  // In-memory Prisma mock that implements groupBy, aggregate, findMany, findUnique
  const mockPrisma = {
    customerAccount: {
      findUnique: async ({ where }) => {
        if (where.id === 101) return customerA;
        if (where.id === 102) return customerB;
        return null;
      },
    },
    wallet: {
      findUnique: async ({ where }) => {
        if (where.customerAccountId === 101) return walletA;
        if (where.customerAccountId === 102) return walletB;
        return null;
      },
      create: async ({ data }) => ({
        id: 99,
        customerAccountId: data.customerAccountId,
        balance: 0,
        currency: "INR",
        status: "ACTIVE",
      }),
    },
    walletLedger: {
      groupBy: async ({ by, where, _sum, _count }) => {
        const filtered = ledgersA.filter((l) => {
          if (l.walletId !== where.walletId) return false;
          if (where.status && l.status !== where.status) return false;
          if (where.createdAt?.gte && l.createdAt < where.createdAt.gte) return false;
          return true;
        });

        const groups = {};
        for (const item of filtered) {
          const key = `${item.type}_${item.direction}`;
          if (!groups[key]) {
            groups[key] = {
              type: item.type,
              direction: item.direction,
              _sum: { amount: 0 },
              _count: 0,
            };
          }
          groups[key]._sum.amount += item.amount;
          groups[key]._count += 1;
        }
        return Object.values(groups);
      },
      aggregate: async ({ where, _sum }) => {
        const filtered = ledgersA.filter((l) => {
          if (l.walletId !== where.walletId) return false;
          if (where.status && l.status !== where.status) return false;
          if (where.type && l.type !== where.type) return false;
          if (where.direction && l.direction !== where.direction) return false;
          if (where.createdAt?.gte && l.createdAt < where.createdAt.gte) return false;
          return true;
        });
        const total = filtered.reduce((acc, curr) => acc + curr.amount, 0);
        return { _sum: { amount: total } };
      },
      findMany: async ({ where, orderBy, take }) => {
        const filtered = ledgersA.filter((l) => {
          if (l.walletId !== where.walletId) return false;
          if (where.status && l.status !== where.status) return false;
          if (where.createdAt?.gte && l.createdAt < where.createdAt.gte) return false;
          return true;
        });
        const sorted = [...filtered].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return take ? sorted.slice(0, take) : sorted;
      },
    },
  };

  const app = createTestApp(mockPrisma);
  await app.ready();

  const tokenA = app.jwt.sign({ id: 101, customerAccountId: 101, phone: "9876543210" });
  const tokenB = app.jwt.sign({ id: 102, customerAccountId: 102, phone: "9876543211" });

  // 1. Authenticated customer can retrieve own analytics
  await t.test("1. Authenticated customer can retrieve own analytics", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.data);
    assert.ok(body.data.summary);
    assert.ok(Array.isArray(body.data.trend));
  });

  // 2. Unauthenticated request is rejected with 401
  await t.test("2. Unauthenticated request is rejected (401)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics",
    });
    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.ok(body.message.includes("Customer authentication token required"));
  });

  // 3. Customer cannot access another customer's wallet analytics
  await t.test("3. Customer cannot access another customer's wallet analytics via query parameter", async () => {
    // Customer B passes ?walletId=1 or ?customerAccountId=101 to attempt accessing Customer A's data
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics?walletId=1&customerAccountId=101",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    // Verified: Customer B strictly gets their own balance (₹100), not Customer A's balance (₹3500)
    assert.equal(body.data.summary.currentBalance, 100.0);
  });

  // 4. Current balance comes from authoritative Wallet.balance
  await t.test("4. Current balance comes from Wallet.balance", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const body = JSON.parse(res.payload);
    assert.equal(body.data.summary.currentBalance, 3500.0);
  });

  // 5. Top-ups are correctly aggregated
  await t.test("5. Top-ups are correctly aggregated (type=WALLET_TOPUP, direction=CREDIT)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics?period=all",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const body = JSON.parse(res.payload);
    // 2000 (prev month) + 1500 (this month) = 3500
    assert.equal(body.data.summary.totalDeposited, 3500.0);
  });

  // 6. Food-order debits are correctly aggregated
  await t.test("6. Food-order debits are correctly aggregated (type=ORDER_PAYMENT, direction=DEBIT)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics?period=all",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const body = JSON.parse(res.payload);
    assert.equal(body.data.summary.totalSpent, 450.0);
  });

  // 7. Refunds are correctly aggregated
  await t.test("7. Refunds are correctly aggregated (type=REFUND, direction=CREDIT)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics?period=all",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const body = JSON.parse(res.payload);
    assert.equal(body.data.summary.totalRefunded, 450.0);
  });

  // 8. Monthly metrics are correct
  await t.test("8. Monthly metrics (monthDeposits, monthSpent) are correct", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics?period=all",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const body = JSON.parse(res.payload);
    // In current month, only ledger 2 was deposited (1500), and ledger 3 was spent (450)
    assert.equal(body.data.summary.monthDeposits, 1500.0);
    assert.equal(body.data.summary.monthSpent, 450.0);
  });

  // 9. Trend points are chronological
  await t.test("9. Trend points are strictly chronological", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics?period=all",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const body = JSON.parse(res.payload);
    const trend = body.data.trend;
    assert.ok(trend.length >= 2);
    for (let i = 1; i < trend.length; i++) {
      assert.ok(trend[i].date >= trend[i - 1].date, "Dates must be chronologically ascending");
    }
  });

  // 10. period=7d works
  await t.test("10. period=7d returns daily buckets for last 7 days", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics?period=7d",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.data.trend);
  });

  // 11. period=30d works
  await t.test("11. period=30d returns daily buckets for last 30 days", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics?period=30d",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.data.trend);
  });

  // 12. period=6m works
  await t.test("12. period=6m returns monthly buckets for last 6 months", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics?period=6m",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.data.trend);
    // Formatted in YYYY-MM
    for (const pt of body.data.trend) {
      assert.match(pt.date, /^\d{4}-\d{2}$/);
    }
  });

  // 13. period=all works
  await t.test("13. period=all returns all historical activity", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics?period=all",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.data.summary.totalTransactions, 4);
  });

  // 14. period=3m works
  await t.test("14. period=3m returns daily buckets for last 3 months", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics?period=3m",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.data.trend);
  });

  // 15. period=1y works
  await t.test("15. period=1y returns monthly buckets for last 1 year", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics?period=1y",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.data.trend);
    for (const pt of body.data.trend) {
      assert.match(pt.date, /^\d{4}-\d{2}$/);
    }
  });

  // 16. Invalid period is handled correctly (HTTP 400)
  await t.test("16. Invalid period returns HTTP 400 with descriptive error", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wallet/analytics?period=10y",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.ok(body.message.includes("Invalid period"));
  });
});
