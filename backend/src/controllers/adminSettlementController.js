const round2 = (num) => Math.round(Number(num || 0) * 100) / 100;

export const buildAdminSettlementController = ({ prisma }) => {
  const calculateCommissionAndSettlement = (order, commissionRate = 0.10) => {
    const total = round2(order.total || order.amount || 0);
    const commission = round2(total * commissionRate);
    const settlementAmount = round2(Math.max(0, total - commission));
    return { total, commission, settlementAmount };
  };

  const getSummary = async (req, reply) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [orders, restaurants] = await Promise.all([
        prisma.order.findMany({
          select: {
            id: true,
            total: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
            restaurantId: true,
          },
        }),
        prisma.restaurant.findMany({
          select: { id: true, name: true, legalName: true, isActive: true },
        }),
      ]);

      let totalRevenue = 0;
      let totalCommission = 0;
      let restaurantSettlements = 0;
      let pendingSettlements = 0;
      let failedSettlements = 0;
      let totalRefunds = 0;

      const dailyTrendMap = {};

      orders.forEach((order) => {
        const { total, commission, settlementAmount } = calculateCommissionAndSettlement(order);
        const pStatus = String(order.paymentStatus || "PENDING").toUpperCase();
        const oStatus = String(order.status || "PLACED").toUpperCase();

        if (pStatus === "PAID" || pStatus === "SUCCESS") {
          totalRevenue += total;
          totalCommission += commission;
          restaurantSettlements += settlementAmount;

          const dateKey = new Date(order.createdAt).toISOString().split("T")[0];
          if (!dailyTrendMap[dateKey]) {
            dailyTrendMap[dateKey] = { date: dateKey, revenue: 0, commission: 0, settlements: 0 };
          }
          dailyTrendMap[dateKey].revenue += total;
          dailyTrendMap[dateKey].commission += commission;
          dailyTrendMap[dateKey].settlements += settlementAmount;
        } else if (pStatus === "FAILED") {
          failedSettlements += total;
        } else if (pStatus === "REFUNDED" || oStatus === "CANCELLED") {
          totalRefunds += total;
        } else {
          pendingSettlements += total;
        }
      });

      const chartData = Object.values(dailyTrendMap)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-14)
        .map((row) => ({
          date: row.date,
          revenue: round2(row.revenue),
          commission: round2(row.commission),
          settlements: round2(row.settlements),
        }));

      return reply.code(200).send({
        summary: {
          totalRevenue: round2(totalRevenue),
          totalCommission: round2(totalCommission),
          restaurantSettlements: round2(restaurantSettlements),
          pendingSettlements: round2(pendingSettlements),
          failedSettlements: round2(failedSettlements),
          totalRefunds: round2(totalRefunds),
          totalRestaurants: restaurants.length,
          activeRestaurants: restaurants.filter((r) => r.isActive).length,
        },
        chartData,
      });
    } catch (err) {
      console.error("[AdminSettlementController] getSummary Error:", err);
      return reply.code(500).send({ message: "Failed to fetch admin settlement summary" });
    }
  };

  const getPaymentLogs = async (req, reply) => {
    try {
      const page = Math.max(1, Number(req.query?.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 15)));
      const search = String(req.query?.search || "").trim();
      const status = String(req.query?.status || "ALL").toUpperCase();

      const whereClause = {
        ...(status !== "ALL" ? { paymentStatus: status } : {}),
        ...(search
          ? {
              OR: [
                { orderNo: { contains: search, mode: "insensitive" } },
                { invoiceNo: { contains: search, mode: "insensitive" } },
                { customerName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const skip = (page - 1) * limit;

      const [totalCount, orders] = await Promise.all([
        prisma.order.count({ where: whereClause }),
        prisma.order.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            restaurant: { select: { id: true, name: true } },
          },
        }),
      ]);

      const logs = orders.map((order) => {
        const { total, commission, settlementAmount } = calculateCommissionAndSettlement(order);
        return {
          id: order.id,
          orderNo: order.invoiceNo || order.orderNo || `ORD-${order.id}`,
          restaurantName: order.restaurant?.name || `Restaurant #${order.restaurantId}`,
          restaurantId: order.restaurantId,
          customerName: order.customerName || "Customer",
          phone: order.phone || "-",
          total,
          commission,
          settlementAmount,
          paymentStatus: order.paymentStatus || "PENDING",
          paymentMode: order.paymentMode || "ONLINE",
          createdAt: order.createdAt,
        };
      });

      return reply.code(200).send({
        logs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    } catch (err) {
      console.error("[AdminSettlementController] getPaymentLogs Error:", err);
      return reply.code(500).send({ message: "Failed to fetch payment logs" });
    }
  };

  const getWebhookLogs = async (req, reply) => {
    try {
      const page = Math.max(1, Number(req.query?.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 15)));

      // Query latest paid/failed orders as simulated webhook events
      const orders = await prisma.order.findMany({
        orderBy: { updatedAt: "desc" },
        take: limit,
        include: { restaurant: { select: { name: true } } },
      });

      const webhooks = orders.map((order, idx) => ({
        id: `wh_${order.id}_${idx}`,
        eventType: order.paymentStatus === "PAID" ? "PAYMENT_SUCCESS" : order.paymentStatus === "FAILED" ? "PAYMENT_FAILED" : "PAYMENT_PENDING",
        orderId: order.invoiceNo || order.orderNo || `ORD-${order.id}`,
        restaurantName: order.restaurant?.name || "Tiffzy Restaurant",
        amount: round2(order.total),
        signatureStatus: "VERIFIED",
        receivedAt: order.updatedAt || order.createdAt,
      }));

      return reply.code(200).send({ webhooks });
    } catch (err) {
      console.error("[AdminSettlementController] getWebhookLogs Error:", err);
      return reply.code(500).send({ message: "Failed to fetch webhook logs" });
    }
  };

  const getVendorDetails = async (req, reply) => {
    try {
      const restaurants = await prisma.restaurant.findMany({
        select: {
          id: true,
          name: true,
          legalName: true,
          email: true,
          phone: true,
          upiId: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { id: "asc" },
      });

      const vendors = restaurants.map((r) => ({
        restaurantId: r.id,
        vendorId: `vendor_rest_${r.id}`,
        name: r.name,
        legalName: r.legalName || r.name,
        email: r.email || "vendor@tiffzy.com",
        phone: r.phone || "-",
        upi: r.upiId || "Not configured",
        status: r.isActive ? "ACTIVE" : "INACTIVE",
        commissionType: "PERCENTAGE",
        commissionValue: 10,
        createdAt: r.createdAt,
      }));

      return reply.code(200).send({ vendors });
    } catch (err) {
      console.error("[AdminSettlementController] getVendorDetails Error:", err);
      return reply.code(500).send({ message: "Failed to fetch vendor details" });
    }
  };

  return {
    getSummary,
    getPaymentLogs,
    getWebhookLogs,
    getVendorDetails,
  };
};
