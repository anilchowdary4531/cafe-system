const cache = new Map();

const nowMs = () => Date.now();

const getCached = async (key, ttlMs, fn) => {
  const existing = cache.get(key);
  const t = nowMs();
  if (existing && existing.expiresAt > t) return existing.value;
  const value = await fn();
  cache.set(key, { value, expiresAt: t + ttlMs });
  return value;
};

export const getRecommendations = async ({ prisma, restaurantId, limit = 8 } = {}) => {
  const rid = Number(restaurantId || 0);
  if (!rid) {
    const err = new Error("restaurant_required");
    err.code = "restaurant_required";
    throw err;
  }

  const hour = new Date().getHours();
  const key = `reco:${rid}:${hour}:${limit}`;

  return getCached(key, 60_000, async () => {
    const orders = await prisma.order.findMany({
      where: { restaurantId: rid },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        createdAt: true,
        items: { select: { menuItemId: true, itemName: true, qty: true, price: true } },
      },
    });

    const itemCount = new Map(); // key => count
    const itemName = new Map();
    const pairCount = new Map(); // "a|b" => count

    for (const order of orders) {
      const uniqueIds = [...new Set((order.items || []).map((i) => Number(i.menuItemId || 0)).filter((id) => id > 0))];
      uniqueIds.forEach((id) => itemCount.set(id, (itemCount.get(id) || 0) + 1));

      (order.items || []).forEach((i) => {
        const id = Number(i.menuItemId || 0);
        if (!id) return;
        if (!itemName.has(id)) itemName.set(id, String(i.itemName || "").trim());
      });

      for (let i = 0; i < uniqueIds.length; i++) {
        for (let j = i + 1; j < uniqueIds.length; j++) {
          const a = uniqueIds[i];
          const b = uniqueIds[j];
          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          pairCount.set(key, (pairCount.get(key) || 0) + 1);
        }
      }
    }

    const topItems = [...itemCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(1, Number(limit || 8)))
      .map(([id, count]) => ({ menuItemId: id, name: itemName.get(id) || "", count }));

    const topPairs = [...pairCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(1, Math.floor(Number(limit || 8) / 2)))
      .map(([pair, count]) => {
        const [a, b] = pair.split("|").map((n) => Number(n));
        return {
          a: { menuItemId: a, name: itemName.get(a) || "" },
          b: { menuItemId: b, name: itemName.get(b) || "" },
          count,
        };
      });

    return {
      generatedAt: new Date().toISOString(),
      restaurantId: rid,
      topItems,
      frequentlyBoughtTogether: topPairs,
      todaySpecial: topItems.slice(0, 3),
    };
  });
};

export const getCustomerInsights = async ({ prisma, restaurantId } = {}) => {
  const rid = Number(restaurantId || 0);
  if (!rid) {
    const err = new Error("restaurant_required");
    err.code = "restaurant_required";
    throw err;
  }

  const key = `cust:${rid}`;

  return getCached(key, 120_000, async () => {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const orders = await prisma.order.findMany({
      where: { restaurantId: rid, createdAt: { gte: since }, phone: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { phone: true, customerName: true, total: true, createdAt: true },
    });

    const byPhone = new Map();
    for (const order of orders) {
      const phone = String(order.phone || "").trim();
      if (!phone) continue;
      if (!byPhone.has(phone)) {
        byPhone.set(phone, {
          phone,
          name: String(order.customerName || "").trim(),
          orders: 0,
          totalSpend: 0,
          lastOrderAt: order.createdAt,
        });
      }
      const entry = byPhone.get(phone);
      entry.orders += 1;
      entry.totalSpend += Number(order.total || 0);
      const t = new Date(order.createdAt).getTime();
      const lt = new Date(entry.lastOrderAt).getTime();
      if (t > lt) entry.lastOrderAt = order.createdAt;
      if (!entry.name && order.customerName) entry.name = String(order.customerName).trim();
    }

    const customers = [...byPhone.values()].map((c) => ({
      phone: c.phone,
      name: c.name,
      orders: c.orders,
      totalSpend: c.totalSpend,
      avgOrderValue: c.orders ? c.totalSpend / c.orders : 0,
      lastOrderAt: c.lastOrderAt,
    }));

    customers.sort((a, b) => b.totalSpend - a.totalSpend);

    const highValueCutoff = customers.length ? customers[Math.floor(customers.length * 0.1)]?.totalSpend || 0 : 0;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const segments = {
      highValue: customers.filter((c) => c.totalSpend >= highValueCutoff).slice(0, 50),
      frequent: customers.filter((c) => c.orders >= 5).slice(0, 50),
      inactive: customers.filter((c) => new Date(c.lastOrderAt).getTime() < thirtyDaysAgo).slice(0, 50),
    };

    return {
      generatedAt: new Date().toISOString(),
      restaurantId: rid,
      totals: {
        customers: customers.length,
        orders: orders.length,
      },
      segments,
    };
  });
};

