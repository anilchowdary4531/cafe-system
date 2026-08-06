import PDFDocument from "pdfkit";

const round2 = (num) => Math.round(Number(num || 0) * 100) / 100;

export const buildSettlementController = ({ prisma }) => {
  const getRangeDates = (range) => {
    const now = new Date();
    let fromDate = new Date();

    const normalizedRange = String(range || "daily").toLowerCase();
    if (normalizedRange === "daily" || normalizedRange === "today" || normalizedRange === "24h") {
      fromDate.setHours(0, 0, 0, 0); // Start of today
    } else if (normalizedRange === "weekly" || normalizedRange === "7d") {
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (normalizedRange === "monthly" || normalizedRange === "30d") {
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      fromDate.setHours(0, 0, 0, 0);
    }

    return { fromDate, now };
  };

  const calculateCommissionAndSettlement = (order, commissionRate = 0.10) => {
    const total = round2(order.total || order.amount || 0);
    const commission = round2(total * commissionRate);
    const settlementAmount = round2(Math.max(0, total - commission));
    return { total, commission, settlementAmount };
  };

  const getSummary = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const range = String(req.query?.range || "daily").toLowerCase();

      if (!restaurantId) {
        return reply.code(400).send({ message: "Invalid restaurant id" });
      }

      const { fromDate, now } = getRangeDates(range);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [restaurant, orders, todayOrdersCount] = await Promise.all([
        prisma.restaurant.findUnique({
          where: { id: restaurantId },
          select: { id: true, name: true, legalName: true, upiId: true },
        }),
        prisma.order.findMany({
          where: { restaurantId, createdAt: { gte: fromDate } },
          select: { id: true, total: true, status: true, paymentStatus: true, createdAt: true },
        }),
        prisma.order.count({
          where: { restaurantId, createdAt: { gte: todayStart } },
        }),
      ]);

      if (!restaurant) {
        return reply.code(404).send({ message: "Restaurant not found" });
      }

      let totalEarnings = 0;
      let totalCommission = 0;
      let settlementAmount = 0;
      let paidSettlement = 0;
      let pendingSettlement = 0;

      orders.forEach((order) => {
        const { total, commission, settlementAmount: netShare } = calculateCommissionAndSettlement(order);
        const pStatus = String(order.paymentStatus || "PENDING").toUpperCase();

        totalEarnings += total;
        totalCommission += commission;
        settlementAmount += netShare;

        if (pStatus === "PAID" || pStatus === "SUCCESS") {
          paidSettlement += netShare;
        } else {
          pendingSettlement += netShare;
        }
      });

      return reply.code(200).send({
        generatedAt: now.toISOString(),
        range,
        restaurant,
        summary: {
          todayOrders: todayOrdersCount,
          totalOrders: orders.length,
          totalEarnings: round2(totalEarnings),
          commission: round2(totalCommission),
          settlementAmount: round2(settlementAmount),
          paidSettlement: round2(paidSettlement),
          pendingSettlement: round2(pendingSettlement),
        },
      });
    } catch (err) {
      console.error("[SettlementController] getSummary Error:", err);
      return reply.code(500).send({ message: "Failed to fetch settlement summary" });
    }
  };

  const getOrders = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const page = Math.max(1, Number(req.query?.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 10)));
      const range = String(req.query?.range || "daily").toLowerCase();
      const statusFilter = String(req.query?.status || "ALL").toUpperCase();

      if (!restaurantId) {
        return reply.code(400).send({ message: "Invalid restaurant id" });
      }

      const { fromDate } = getRangeDates(range);

      const whereClause = {
        restaurantId,
        createdAt: { gte: fromDate },
        ...(statusFilter !== "ALL" ? { paymentStatus: statusFilter } : {}),
      };

      const skip = (page - 1) * limit;

      const [totalCount, orders] = await Promise.all([
        prisma.order.count({ where: whereClause }),
        prisma.order.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            orderNo: true,
            invoiceNo: true,
            customerName: true,
            phone: true,
            email: true,
            total: true,
            paymentStatus: true,
            paymentMode: true,
            status: true,
            createdAt: true,
          },
        }),
      ]);

      const formattedOrders = orders.map((order) => {
        const { total, commission, settlementAmount } = calculateCommissionAndSettlement(order);
        return {
          id: order.id,
          orderNo: order.invoiceNo || order.orderNo || `ORD-${order.id}`,
          customerName: order.customerName || "Customer",
          phone: order.phone || "-",
          total,
          commission,
          settlementAmount,
          paymentStatus: order.paymentStatus || "PENDING",
          paymentMode: order.paymentMode || "ONLINE",
          status: order.status || "PLACED",
          createdAt: order.createdAt,
        };
      });

      return reply.code(200).send({
        orders: formattedOrders,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    } catch (err) {
      console.error("[SettlementController] getOrders Error:", err);
      return reply.code(500).send({ message: "Failed to fetch settlement orders" });
    }
  };

  const exportCsv = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const range = String(req.query?.range || "daily").toLowerCase();
      const { fromDate } = getRangeDates(range);

      const orders = await prisma.order.findMany({
        where: { restaurantId, createdAt: { gte: fromDate } },
        orderBy: { createdAt: "desc" },
      });

      let csv = "Order ID,Date,Customer Name,Phone,Total Amount (INR),Tiffzy Commission (INR),Settlement Amount (INR),Payment Status\n";

      orders.forEach((order) => {
        const { total, commission, settlementAmount } = calculateCommissionAndSettlement(order);
        const orderNo = order.invoiceNo || order.orderNo || `ORD-${order.id}`;
        const dateStr = new Date(order.createdAt).toISOString().split("T")[0];
        const name = (order.customerName || "Customer").replace(/,/g, " ");
        const phone = order.phone || "-";
        const pStatus = order.paymentStatus || "PENDING";

        csv += `"${orderNo}","${dateStr}","${name}","${phone}",${total},${commission},${settlementAmount},"${pStatus}"\n`;
      });

      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", `attachment; filename=settlement_report_${range}_${Date.now()}.csv`);
      return reply.send(csv);
    } catch (err) {
      console.error("[SettlementController] exportCsv Error:", err);
      return reply.code(500).send({ message: "Failed to export CSV" });
    }
  };

  const exportPdf = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const range = String(req.query?.range || "daily").toLowerCase();
      const { fromDate, now } = getRangeDates(range);

      const [restaurant, orders] = await Promise.all([
        prisma.restaurant.findUnique({ where: { id: restaurantId } }),
        prisma.order.findMany({
          where: { restaurantId, createdAt: { gte: fromDate } },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const doc = new PDFDocument({ margin: 30, size: "A4" });

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `inline; filename=settlement_report_${range}_${Date.now()}.pdf`);

      doc.fontSize(20).text("Tiffzy - Settlement Report", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Restaurant: ${restaurant?.name || "Restaurant #" + restaurantId}`, { align: "center" });
      doc.text(`Range: ${range.toUpperCase()} | Generated: ${now.toLocaleDateString()}`, { align: "center" });
      doc.moveDown(1);

      let totalEarnings = 0;
      let totalCommission = 0;
      let settlementAmount = 0;

      orders.forEach((order) => {
        const { total, commission, settlementAmount: netShare } = calculateCommissionAndSettlement(order);
        totalEarnings += total;
        totalCommission += commission;
        settlementAmount += netShare;
      });

      doc.fontSize(14).text("Summary Metrics", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text(`Total Orders: ${orders.length}`);
      doc.text(`Total Earnings (Gross): INR ${round2(totalEarnings)}`);
      doc.text(`Tiffzy Commission (10%): INR ${round2(totalCommission)}`);
      doc.text(`Net Settlement Amount: INR ${round2(settlementAmount)}`);
      doc.moveDown(1);

      doc.fontSize(14).text("Order Settlement Breakdown", { underline: true });
      doc.moveDown(0.5);

      // Table Header
      doc.fontSize(9).text("Order ID | Date | Customer | Gross | Commission | Net Share | Status", { bold: true });
      doc.text("----------------------------------------------------------------------------------");

      orders.slice(0, 30).forEach((order) => {
        const { total, commission, settlementAmount: netShare } = calculateCommissionAndSettlement(order);
        const orderNo = order.invoiceNo || order.orderNo || `ORD-${order.id}`;
        const dateStr = new Date(order.createdAt).toISOString().split("T")[0];
        const name = (order.customerName || "Customer").slice(0, 10);
        const status = order.paymentStatus || "PENDING";

        doc.text(`${orderNo} | ${dateStr} | ${name} | INR ${total} | INR ${commission} | INR ${netShare} | ${status}`);
      });

      if (orders.length > 30) {
        doc.moveDown(0.5);
        doc.text(`... and ${orders.length - 30} more orders`);
      }

      doc.end();
      return reply.send(doc);
    } catch (err) {
      console.error("[SettlementController] exportPdf Error:", err);
      return reply.code(500).send({ message: "Failed to export PDF" });
    }
  };

  return {
    getSummary,
    getOrders,
    exportCsv,
    exportPdf,
  };
};
