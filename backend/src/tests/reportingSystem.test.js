import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../prisma.js";
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
import { generateCSV, generatePDFReport } from "../services/reportExportService.js";

test("Reporting Module Suite - Comprehensive Financial, Multi-Tenant & Export Verification", async (t) => {
  const timestamp = Date.now();

  // Create Restaurant A and Restaurant B for Multi-Tenant Isolation Testing
  const restA = await prisma.restaurant.create({
    data: {
      name: `Report Rest A ${timestamp}`,
      slug: `report-rest-a-${timestamp}`,
      email: `resta_${timestamp}@tiffzy.com`,
    },
  });

  const restB = await prisma.restaurant.create({
    data: {
      name: `Report Rest B ${timestamp}`,
      slug: `report-rest-b-${timestamp}`,
      email: `restb_${timestamp}@tiffzy.com`,
    },
  });

  // Create Menu Items for Rest A
  const itemA1 = await prisma.menuItem.create({
    data: {
      restaurantId: restA.id,
      name: "Paneer Butter Masala",
      category: "Main Course",
      price: 300,
    },
  });

  // Create Order 1 for Rest A: Subtotal 900, Discount 50, Tax 50, Total 900
  const orderA1 = await prisma.order.create({
    data: {
      restaurantId: restA.id,
      orderNo: `ORD-A1-${timestamp}`,
      subtotal: 900,
      discountAmount: 50,
      taxAmount: 50,
      serviceChargeAmount: 0,
      total: 900,
      paymentMode: "SPLIT",
      paymentStatus: "SUCCESS",
      status: "DELIVERED",
      customerName: "Ramesh Customer",
      tableNo: "T1",
      items: {
        create: [
          { menuItemId: itemA1.id, itemName: itemA1.name, qty: 3, price: 300, total: 900 },
        ],
      },
    },
  });

  // Split Payments for Order A1: ₹500 Cash + ₹400 UPI (Total = ₹900)
  const payA1_Cash = await prisma.payment.create({
    data: {
      restaurantId: restA.id,
      orderId: orderA1.id,
      amount: 500,
      paymentMethod: "CASH",
      status: "SUCCESS",
    },
  });

  const payA1_UPI = await prisma.payment.create({
    data: {
      restaurantId: restA.id,
      orderId: orderA1.id,
      amount: 400,
      paymentMethod: "UPI",
      status: "SUCCESS",
    },
  });

  // Order A2 for Rest A: Cancelled Order ₹400
  const orderA2_Cancelled = await prisma.order.create({
    data: {
      restaurantId: restA.id,
      orderNo: `ORD-A2-${timestamp}`,
      subtotal: 400,
      discountAmount: 0,
      taxAmount: 0,
      total: 400,
      status: "CANCELLED",
      notes: "Customer changed mind",
      statusEvents: {
        create: { status: "CANCELLED", notes: "Customer changed mind", changedByName: "Manager" },
      },
    },
  });

  // Order B1 for Rest B (Isolated tenant): Total ₹1,500
  const orderB1 = await prisma.order.create({
    data: {
      restaurantId: restB.id,
      orderNo: `ORD-B1-${timestamp}`,
      subtotal: 1500,
      discountAmount: 0,
      taxAmount: 75,
      total: 1575,
      paymentMode: "CARD",
      paymentStatus: "SUCCESS",
      status: "DELIVERED",
    },
  });

  await t.test("1. Sales Report - Split Payment Non-Double-Counting", async () => {
    const report = await getSalesReport({
      prisma,
      restaurantId: restA.id,
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
    });

    assert.equal(report.summary.totalOrders, 1); // Excludes CANCELLED
    assert.equal(report.summary.grossSales, 900); // Order total counted ONCE
    assert.equal(report.summary.discountAmount, 50);
    assert.equal(report.summary.taxAmount, 50);
    assert.equal(report.summary.netSales, 900); // 900 - 50 + 50 = 900
    assert.equal(report.summary.paymentBreakdown.cash, 500);
    assert.equal(report.summary.paymentBreakdown.upi, 400);
  });

  await t.test("2. GST / Tax Report Calculations", async () => {
    const report = await getGstTaxReport({
      prisma,
      restaurantId: restA.id,
    });

    assert.equal(report.summary.orderCount, 1);
    assert.equal(report.summary.totalTaxableValue, 850); // 900 - 50 discount = 850
    assert.equal(report.summary.totalCgst, 25);
    assert.equal(report.summary.totalSgst, 25);
    assert.equal(report.summary.totalTaxCollected, 50);
  });

  await t.test("3. Item & Category Sales Report Aggregations", async () => {
    const itemReport = await getItemSalesReport({
      prisma,
      restaurantId: restA.id,
    });

    assert.equal(itemReport.summary.totalItemsCount, 1);
    assert.equal(itemReport.items[0].itemName, "Paneer Butter Masala");
    assert.equal(itemReport.items[0].qty, 3);
    assert.equal(itemReport.items[0].grossSales, 900);

    const catReport = await getCategorySalesReport({
      prisma,
      restaurantId: restA.id,
    });

    assert.equal(catReport.summary.totalCategories, 1);
    assert.equal(catReport.categories[0].category, "Main Course");
    assert.equal(catReport.categories[0].netSales, 900);
    assert.equal(catReport.categories[0].salesPercentage, 100);
  });

  await t.test("4. Cancellation Report", async () => {
    const cancelReport = await getCancellationReport({
      prisma,
      restaurantId: restA.id,
    });

    assert.equal(cancelReport.summary.totalCancelledOrders, 1);
    assert.equal(cancelReport.summary.totalCancelledAmount, 400);
    assert.equal(cancelReport.cancellations[0].orderNo, `ORD-A2-${timestamp}`);
    assert.equal(cancelReport.cancellations[0].reason, "Customer changed mind");
  });

  await t.test("5. Payment Report", async () => {
    const payReport = await getPaymentReport({
      prisma,
      restaurantId: restA.id,
    });

    assert.equal(payReport.summary.totalCollected, 900);
    assert.equal(payReport.summary.methodSummary.cash, 500);
    assert.equal(payReport.summary.methodSummary.upi, 400);
  });

  await t.test("6. Multi-Tenant Isolation Verification", async () => {
    const reportA = await getSalesReport({ prisma, restaurantId: restA.id });
    const reportB = await getSalesReport({ prisma, restaurantId: restB.id });

    // Rest A report MUST NOT contain Rest B orders
    assert.equal(reportA.summary.totalOrders, 1);
    assert.equal(reportA.summary.grossSales, 900);

    // Rest B report MUST NOT contain Rest A orders
    assert.equal(reportB.summary.totalOrders, 1);
    assert.equal(reportB.summary.grossSales, 1500);
  });

  await t.test("7. CSV & PDF Export Generation Output", async () => {
    // Test CSV Export
    const csvStr = generateCSV(
      [{ orderNo: "ORD-101", customer: "Anil", total: 500 }],
      [
        { key: "orderNo", label: "Order #" },
        { key: "customer", label: "Customer" },
        { key: "total", label: "Total (₹)" },
      ]
    );

    assert.ok(csvStr.includes('"Order #"'));
    assert.ok(csvStr.includes('"ORD-101"'));

    // Test PDF Generation
    const pdfBuf = await generatePDFReport({
      title: "Sales Report Test",
      restaurantName: "Tiffzy Cafe",
      dataArray: [{ orderNo: "ORD-101", total: "500" }],
      columns: [{ key: "orderNo", label: "Order #" }, { key: "total", label: "Total" }],
      summary: { "Gross Sales": "₹500" },
    });

    assert.ok(Buffer.isBuffer(pdfBuf));
    assert.ok(pdfBuf.length > 500);
  });

  // Cleanup test data
  await prisma.payment.deleteMany({ where: { restaurantId: { in: [restA.id, restB.id] } } });
  await prisma.orderStatusEvent.deleteMany({ where: { order: { restaurantId: { in: [restA.id, restB.id] } } } });
  await prisma.orderItem.deleteMany({ where: { order: { restaurantId: { in: [restA.id, restB.id] } } } });
  await prisma.order.deleteMany({ where: { restaurantId: { in: [restA.id, restB.id] } } });
  await prisma.menuItem.deleteMany({ where: { restaurantId: { in: [restA.id, restB.id] } } });
  await prisma.restaurant.deleteMany({ where: { id: { in: [restA.id, restB.id] } } });
});
