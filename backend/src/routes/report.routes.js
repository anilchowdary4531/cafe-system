import {
  getSalesReport,
  getGstTaxReport,
  getItemSalesReport,
  getCategorySalesReport,
  getWaiterReport,
  getKotReport,
  getCancellationReport,
  getPaymentReport,
  getDiscountReport,
  getTableReport,
  getShiftReport,
  getInventoryConsumptionReport,
  getWastageReport,
} from "../services/reportService.js";

import {
  generateCSV,
  generateExcelHTML,
  generatePDFReport,
} from "../services/reportExportService.js";

export default async function reportRoutes(app, deps = {}) {
  const prisma = deps.prisma;

  const extractActor = (req) => {
    const user = req.user || {};
    return {
      userId: user.id || user.userId || null,
      userName: user.name || user.email || "Staff",
      role: user.role || "STAFF",
      restaurantId: user.restaurantId || req.headers["x-restaurant-id"] || null,
    };
  };

  const getTargetRestaurantId = (req) => {
    const actor = extractActor(req);
    return req.query.restaurantId || actor.restaurantId;
  };

  // Helper for audit logging
  const logReportExport = async (restaurantId, reportType, format, actor) => {
    try {
      if (restaurantId) {
        await prisma.tableOperationLog.create({
          data: {
            restaurantId: Number(restaurantId),
            operationType: "REPORT_EXPORTED",
            performedByUserId: actor.userId || null,
            performedByName: actor.userName || "Staff",
            performedByUserRole: actor.role || "STAFF",
            details: { reportType, format, timestamp: new Date() },
          },
        });
      }
    } catch (e) {
      console.error("[ReportRoutes] Failed to log audit event:", e.message);
    }
  };

  // 1. Sales Report
  app.get("/api/reports/sales", async (req, reply) => {
    try {
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const report = await getSalesReport({
        prisma,
        restaurantId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        orderType: req.query.orderType,
        paymentMethod: req.query.paymentMethod,
        page: req.query.page,
        limit: req.query.limit,
      });

      return reply.send({ success: true, ...report });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/sales error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch sales report" });
    }
  });

  // 2. GST / Tax Report
  app.get("/api/reports/gst", async (req, reply) => {
    try {
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const report = await getGstTaxReport({
        prisma,
        restaurantId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        page: req.query.page,
        limit: req.query.limit,
      });

      return reply.send({ success: true, ...report });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/gst error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch GST report" });
    }
  });

  // 3. Item Sales Report
  app.get("/api/reports/items", async (req, reply) => {
    try {
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const report = await getItemSalesReport({
        prisma,
        restaurantId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        category: req.query.category,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit,
      });

      return reply.send({ success: true, ...report });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/items error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch item sales report" });
    }
  });

  // 4. Category Sales Report
  app.get("/api/reports/categories", async (req, reply) => {
    try {
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const report = await getCategorySalesReport({
        prisma,
        restaurantId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });

      return reply.send({ success: true, ...report });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/categories error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch category sales report" });
    }
  });

  // 5. Waiter / Server Report
  app.get("/api/reports/waiters", async (req, reply) => {
    try {
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const report = await getWaiterReport({
        prisma,
        restaurantId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });

      return reply.send({ success: true, ...report });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/waiters error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch waiter report" });
    }
  });

  // 6. KOT Report
  app.get("/api/reports/kots", async (req, reply) => {
    try {
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const report = await getKotReport({
        prisma,
        restaurantId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status,
        stationId: req.query.stationId,
        page: req.query.page,
        limit: req.query.limit,
      });

      return reply.send({ success: true, ...report });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/kots error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch KOT report" });
    }
  });

  // 7. Cancellation Report
  app.get("/api/reports/cancellations", async (req, reply) => {
    try {
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const report = await getCancellationReport({
        prisma,
        restaurantId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        page: req.query.page,
        limit: req.query.limit,
      });

      return reply.send({ success: true, ...report });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/cancellations error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch cancellation report" });
    }
  });

  // 8. Payment Report
  app.get("/api/reports/payments", async (req, reply) => {
    try {
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const report = await getPaymentReport({
        prisma,
        restaurantId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        page: req.query.page,
        limit: req.query.limit,
      });

      return reply.send({ success: true, ...report });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/payments error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch payment report" });
    }
  });

  // 9. Discount Report
  app.get("/api/reports/discounts", async (req, reply) => {
    try {
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const report = await getDiscountReport({
        prisma,
        restaurantId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        page: req.query.page,
        limit: req.query.limit,
      });

      return reply.send({ success: true, ...report });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/discounts error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch discount report" });
    }
  });

  // 10. Table Report
  app.get("/api/reports/tables", async (req, reply) => {
    try {
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const report = await getTableReport({
        prisma,
        restaurantId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        page: req.query.page,
        limit: req.query.limit,
      });

      return reply.send({ success: true, ...report });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/tables error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch table report" });
    }
  });

  // 11. Shift Report
  app.get("/api/reports/shifts", async (req, reply) => {
    try {
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const report = await getShiftReport({
        prisma,
        restaurantId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        page: req.query.page,
        limit: req.query.limit,
      });

      return reply.send({ success: true, ...report });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/shifts error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch shift report" });
    }
  });

  // 12. Inventory Consumption Report
  app.get("/api/reports/inventory", async (req, reply) => {
    try {
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const report = await getInventoryConsumptionReport({
        prisma,
        restaurantId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        page: req.query.page,
        limit: req.query.limit,
      });

      return reply.send({ success: true, ...report });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/inventory error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch inventory consumption report" });
    }
  });

  // 13. Wastage Report
  app.get("/api/reports/wastage", async (req, reply) => {
    try {
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const report = await getWastageReport({
        prisma,
        restaurantId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        page: req.query.page,
        limit: req.query.limit,
      });

      return reply.send({ success: true, ...report });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/wastage error:", err);
      return reply.status(500).send({ error: err.message || "Failed to fetch wastage report" });
    }
  });

  // Universal Report Export Endpoint: GET /api/reports/export?type=sales&format=csv|excel|pdf
  app.get("/api/reports/export", async (req, reply) => {
    try {
      const actor = extractActor(req);
      const restaurantId = getTargetRestaurantId(req);
      if (!restaurantId) return reply.status(400).send({ error: "restaurantId required" });

      const reportType = String(req.query.type || "sales").toLowerCase();
      const format = String(req.query.format || "csv").toLowerCase();

      const restaurant = await prisma.restaurant.findUnique({
        where: { id: Number(restaurantId) },
        select: { name: true },
      });

      const restaurantName = restaurant?.name || "Tiffzy POS";
      const dateRangeStr = `${req.query.startDate || "Default"} to ${req.query.endDate || "Today"}`;

      let dataArray = [];
      let columns = [];
      let summary = null;
      let title = "Report";

      switch (reportType) {
        case "sales": {
          title = "Sales Report";
          const rep = await getSalesReport({ prisma, restaurantId, ...req.query, limit: 1000 });
          dataArray = rep.orders || [];
          summary = rep.summary;
          columns = [
            { key: "orderNo", label: "Order #" },
            { key: "customerName", label: "Customer" },
            { key: "fulfillment", label: "Source" },
            { key: "paymentMode", label: "Method" },
            { key: "paymentStatus", label: "Status" },
            { key: "subtotal", label: "Subtotal (₹)" },
            { key: "discountAmount", label: "Discount (₹)" },
            { key: "taxAmount", label: "Tax (₹)" },
            { key: "total", label: "Total (₹)" },
          ];
          break;
        }
        case "gst": {
          title = "GST Tax Report";
          const rep = await getGstTaxReport({ prisma, restaurantId, ...req.query, limit: 1000 });
          dataArray = rep.orders || [];
          summary = rep.summary;
          columns = [
            { key: "invoiceNo", label: "Invoice #" },
            { key: "orderNo", label: "Order #" },
            { key: "taxableValue", label: "Taxable Value (₹)" },
            { key: "cgst", label: "CGST (₹)" },
            { key: "sgst", label: "SGST (₹)" },
            { key: "igst", label: "IGST (₹)" },
            { key: "totalTax", label: "Total Tax (₹)" },
          ];
          break;
        }
        case "items": {
          title = "Item Sales Report";
          const rep = await getItemSalesReport({ prisma, restaurantId, ...req.query, limit: 1000 });
          dataArray = rep.items || [];
          summary = rep.summary;
          columns = [
            { key: "itemName", label: "Item Name" },
            { key: "variantName", label: "Variant" },
            { key: "qty", label: "Qty Sold" },
            { key: "unitPrice", label: "Unit Price (₹)" },
            { key: "grossSales", label: "Gross Sales (₹)" },
            { key: "netSales", label: "Net Sales (₹)" },
          ];
          break;
        }
        case "categories": {
          title = "Category Sales Report";
          const rep = await getCategorySalesReport({ prisma, restaurantId, ...req.query });
          dataArray = rep.categories || [];
          summary = rep.summary;
          columns = [
            { key: "category", label: "Category" },
            { key: "itemsSold", label: "Items Count" },
            { key: "totalQty", label: "Qty Sold" },
            { key: "grossSales", label: "Gross Sales (₹)" },
            { key: "salesPercentage", label: "Share (%)" },
          ];
          break;
        }
        case "waiters": {
          title = "Waiter Server Report";
          const rep = await getWaiterReport({ prisma, restaurantId, ...req.query });
          dataArray = rep.waiters || [];
          summary = rep.summary;
          columns = [
            { key: "waiterName", label: "Server Name" },
            { key: "orderCount", label: "Orders" },
            { key: "itemsServed", label: "Items Served" },
            { key: "grossSales", label: "Gross Sales (₹)" },
            { key: "netSales", label: "Net Sales (₹)" },
            { key: "cashCollections", label: "Cash (₹)" },
            { key: "digitalCollections", label: "Digital (₹)" },
          ];
          break;
        }
        default: {
          title = `${reportType.toUpperCase()} Report`;
          const rep = await getSalesReport({ prisma, restaurantId, ...req.query, limit: 1000 });
          dataArray = rep.orders || [];
          summary = rep.summary;
          columns = [
            { key: "orderNo", label: "Order #" },
            { key: "total", label: "Total (₹)" },
          ];
          break;
        }
      }

      await logReportExport(restaurantId, reportType, format, actor);

      if (format === "csv") {
        const csvContent = generateCSV(dataArray, columns);
        reply.header("Content-Type", "text/csv; charset=utf-8");
        reply.header("Content-Disposition", `attachment; filename="${reportType}_report_${Date.now()}.csv"`);
        return reply.send(csvContent);
      }

      if (format === "excel") {
        const htmlContent = generateExcelHTML(title, dataArray, columns, summary);
        reply.header("Content-Type", "application/vnd.ms-excel; charset=utf-8");
        reply.header("Content-Disposition", `attachment; filename="${reportType}_report_${Date.now()}.xls"`);
        return reply.send(htmlContent);
      }

      if (format === "pdf") {
        const pdfBuffer = await generatePDFReport({
          title,
          restaurantName,
          dateRange: dateRangeStr,
          dataArray,
          columns,
          summary,
        });
        reply.header("Content-Type", "application/pdf");
        reply.header("Content-Disposition", `inline; filename="${reportType}_report_${Date.now()}.pdf"`);
        return reply.send(pdfBuffer);
      }

      return reply.status(400).send({ error: "Invalid format. Supported: csv, excel, pdf" });
    } catch (err) {
      console.error("[ReportRoutes] GET /api/reports/export error:", err);
      return reply.status(500).send({ error: err.message || "Failed to export report" });
    }
  });
}
