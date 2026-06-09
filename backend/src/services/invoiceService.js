import { toSubunit } from "./moneyService.js";

const formatInr = (valueSubunit) => {
  const v = Number(valueSubunit || 0);
  const abs = Math.abs(v);
  const rupees = (abs / 100).toFixed(2);
  return `${v < 0 ? "-" : ""}INR ${rupees}`;
};

export const buildInvoicePdf = async ({ order } = {}) => {
  const mod = await import("pdfkit");
  const PDFDocument = mod.default || mod;

  const doc = new PDFDocument({ size: "A4", margin: 40 });

  const restaurant = order?.restaurant || {};
  const items = Array.isArray(order?.items) ? order.items : [];

  const subtotal = toSubunit(order?.subtotal || 0);
  const taxAmount = toSubunit(order?.taxAmount || 0);
  const serviceCharge = toSubunit(order?.serviceChargeAmount || 0);
  const discount = toSubunit(order?.discountAmount || 0);
  const total = toSubunit(order?.total || 0);

  doc.fontSize(18).text(String(restaurant.name || "Restaurant"), { align: "left" });
  doc.moveDown(0.25);
  if (restaurant.gstNumber) doc.fontSize(10).fillColor("#444").text(`GST: ${restaurant.gstNumber}`);
  if (restaurant.addressLine1) doc.fontSize(10).fillColor("#444").text(String(restaurant.addressLine1));
  const cityLine = [restaurant.city, restaurant.state, restaurant.pincode].filter(Boolean).join(", ");
  if (cityLine) doc.fontSize(10).fillColor("#444").text(cityLine);
  doc.moveDown(0.75);

  doc.fillColor("#111").fontSize(12).text(`Invoice: ${order?.invoiceNo || "-"}`);
  doc.fontSize(10).fillColor("#444").text(`Order: ${order?.orderNo || order?.id || "-"}`);
  doc.fontSize(10).fillColor("#444").text(`Date: ${new Date(order?.createdAt || Date.now()).toLocaleString()}`);
  doc.moveDown(0.75);

  doc.fillColor("#111").fontSize(11).text("Bill To");
  doc.fontSize(10).fillColor("#444").text(`${order?.customerName || "Walk-in customer"}`);
  if (order?.phone) doc.fontSize(10).fillColor("#444").text(`Phone: ${order.phone}`);
  if (order?.email) doc.fontSize(10).fillColor("#444").text(`Email: ${order.email}`);
  if (order?.tableNo) doc.fontSize(10).fillColor("#444").text(`Table: ${order.tableNo}`);
  if (order?.deliveryAddress) {
    doc.fontSize(10).fillColor("#444").text("Delivery Address:");
    doc.fontSize(10).fillColor("#444").text(String(order.deliveryAddress), { indent: 14 });
  }
  doc.moveDown(0.75);

  doc.fillColor("#111").fontSize(11).text("Items");
  doc.moveDown(0.25);

  const startX = doc.x;
  const colName = startX;
  const colQty = 360;
  const colPrice = 410;
  const colTotal = 480;

  doc.fontSize(9).fillColor("#666");
  doc.text("Item", colName, doc.y, { continued: true });
  doc.text("Qty", colQty, doc.y, { continued: true });
  doc.text("Price", colPrice, doc.y, { continued: true });
  doc.text("Total", colTotal, doc.y);
  doc.moveDown(0.25);

  doc.strokeColor("#ddd").lineWidth(1).moveTo(startX, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.35);

  doc.fontSize(10).fillColor("#111");
  items.forEach((item) => {
    const qty = Number(item.qty || 0);
    const price = toSubunit(item.price || 0);
    const lineTotal = toSubunit(item.total || 0);
    doc.text(String(item.itemName || ""), colName, doc.y, { width: 320, continued: true });
    doc.text(String(qty), colQty, doc.y, { width: 40, continued: true });
    doc.text(formatInr(price), colPrice, doc.y, { width: 70, continued: true });
    doc.text(formatInr(lineTotal), colTotal, doc.y);
    doc.moveDown(0.25);
  });

  doc.moveDown(0.5);
  doc.strokeColor("#ddd").lineWidth(1).moveTo(startX, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  const summaryLine = (label, valueSubunit) => {
    doc.fontSize(10).fillColor("#444").text(label, colPrice, doc.y, { width: 70, continued: true });
    doc.fontSize(10).fillColor("#111").text(formatInr(valueSubunit), colTotal, doc.y);
  };

  summaryLine("Subtotal", subtotal);
  summaryLine("GST", taxAmount);
  summaryLine("Service", serviceCharge);
  summaryLine("Discount", -discount);
  doc.moveDown(0.25);
  doc.fontSize(11).fillColor("#111").text("Total", colPrice, doc.y, { width: 70, continued: true });
  doc.fontSize(11).fillColor("#111").text(formatInr(total), colTotal, doc.y);

  doc.moveDown(1);
  doc.fontSize(9).fillColor("#666").text(`Payment: ${order?.paymentMode || "N/A"} (${order?.paymentStatus || "PENDING"})`);

  doc.end();
  return doc;
};
