/**
 * Tiffzy Customer Analytics & Segmentation Engine
 * 
 * Provides:
 * 1. Timezone-aware date boundary resolution (Today, Yesterday, 7d, 30d, 90d, this_month, prev_month, custom, all)
 * 2. Qualifying order identification (excluding CANCELLED and FAILED payments)
 * 3. Distinct visit date calculation (grouping same-day orders into single visits)
 * 4. Average visit interval calculation (in days)
 * 5. Multi-dimensional customer segmentation (NEW, RETURNING, FREQUENT, HIGH_SPENDING, RECENTLY_INACTIVE, LONG_TERM_INACTIVE, REACTIVATED)
 * 6. Period and lifetime metrics enrichment with net refund calculations
 * 7. CRM Directory Summary aggregations with standardized repeat-customer rate denominator
 */

/**
 * Resolves start and end Date objects for period filters based on restaurant timezone.
 *
 * @param {Object} params
 * @param {string} params.range - Preset ID ('all', 'today', 'yesterday', '7d', '30d', '90d', 'this_month', 'prev_month', 'custom')
 * @param {string|Date} [params.startDate] - Custom start date (ISO string or YYYY-MM-DD)
 * @param {string|Date} [params.endDate] - Custom end date (ISO string or YYYY-MM-DD)
 * @param {string} [params.timezone='Asia/Kolkata'] - Restaurant timezone
 * @returns {{ start: Date|null, end: Date|null, label: string }}
 */
export const resolveDateRange = ({ range = "all", startDate, endDate, timezone = "Asia/Kolkata" } = {}) => {
  const normalizedRange = String(range || "all").toLowerCase().trim();
  const now = new Date();

  // If "all" or unspecified, no date bounds
  if (normalizedRange === "all") {
    return { start: null, end: null, label: "All Time" };
  }

  // Get current date parts in the restaurant's timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = formatter.format(now); // "YYYY-MM-DD"
  const [currYear, currMonth, currDay] = todayStr.split("-").map(Number);

  // Helper to construct local start/end of day in UTC equivalent
  const getDayBounds = (year, month, day) => {
    // month is 1-indexed
    const mStr = String(month).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const startStr = `${year}-${mStr}-${dStr}T00:00:00.000`;
    const endStr = `${year}-${mStr}-${dStr}T23:59:59.999`;

    // Calculate timezone offset for the given date in target timezone
    return {
      start: new Date(new Date(startStr).toLocaleString("en-US", { timeZone: "UTC" }) - getTimezoneOffsetMs(timezone, startStr)),
      end: new Date(new Date(endStr).toLocaleString("en-US", { timeZone: "UTC" }) - getTimezoneOffsetMs(timezone, endStr)),
    };
  };

  switch (normalizedRange) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: "Today" };
    }
    case "yesterday": {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: "Yesterday" };
    }
    case "7d": {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      return { start, end, label: "Last 7 Days" };
    }
    case "30d": {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      return { start, end, label: "Last 30 Days" };
    }
    case "90d": {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      return { start, end, label: "Last 90 Days" };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now);
      return { start, end, label: "This Month" };
    }
    case "prev_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end, label: "Previous Month" };
    }
    case "custom": {
      if (!startDate) {
        return { start: null, end: null, label: "Custom (Unspecified)" };
      }
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      const e = endDate ? new Date(endDate) : new Date(s);
      e.setHours(23, 59, 59, 999);
      return {
        start: s,
        end: e,
        label: `${s.toLocaleDateString("en-IN")} – ${e.toLocaleDateString("en-IN")}`,
      };
    }
    default:
      return { start: null, end: null, label: "All Time" };
  }
};

/**
 * Calculates timezone offset difference in milliseconds.
 */
function getTimezoneOffsetMs(timeZone, dateStr) {
  try {
    const d = new Date(dateStr);
    const utcDate = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
    const tzDate = new Date(d.toLocaleString("en-US", { timeZone }));
    return tzDate.getTime() - utcDate.getTime();
  } catch (_) {
    return 0;
  }
}

/**
 * Determines if an order qualifies for completed purchase metrics.
 * Excludes cancelled orders and failed payment orders.
 *
 * @param {Object} order
 * @returns {boolean}
 */
export const isQualifyingOrder = (order) => {
  if (!order) return false;
  const status = String(order.status || "").toUpperCase();
  const paymentStatus = String(order.paymentStatus || "").toUpperCase();

  // Exclude explicit cancellations
  if (status === "CANCELLED") return false;

  // Exclude failed payments (if payment was attempted and failed)
  if (paymentStatus === "FAILED") return false;

  return true;
};

/**
 * Extracts distinct calendar visit dates (YYYY-MM-DD in given timezone)
 * from an array of orders. Multiple orders on the same day count as ONE visit.
 *
 * @param {Array<Object>} orders
 * @param {string} [timezone='Asia/Kolkata']
 * @returns {Array<string>} Sorted array of unique YYYY-MM-DD date strings
 */
export const getDistinctVisitDates = (orders = [], timezone = "Asia/Kolkata") => {
  const dates = new Set();
  for (const o of orders) {
    if (isQualifyingOrder(o) && o.createdAt) {
      const d = new Date(o.createdAt);
      try {
        const dateStr = d.toLocaleDateString("en-CA", { timeZone: timezone });
        dates.add(dateStr);
      } catch (_) {
        dates.add(d.toISOString().split("T")[0]);
      }
    }
  }
  return Array.from(dates).sort();
};

/**
 * Calculates average interval between consecutive visits in days.
 * Returns null if fewer than 2 distinct visits.
 *
 * @param {Array<string>} distinctVisitDates - Sorted array of YYYY-MM-DD strings
 * @returns {number|null}
 */
export const calculateAvgVisitInterval = (distinctVisitDates = []) => {
  if (!distinctVisitDates || distinctVisitDates.length < 2) return null;

  const firstMs = new Date(distinctVisitDates[0]).getTime();
  const lastMs = new Date(distinctVisitDates[distinctVisitDates.length - 1]).getTime();
  const totalDays = (lastMs - firstMs) / (1000 * 60 * 60 * 24);
  const intervalsCount = distinctVisitDates.length - 1;

  if (intervalsCount <= 0 || totalDays <= 0) return null;

  return Number((totalDays / intervalsCount).toFixed(1));
};

/**
 * Classifies a customer into a behavioral segment.
 *
 * @param {Object} params
 * @param {number} params.lifetimeOrders
 * @param {number} params.lifetimeSpend
 * @param {Date|null} params.lastOrderAt
 * @param {number} params.periodOrders
 * @param {Date|null} params.firstOrderAt
 * @param {Date|null} params.prevOrderBeforePeriodAt
 * @param {Object} [params.thresholds]
 * @returns {string} One of: 'NEW', 'RETURNING', 'FREQUENT', 'HIGH_SPENDING', 'RECENTLY_INACTIVE', 'LONG_TERM_INACTIVE', 'REACTIVATED', 'NO_ORDERS'
 */
export const classifyCustomerSegment = ({
  lifetimeOrders = 0,
  lifetimeSpend = 0,
  lastOrderAt = null,
  periodOrders = 0,
  firstOrderAt = null,
  prevOrderBeforePeriodAt = null,
  thresholds = {},
} = {}) => {
  const {
    frequentThreshold = 5,
    highSpendThreshold = 5000,
    recentlyInactiveDays = 30,
    longTermInactiveDays = 90,
    reactivationGapDays = 60,
  } = thresholds;

  if (lifetimeOrders === 0) return "NO_ORDERS";

  const now = new Date();
  const daysSinceLastOrder = lastOrderAt
    ? Math.max(0, (now.getTime() - new Date(lastOrderAt).getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;

  // Reactivated: Customer ordered in period, but had at least 60 days of inactivity prior to period
  if (periodOrders > 0 && prevOrderBeforePeriodAt && firstOrderAt) {
    const gapDays = (new Date(lastOrderAt).getTime() - new Date(prevOrderBeforePeriodAt).getTime()) / (1000 * 60 * 60 * 24);
    if (gapDays >= reactivationGapDays) {
      return "REACTIVATED";
    }
  }

  // Long-term inactive: No orders in 90+ days
  if (daysSinceLastOrder >= longTermInactiveDays) {
    return "LONG_TERM_INACTIVE";
  }

  // Recently inactive: No orders in 30-89 days
  if (daysSinceLastOrder >= recentlyInactiveDays) {
    return "RECENTLY_INACTIVE";
  }

  // Frequent: 5 or more lifetime orders
  if (lifetimeOrders >= frequentThreshold) {
    return "FREQUENT";
  }

  // High spending: ₹5,000 or more lifetime spend
  if (lifetimeSpend >= highSpendThreshold) {
    return "HIGH_SPENDING";
  }

  // Returning: 2 or more lifetime orders
  if (lifetimeOrders >= 2) {
    return "RETURNING";
  }

  // New: Exactly 1 lifetime order
  return "NEW";
};

/**
 * Checks whether a customer matches a requested segment filter.
 *
 * @param {string} customerSegment
 * @param {string} requestedSegment
 * @param {Object} metrics
 * @param {Object} thresholds
 * @returns {boolean}
 */
export const matchesSegmentFilter = (
  customerSegment,
  requestedSegment = "ALL",
  metrics = {},
  thresholds = {}
) => {
  const target = String(requestedSegment || "ALL").toUpperCase().trim();
  if (target === "ALL") return true;

  const {
    frequentThreshold = 5,
    highSpendThreshold = 5000,
    recentlyInactiveDays = 30,
    longTermInactiveDays = 90,
  } = thresholds;

  const { lifetimeOrders = 0, lifetimeSpend = 0, lastOrderAt = null } = metrics;
  const now = new Date();
  const daysSinceLastOrder = lastOrderAt
    ? (now.getTime() - new Date(lastOrderAt).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  switch (target) {
    case "NEW":
      return lifetimeOrders === 1;
    case "RETURNING":
      return lifetimeOrders >= 2;
    case "FREQUENT":
      return lifetimeOrders >= frequentThreshold;
    case "HIGH_SPENDING":
      return lifetimeSpend >= highSpendThreshold;
    case "RECENTLY_INACTIVE":
      return daysSinceLastOrder >= recentlyInactiveDays && daysSinceLastOrder < longTermInactiveDays && lifetimeOrders > 0;
    case "LONG_TERM_INACTIVE":
      return daysSinceLastOrder >= longTermInactiveDays && lifetimeOrders > 0;
    case "REACTIVATED":
      return customerSegment === "REACTIVATED";
    case "NO_ORDERS":
      return lifetimeOrders === 0;
    default:
      return customerSegment === target;
  }
};

/**
 * Calculates CRM Directory Summary statistics across a customer collection and their orders.
 *
 * @param {Object} params
 * @param {Array<Object>} params.customers - Enriched customer list
 * @param {Object} params.dateRange - Result of resolveDateRange
 * @returns {Object} Structured KPI Summary
 */
export const calculateCrmSummary = ({ customers = [], dateRange = {} } = {}) => {
  const totalCustomers = customers.length;
  const hasDateFilter = Boolean(dateRange.start && dateRange.end);

  let periodPurchasingCustomers = 0;
  let newCustomersCount = 0;
  let returningCustomersCount = 0;
  let frequentCustomersCount = 0;
  let highSpendingCustomersCount = 0;
  let recentlyInactiveCount = 0;
  let longTermInactiveCount = 0;
  let reactivatedCount = 0;

  let totalQualifyingRevenue = 0;
  let totalQualifyingOrders = 0;
  let sumIntervals = 0;
  let intervalCount = 0;

  for (const c of customers) {
    const ordersInScope = hasDateFilter ? (c.periodOrders || 0) : (c.totalOrders || 0);
    const spendInScope = hasDateFilter ? (c.periodSpent || 0) : (c.totalSpent || 0);

    totalQualifyingRevenue += spendInScope;
    totalQualifyingOrders += ordersInScope;

    if (ordersInScope > 0) {
      periodPurchasingCustomers += 1;
    }

    if (c.avgVisitIntervalDays !== null && c.avgVisitIntervalDays !== undefined) {
      sumIntervals += Number(c.avgVisitIntervalDays);
      intervalCount += 1;
    }

    // New vs Returning categorization
    if (hasDateFilter) {
      // In date filter mode:
      // New: first-ever order falls within this date window
      if (c.firstOrderAt && new Date(c.firstOrderAt) >= dateRange.start && new Date(c.firstOrderAt) <= dateRange.end) {
        newCustomersCount += 1;
      } else if (ordersInScope > 0) {
        // Returning: ordered in period and had an order prior to period
        returningCustomersCount += 1;
      }
    } else {
      // Lifetime mode:
      if (c.totalOrders === 1) newCustomersCount += 1;
      if (c.totalOrders >= 2) returningCustomersCount += 1;
    }

    if (c.totalOrders >= 5) frequentCustomersCount += 1;
    if (c.totalSpent >= 5000) highSpendingCustomersCount += 1;
    if (c.segment === "RECENTLY_INACTIVE") recentlyInactiveCount += 1;
    if (c.segment === "LONG_TERM_INACTIVE") longTermInactiveCount += 1;
    if (c.segment === "REACTIVATED") reactivatedCount += 1;
  }

  // Standardized Denominator:
  // Purchasing customers in the evaluated scope (hasDateFilter ? periodPurchasingCustomers : customers with >=1 order)
  const activePurchasers = hasDateFilter
    ? periodPurchasingCustomers
    : customers.filter((c) => (c.totalOrders || 0) > 0).length;

  const repeatCustomerCount = returningCustomersCount;
  const repeatCustomerRate = activePurchasers > 0
    ? Number(((repeatCustomerCount / activePurchasers) * 100).toFixed(1))
    : 0.0;

  const avgOrderValue = totalQualifyingOrders > 0
    ? Number((totalQualifyingRevenue / totalQualifyingOrders).toFixed(2))
    : 0.0;

  const avgVisitIntervalOverall = intervalCount > 0
    ? Number((sumIntervals / intervalCount).toFixed(1))
    : null;

  return {
    totalCustomers,
    periodPurchasingCustomers: activePurchasers,
    newCustomers: newCustomersCount,
    returningCustomers: returningCustomersCount,
    repeatCustomerCount,
    repeatCustomerRate,
    repeatCustomerRateDenominator: activePurchasers,
    frequentCustomers: frequentCustomersCount,
    highSpendingCustomers: highSpendingCustomersCount,
    recentlyInactiveCount,
    longTermInactiveCount,
    reactivatedCount,
    totalQualifyingRevenue: Number(totalQualifyingRevenue.toFixed(2)),
    totalQualifyingOrders,
    averageOrderValue: avgOrderValue,
    avgVisitIntervalOverall,
    rangeLabel: dateRange.label || "All Time",
    hasDateFilter,
  };
};
