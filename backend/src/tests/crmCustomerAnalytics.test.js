import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveDateRange,
  isQualifyingOrder,
  getDistinctVisitDates,
  calculateAvgVisitInterval,
  classifyCustomerSegment,
  matchesSegmentFilter,
  calculateCrmSummary,
} from "../services/customerAnalyticsService.js";
import {
  searchCustomers,
  getCustomerStats,
  getCustomerDirectorySummary,
  exportCustomerDirectory,
} from "../services/crmCustomerService.js";

test("Tiffzy CRM & Customer Retention Analytics Test Suite", async (suite) => {
  // -------------------------------------------------------------
  // UNIT TESTS: Analytics Core Functions
  // -------------------------------------------------------------

  await suite.test("1. Qualifying Order Qualification Logic", () => {
    assert.equal(isQualifyingOrder({ status: "DELIVERED", paymentStatus: "PAID" }), true);
    assert.equal(isQualifyingOrder({ status: "READY", paymentStatus: "PAID" }), true);
    assert.equal(isQualifyingOrder({ status: "ACCEPTED", paymentStatus: "PENDING" }), true);
    assert.equal(isQualifyingOrder({ status: "CANCELLED", paymentStatus: "PAID" }), false);
    assert.equal(isQualifyingOrder({ status: "DELIVERED", paymentStatus: "FAILED" }), false);
    assert.equal(isQualifyingOrder(null), false);
  });

  await suite.test("2. Distinct Visit Dates Calculation (Grouping same-day orders into single visit)", () => {
    const orders = [
      { id: 1, total: 300, status: "DELIVERED", createdAt: "2026-09-01T12:30:00.000Z" },
      { id: 2, total: 150, status: "DELIVERED", createdAt: "2026-09-01T13:15:00.000Z" }, // Same day order
      { id: 3, total: 400, status: "CANCELLED", createdAt: "2026-09-05T19:00:00.000Z" }, // Cancelled, excluded
      { id: 4, total: 500, status: "DELIVERED", createdAt: "2026-09-11T12:00:00.000Z" }, // Second visit
      { id: 5, total: 600, status: "DELIVERED", createdAt: "2026-09-21T12:00:00.000Z" }, // Third visit
    ];

    const visits = getDistinctVisitDates(orders, "Asia/Kolkata");
    assert.equal(visits.length, 3, "Orders across 3 separate calendar days should yield 3 distinct visits");
    assert.deepEqual(visits, ["2026-09-01", "2026-09-11", "2026-09-21"]);
  });

  await suite.test("3. Average Time Between Visits Calculation", () => {
    // 3 visits: Sept 1, Sept 11 (10 days), Sept 21 (10 days) -> Avg = 10.0 days
    const visits = ["2026-09-01", "2026-09-11", "2026-09-21"];
    const avg = calculateAvgVisitInterval(visits);
    assert.equal(avg, 10.0);

    // Single visit -> should return null
    assert.equal(calculateAvgVisitInterval(["2026-09-01"]), null);
    // Empty -> should return null
    assert.equal(calculateAvgVisitInterval([]), null);
  });

  await suite.test("4. Behavioral Segmentation Engine Classification", () => {
    // New customer: exactly 1 order
    assert.equal(
      classifyCustomerSegment({ lifetimeOrders: 1, lifetimeSpend: 400, lastOrderAt: new Date() }),
      "NEW"
    );

    // Returning customer: 2 orders
    assert.equal(
      classifyCustomerSegment({ lifetimeOrders: 2, lifetimeSpend: 800, lastOrderAt: new Date() }),
      "RETURNING"
    );

    // Frequent customer: 5+ orders
    assert.equal(
      classifyCustomerSegment({ lifetimeOrders: 5, lifetimeSpend: 1500, lastOrderAt: new Date() }),
      "FREQUENT"
    );

    // High spending customer: ₹5,000+
    assert.equal(
      classifyCustomerSegment({ lifetimeOrders: 3, lifetimeSpend: 6200, lastOrderAt: new Date() }),
      "HIGH_SPENDING"
    );

    // Recently inactive customer: 45 days since last visit
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    assert.equal(
      classifyCustomerSegment({ lifetimeOrders: 3, lifetimeSpend: 1200, lastOrderAt: fortyFiveDaysAgo }),
      "RECENTLY_INACTIVE"
    );

    // Long-term inactive customer: 100 days since last visit
    const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    assert.equal(
      classifyCustomerSegment({ lifetimeOrders: 4, lifetimeSpend: 2000, lastOrderAt: hundredDaysAgo }),
      "LONG_TERM_INACTIVE"
    );

    // Reactivated customer: ordered in period after 70 days gap prior to period
    const seventyDaysAgo = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000);
    assert.equal(
      classifyCustomerSegment({
        lifetimeOrders: 4,
        lifetimeSpend: 1800,
        lastOrderAt: new Date(),
        periodOrders: 1,
        firstOrderAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        prevOrderBeforePeriodAt: seventyDaysAgo,
      }),
      "REACTIVATED"
    );

    // Zero orders
    assert.equal(classifyCustomerSegment({ lifetimeOrders: 0 }), "NO_ORDERS");
  });

  await suite.test("5. Date Range Boundary Resolution Across Presets", () => {
    const tz = "Asia/Kolkata";
    assert.equal(resolveDateRange({ range: "all" }).start, null);
    assert.notEqual(resolveDateRange({ range: "today", timezone: tz }).start, null);
    assert.notEqual(resolveDateRange({ range: "yesterday", timezone: tz }).start, null);
    assert.notEqual(resolveDateRange({ range: "7d", timezone: tz }).start, null);
    assert.notEqual(resolveDateRange({ range: "30d", timezone: tz }).start, null);
    assert.notEqual(resolveDateRange({ range: "90d", timezone: tz }).start, null);
    assert.notEqual(resolveDateRange({ range: "this_month", timezone: tz }).start, null);
    assert.notEqual(resolveDateRange({ range: "prev_month", timezone: tz }).start, null);

    const custom = resolveDateRange({
      range: "custom",
      startDate: "2026-08-01",
      endDate: "2026-08-15",
      timezone: tz,
    });
    assert.ok(custom.start instanceof Date);
    assert.ok(custom.end instanceof Date);
    assert.equal(custom.start.getFullYear(), 2026);
  });

  await suite.test("6. Summary KPI Aggregation with Standardized Denominator", () => {
    const customers = [
      { id: 1, totalOrders: 1, totalSpent: 500, periodOrders: 1, periodSpent: 500, segment: "NEW" },
      { id: 2, totalOrders: 3, totalSpent: 1200, periodOrders: 2, periodSpent: 800, segment: "RETURNING", avgVisitIntervalDays: 7 },
      { id: 3, totalOrders: 7, totalSpent: 5500, periodOrders: 4, periodSpent: 3000, segment: "FREQUENT", avgVisitIntervalDays: 4 },
      { id: 4, totalOrders: 0, totalSpent: 0, periodOrders: 0, periodSpent: 0, segment: "NO_ORDERS" }, // Non-purchasing contact
    ];

    const summary = calculateCrmSummary({
      customers,
      dateRange: { start: null, end: null, label: "All Time" },
    });

    assert.equal(summary.totalCustomers, 4, "Total registered customers should be 4");
    assert.equal(summary.periodPurchasingCustomers, 3, "Denominator must be 3 purchasing customers");
    assert.equal(summary.newCustomers, 1, "1 customer with 1 order");
    assert.equal(summary.returningCustomers, 2, "2 customers with >= 2 orders");
    assert.equal(summary.repeatCustomerCount, 2);
    // Denominator = 3 purchasing customers -> (2 / 3) * 100 = 66.7%
    assert.equal(summary.repeatCustomerRate, 66.7);
    assert.equal(summary.totalQualifyingRevenue, 7200);
    assert.equal(summary.totalQualifyingOrders, 11);
    assert.equal(summary.averageOrderValue, Number((7200 / 11).toFixed(2)));
  });

  // -------------------------------------------------------------
  // INTEGRATION TESTS: Scenarios 1 to 12 with Mock Database
  // -------------------------------------------------------------

  const createMockDb = () => {
    const now = new Date();
    const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);

    const mockCustomers = [
      // 1. Customer 1 (First-time customer)
      { id: 101, restaurantId: 1, name: "Alice New", phone: "9100000001", email: "alice@test.com", status: "ACTIVE", createdAt: twentyDaysAgo },
      // 2. Customer 2 (Returning customer, 2 orders on different days)
      { id: 102, restaurantId: 1, name: "Bob Repeat", phone: "9100000002", email: "bob@test.com", status: "ACTIVE", createdAt: twentyDaysAgo },
      // 3. Customer 3 (Frequent customer, 5 orders in 30 days)
      { id: 103, restaurantId: 1, name: "Charlie Frequent", phone: "9100000003", email: "charlie@test.com", status: "ACTIVE", createdAt: fortyDaysAgo },
      // 4. Customer 4 (Multiple orders same day)
      { id: 104, restaurantId: 1, name: "Daisy SameDay", phone: "9100000004", email: "daisy@test.com", status: "ACTIVE", createdAt: tenDaysAgo },
      // 5. Customer 5 (Outside 7-day range)
      { id: 105, restaurantId: 1, name: "Evan Outside", phone: "9100000005", email: "evan@test.com", status: "ACTIVE", createdAt: fortyDaysAgo },
      // 6. Customer 6 (Only cancelled orders)
      { id: 106, restaurantId: 1, name: "Frank Cancelled", phone: "9100000006", email: "frank@test.com", status: "ACTIVE", createdAt: twentyDaysAgo },
      // 7. Customer 7 (Pending order)
      { id: 107, restaurantId: 1, name: "Grace Pending", phone: "9100000007", email: "grace@test.com", status: "ACTIVE", createdAt: tenDaysAgo },
      // 8. Customer 8 (Full refund)
      { id: 108, restaurantId: 1, name: "Henry FullRefund", phone: "9100000008", email: "henry@test.com", status: "ACTIVE", createdAt: twentyDaysAgo },
      // 9. Customer 9 (Partial refund)
      { id: 109, restaurantId: 1, name: "Iris PartialRefund", phone: "9100000009", email: "iris@test.com", status: "ACTIVE", createdAt: twentyDaysAgo },
      // 10. Customer 10 (No orders)
      { id: 110, restaurantId: 1, name: "Jack NoOrders", phone: "9100000010", email: "jack@test.com", status: "ACTIVE", createdAt: tenDaysAgo },
      // 11. Customer 11 (Restaurant 2 - Isolation test with same phone as Alice)
      { id: 201, restaurantId: 2, name: "Alice OtherRest", phone: "9100000001", email: "alice2@test.com", status: "ACTIVE", createdAt: twentyDaysAgo },
    ];

    const mockOrders = [
      // Alice (1 order)
      { id: 1, restaurantId: 1, customerId: 101, total: 350, status: "DELIVERED", paymentStatus: "PAID", createdAt: twentyDaysAgo },

      // Bob (2 orders on different days)
      { id: 2, restaurantId: 1, customerId: 102, total: 400, status: "DELIVERED", paymentStatus: "PAID", createdAt: twentyDaysAgo },
      { id: 3, restaurantId: 1, customerId: 102, total: 450, status: "DELIVERED", paymentStatus: "PAID", createdAt: tenDaysAgo },

      // Charlie (5 orders in 30 days)
      { id: 4, restaurantId: 1, customerId: 103, total: 500, status: "DELIVERED", paymentStatus: "PAID", createdAt: new Date(now.getTime() - 25 * 86400000) },
      { id: 5, restaurantId: 1, customerId: 103, total: 500, status: "DELIVERED", paymentStatus: "PAID", createdAt: new Date(now.getTime() - 20 * 86400000) },
      { id: 6, restaurantId: 1, customerId: 103, total: 600, status: "DELIVERED", paymentStatus: "PAID", createdAt: new Date(now.getTime() - 15 * 86400000) },
      { id: 7, restaurantId: 1, customerId: 103, total: 700, status: "DELIVERED", paymentStatus: "PAID", createdAt: new Date(now.getTime() - 8 * 86400000) },
      { id: 8, restaurantId: 1, customerId: 103, total: 800, status: "DELIVERED", paymentStatus: "PAID", createdAt: new Date(now.getTime() - 2 * 86400000) },

      // Daisy (2 orders on same calendar day)
      { id: 9, restaurantId: 1, customerId: 104, total: 200, status: "DELIVERED", paymentStatus: "PAID", createdAt: new Date(now.getTime() - 3 * 86400000) },
      { id: 10, restaurantId: 1, customerId: 104, total: 150, status: "DELIVERED", paymentStatus: "PAID", createdAt: new Date(now.getTime() - 3 * 86400000 + 3600000) },

      // Evan (1 order 40 days ago, outside 7d / 30d window)
      { id: 11, restaurantId: 1, customerId: 105, total: 300, status: "DELIVERED", paymentStatus: "PAID", createdAt: fortyDaysAgo },

      // Frank (Cancelled orders only)
      { id: 12, restaurantId: 1, customerId: 106, total: 500, status: "CANCELLED", paymentStatus: "PAID", createdAt: tenDaysAgo },

      // Grace (Pending order with failed payment)
      { id: 13, restaurantId: 1, customerId: 107, total: 400, status: "PLACED", paymentStatus: "FAILED", createdAt: new Date() },

      // Henry (Full refund)
      { id: 14, restaurantId: 1, customerId: 108, total: 600, status: "DELIVERED", paymentStatus: "PAID", createdAt: tenDaysAgo, payments: [{ amount: 600, status: "REFUNDED" }] },

      // Iris (Partial refund: 800 total, 250 refund)
      { id: 15, restaurantId: 1, customerId: 109, total: 800, status: "DELIVERED", paymentStatus: "PAID", createdAt: tenDaysAgo, payments: [{ amount: 250, status: "PARTIALLY_REFUNDED" }] },

      // Alice Restaurant 2 order
      { id: 16, restaurantId: 2, customerId: 201, total: 999, status: "DELIVERED", paymentStatus: "PAID", createdAt: tenDaysAgo },
    ];

    const prismaMock = {
      restaurant: {
        findUnique: async ({ where }) => ({ id: where.id, timezone: "Asia/Kolkata" }),
      },
      customer: {
        findMany: async ({ where }) => {
          let list = mockCustomers.filter((c) => c.restaurantId === where.restaurantId);
          if (where.status && where.status !== "ALL") {
            list = list.filter((c) => c.status === where.status);
          }
          if (where.OR) {
            list = list.filter((c) => {
              const q = where.OR[0].name.contains.toLowerCase();
              return (
                (c.name && c.name.toLowerCase().includes(q)) ||
                (c.phone && c.phone.includes(q)) ||
                (c.email && c.email.toLowerCase().includes(q)) ||
                c.id === Number(q)
              );
            });
          }
          return list.map((c) => {
            const custOrders = mockOrders.filter(
              (o) => o.restaurantId === c.restaurantId && o.customerId === c.id && o.status !== "CANCELLED"
            );
            return {
              ...c,
              orders: custOrders,
              _count: { orders: custOrders.length, reservations: 0, addresses: 0 },
            };
          });
        },
        findFirst: async ({ where }) => {
          const cust = mockCustomers.find((c) => c.id === where.id && c.restaurantId === where.restaurantId);
          if (!cust) return null;
          return {
            ...cust,
            orders: mockOrders.filter((o) => o.customerId === cust.id),
            addresses: [],
            reservations: [],
            payLaterAccounts: [],
            customerNotifications: [],
          };
        },
      },
      order: {
        findMany: async ({ where }) => {
          return mockOrders.filter(
            (o) => o.restaurantId === where.restaurantId && o.customerId === where.customerId
          );
        },
      },
      payment: {
        findMany: async ({ where }) => {
          const order = mockOrders.find((o) => o.id === where.orderId || (where.order && o.customerId === where.order.customerId));
          return order?.payments || [];
        },
      },
    };

    return { prismaMock, mockCustomers, mockOrders };
  };

  // Scenario 1: First-time customer
  await suite.test("Scenario 1: Customer places first order", async () => {
    const { prismaMock } = createMockDb();
    const stats = await getCustomerStats({ prisma: prismaMock, restaurantId: 1, customerId: 101 });
    assert.equal(stats.totalOrders, 1);
    assert.equal(stats.isRepeat, false);
    assert.equal(stats.segment, "NEW");
  });

  // Scenario 2: Repeat customer on another day
  await suite.test("Scenario 2: Repeat customer on another day (distinct visits & interval)", async () => {
    const { prismaMock } = createMockDb();
    const stats = await getCustomerStats({ prisma: prismaMock, restaurantId: 1, customerId: 102 });
    assert.equal(stats.totalOrders, 2);
    assert.equal(stats.isRepeat, true);
    assert.equal(stats.distinctVisits, 2);
    assert.equal(stats.segment, "RETURNING");
    assert.ok(stats.avgVisitIntervalDays > 0, "Average visit interval should be computed");
  });

  // Scenario 3: Customer places 5 orders within 30 days
  await suite.test("Scenario 3: Frequent customer with 5+ orders in 30 days", async () => {
    const { prismaMock } = createMockDb();
    const stats = await getCustomerStats({ prisma: prismaMock, restaurantId: 1, customerId: 103 });
    assert.equal(stats.totalOrders, 5);
    assert.equal(stats.segment, "FREQUENT");
    assert.equal(stats.isRepeat, true);
  });

  // Scenario 4: Multiple orders on the same day
  await suite.test("Scenario 4: Customer places several orders on the same day", async () => {
    const { prismaMock } = createMockDb();
    const stats = await getCustomerStats({ prisma: prismaMock, restaurantId: 1, customerId: 104 });
    assert.equal(stats.totalOrders, 2, "Order count should be 2");
    assert.equal(stats.distinctVisits, 1, "Orders on same day must count as 1 distinct visit");
    assert.equal(stats.avgVisitIntervalDays, null, "1 distinct visit has no consecutive interval");
  });

  // Scenario 5: Customer orders outside selected date range
  await suite.test("Scenario 5: Customer orders outside selected 7d date range", async () => {
    const { prismaMock } = createMockDb();
    const result = await searchCustomers({
      prisma: prismaMock,
      restaurantId: 1,
      range: "7d",
    });
    const evan = result.items.find((c) => c.id === 105);
    assert.ok(evan);
    assert.equal(evan.periodOrders, 0, "Orders outside 7d window must show 0 periodOrders");
    assert.equal(evan.totalOrders, 1, "Lifetime orders must remain 1");
  });

  // Scenario 6: Customer with only cancelled orders
  await suite.test("Scenario 6: Customer with only cancelled orders", async () => {
    const { prismaMock } = createMockDb();
    const stats = await getCustomerStats({ prisma: prismaMock, restaurantId: 1, customerId: 106 });
    assert.equal(stats.totalOrders, 0, "Cancelled orders must be excluded from qualifying purchases");
    assert.equal(stats.cancelledOrders, 1, "Cancelled order count must be tracked");
    assert.equal(stats.totalSpent, 0, "Cancelled orders must not contribute to total spend");
  });

  // Scenario 7: Customer with pending/failed payment orders
  await suite.test("Scenario 7: Orders with failed payment are excluded from completed spend", async () => {
    const { prismaMock } = createMockDb();
    const stats = await getCustomerStats({ prisma: prismaMock, restaurantId: 1, customerId: 107 });
    assert.equal(stats.totalOrders, 0, "Orders with failed payment must not count as qualifying purchases");
    assert.equal(stats.totalSpent, 0);
  });

  // Scenario 8: Full refund handling
  await suite.test("Scenario 8: Customer receives a full refund", async () => {
    const { prismaMock } = createMockDb();
    const stats = await getCustomerStats({ prisma: prismaMock, restaurantId: 1, customerId: 108 });
    assert.equal(stats.totalRefunded, 600);
    assert.equal(stats.totalSpent, 0, "Net spend should be 0 after full refund");
  });

  // Scenario 9: Partial refund handling
  await suite.test("Scenario 9: Customer receives a partial refund", async () => {
    const { prismaMock } = createMockDb();
    const stats = await getCustomerStats({ prisma: prismaMock, restaurantId: 1, customerId: 109 });
    assert.equal(stats.totalRefunded, 250);
    assert.equal(stats.totalSpent, 550, "Net spend should be ₹550 (800 - 250)");
  });

  // Scenario 10: Customer with no orders
  await suite.test("Scenario 10: Customer with no orders", async () => {
    const { prismaMock } = createMockDb();
    const stats = await getCustomerStats({ prisma: prismaMock, restaurantId: 1, customerId: 110 });
    assert.equal(stats.totalOrders, 0);
    assert.equal(stats.totalSpent, 0);
    assert.equal(stats.distinctVisits, 0);
    assert.equal(stats.avgVisitIntervalDays, null);
    assert.equal(stats.segment, "NO_ORDERS");
  });

  // Scenario 11: Multi-tenancy isolation between restaurants
  await suite.test("Scenario 11: Multi-tenancy isolation (same phone in 2 restaurants)", async () => {
    const { prismaMock } = createMockDb();

    // Query Restaurant 1
    const rest1 = await searchCustomers({ prisma: prismaMock, restaurantId: 1 });
    const alice1 = rest1.items.find((c) => c.phone === "9100000001");
    assert.ok(alice1);
    assert.equal(alice1.restaurantId, 1);
    assert.equal(alice1.totalSpent, 350);

    // Query Restaurant 2
    const rest2 = await searchCustomers({ prisma: prismaMock, restaurantId: 2 });
    const alice2 = rest2.items.find((c) => c.phone === "9100000001");
    assert.ok(alice2);
    assert.equal(alice2.restaurantId, 2);
    assert.equal(alice2.totalSpent, 999);

    assert.notEqual(alice1.id, alice2.id, "Customer IDs must be separate entities across restaurants");
  });

  // Scenario 12: Global Sorting across dataset
  await suite.test("Scenario 12: Global sorting by total spend descending", async () => {
    const { prismaMock } = createMockDb();
    const result = await searchCustomers({
      prisma: prismaMock,
      restaurantId: 1,
      sortBy: "totalSpend",
      sortOrder: "desc",
    });

    assert.ok(result.items.length > 0);
    // Charlie (ID 103) has highest spend (3100)
    assert.equal(result.items[0].id, 103, "Highest spender must be ranked first globally");
    assert.ok(result.items[0].totalSpent >= result.items[1].totalSpent);
  });

  // Scenario 13: Summary API and CSV Export
  await suite.test("Scenario 13: Summary API and CSV Export Integration", async () => {
    const { prismaMock } = createMockDb();
    const summary = await getCustomerDirectorySummary({
      prisma: prismaMock,
      restaurantId: 1,
      range: "all",
    });
    assert.ok(summary.totalCustomers > 0);
    assert.ok(summary.repeatCustomerRate >= 0);

    const exportData = await exportCustomerDirectory({
      prisma: prismaMock,
      restaurantId: 1,
      range: "all",
    });
    assert.ok(exportData.headers.includes("Customer ID"));
    assert.ok(exportData.headers.includes("Repeat Customer"));
    assert.ok(exportData.headers.includes("Avg Visit Interval (Days)"));
    assert.ok(exportData.rows.length > 0);
  });
});
