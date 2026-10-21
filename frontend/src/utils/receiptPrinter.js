/**
 * receiptPrinter.js
 * Authoritative bill and receipt printing utility for Tiffzy POS and Server Station.
 * Reuses existing 80mm/320px thermal receipt formatting with print-friendly CSS.
 */

export const escapeReceiptText = (value) =>
    String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

export const formatReceiptAmount = (value) => `₹${Number(value || 0).toFixed(2)}`;

export const getReceiptItemLineTotal = (item) => {
    const directTotal = Number(item?.total || 0);
    if (directTotal > 0) return directTotal;
    return Number(item?.qty || 0) * Number(item?.price || 0);
};

export const getReceiptOrderTotal = (order) => {
    const directTotal = Number(order?.total || 0);
    if (directTotal > 0) return directTotal;
    if (!Array.isArray(order?.items)) return 0;
    return order.items.reduce(
        (sum, item) => sum + getReceiptItemLineTotal(item),
        0
    );
};

/**
 * Builds standard 80mm (320px) thermal receipt HTML.
 */
export const buildReceiptPrintMarkup = ({
    restaurantName = "Tiffzy Restaurant",
    restaurantAddress = "",
    restaurantPhone = "",
    tableLabel = "--",
    serverName = "",
    activeOrders = [],
    tableReceiptTotal = 0,
    logoUrl = "",
    paymentMode = "CASH",
    paymentStatus = "PAID",
    referenceNo = "",
} = {}) => {
    const ordersList = Array.isArray(activeOrders) ? activeOrders : [];
    const calculatedGrandTotal = tableReceiptTotal > 0
        ? tableReceiptTotal
        : ordersList.reduce((sum, o) => sum + getReceiptOrderTotal(o), 0);

    const rows = ordersList
        .map((order) => {
            const orderLabel = order?.orderNo ? order.orderNo : `#${order?.id || ""}`;
            const status = String(order?.status || "").toUpperCase();
            const orderTotal = getReceiptOrderTotal(order);
            const itemsMarkup = (Array.isArray(order?.items) ? order.items : [])
                .map((item) => {
                    const lineTotal = getReceiptItemLineTotal(item);
                    return `
                        <tr>
                            <td>${Number(item?.qty || 0)} x ${escapeReceiptText(item?.itemName || "Item")}</td>
                            <td style="text-align:right;">${formatReceiptAmount(lineTotal)}</td>
                        </tr>
                    `;
                })
                .join("");

            let snapshot = order?.billingSnapshot;
            if (typeof snapshot === "string") {
                try { snapshot = JSON.parse(snapshot); } catch { snapshot = null; }
            }

            const taxesList = Array.isArray(snapshot?.taxes) ? snapshot.taxes : [];
            const chargesList = Array.isArray(snapshot?.charges) ? snapshot.charges : [];

            let breakdownMarkup = "";
            if (taxesList.length > 0) {
                breakdownMarkup += taxesList.map((t) => `
                    <tr>
                        <td style="color:#666; font-size:11px;">${escapeReceiptText(t.name || "Tax")}${t.rate ? ` (${t.rate}%)` : ""}</td>
                        <td style="text-align:right; font-size:11px;">${formatReceiptAmount(t.amount || 0)}</td>
                    </tr>
                `).join("");
            } else if (Number(order?.taxAmount || 0) > 0) {
                breakdownMarkup += `
                    <tr>
                        <td style="color:#666; font-size:11px;">Tax</td>
                        <td style="text-align:right; font-size:11px;">${formatReceiptAmount(order.taxAmount)}</td>
                    </tr>
                `;
            }

            if (chargesList.length > 0) {
                breakdownMarkup += chargesList.map((c) => `
                    <tr>
                        <td style="color:#666; font-size:11px;">${escapeReceiptText(c.name || "Charge")}</td>
                        <td style="text-align:right; font-size:11px;">${formatReceiptAmount(c.amount || 0)}</td>
                    </tr>
                `).join("");
            } else if (Number(order?.serviceChargeAmount || 0) > 0) {
                breakdownMarkup += `
                    <tr>
                        <td style="color:#666; font-size:11px;">Service Charge</td>
                        <td style="text-align:right; font-size:11px;">${formatReceiptAmount(order.serviceChargeAmount)}</td>
                    </tr>
                `;
            }

            if (Number(order?.discountAmount || snapshot?.discount || 0) > 0) {
                breakdownMarkup += `
                    <tr>
                        <td style="color:#10b981; font-size:11px;">Discount</td>
                        <td style="text-align:right; color:#10b981; font-size:11px;">-${formatReceiptAmount(order?.discountAmount || snapshot?.discount)}</td>
                    </tr>
                `;
            }

            return `
                <div class="order-block">
                    <div class="order-head">
                        <span>${escapeReceiptText(orderLabel)}</span>
                        <span>${escapeReceiptText(status)}</span>
                    </div>
                    <table>
                        <tbody>${itemsMarkup || `<tr><td colspan="2">No items found.</td></tr>`}</tbody>
                        ${breakdownMarkup ? `<tfoot>${breakdownMarkup}</tfoot>` : ""}
                    </table>
                    <div class="order-total">
                        <span>Order Total</span>
                        <strong>${formatReceiptAmount(orderTotal)}</strong>
                    </div>
                </div>
            `;
        })
        .join("");

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Tiffzy Receipt - Table ${escapeReceiptText(tableLabel || "--")}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 12px; color: #1a1a1a; }
    .receipt { width: 320px; margin: 0 auto; border: 1px dashed #999; padding: 14px; border-radius: 4px; }
    .brand { text-align: center; border-bottom: 1px dashed #bbb; padding-bottom: 8px; margin-bottom: 8px; }
    .brand img { width: 32px; height: 32px; object-fit: contain; margin-bottom: 4px; }
    .brand h1 { margin: 0; font-size: 18px; line-height: 1.2; font-weight: 800; }
    .brand .address { font-size: 10px; color: #555; margin-top: 2px; }
    .brand .contact { font-size: 10px; color: #555; }
    .meta { font-size: 11px; color: #444; margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 6px; }
    .meta-row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 2px; }
    .order-block { border: 1px solid #ddd; border-radius: 6px; padding: 6px; margin-bottom: 6px; }
    .order-head { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 700; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 3px 0; vertical-align: top; }
    .order-total { margin-top: 4px; display: flex; justify-content: space-between; font-size: 12px; }
    .payment-summary { margin-top: 8px; border-top: 1px dashed #bbb; padding-top: 6px; font-size: 12px; }
    .payment-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .grand-total { margin-top: 6px; border-top: 2px solid #333; padding-top: 6px; display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; }
    .status-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; background: #e0f2fe; color: #0369a1; }
    .status-paid { background: #dcfce7; color: #15803d; }
    .thanks { margin-top: 12px; text-align: center; font-size: 11px; color: #666; border-top: 1px dashed #bbb; padding-top: 8px; }
    @media print {
      body { padding: 0; }
      .receipt { border: none; width: 100%; margin: 0; padding: 4px; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="brand">
      ${logoUrl ? `<img src="${escapeReceiptText(logoUrl)}" alt="Logo" />` : ""}
      <h1>${escapeReceiptText(restaurantName || "Tiffzy")}</h1>
      ${restaurantAddress ? `<div class="address">${escapeReceiptText(restaurantAddress)}</div>` : ""}
      ${restaurantPhone ? `<div class="contact">Tel: ${escapeReceiptText(restaurantPhone)}</div>` : ""}
    </div>
    <div class="meta">
      <div class="meta-row">
        <span><strong>Table: ${escapeReceiptText(tableLabel || "--")}</strong></span>
        <span>${escapeReceiptText(new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }))} ${escapeReceiptText(new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }))}</span>
      </div>
      ${serverName ? `<div class="meta-row"><span>Server: <strong>${escapeReceiptText(serverName)}</strong></span></div>` : ""}
    </div>

    ${rows || `<div class="order-block">No active orders recorded for this table.</div>`}

    <div class="payment-summary">
      <div class="payment-row">
        <span>Payment Method</span>
        <strong>${escapeReceiptText(paymentMode)}</strong>
      </div>
      <div class="payment-row">
        <span>Payment Status</span>
        <span class="status-badge status-paid">${escapeReceiptText(paymentStatus || "PAID")}</span>
      </div>
      ${referenceNo ? `
      <div class="payment-row" style="font-size:10px; color:#666;">
        <span>Ref / UTR</span>
        <span>${escapeReceiptText(referenceNo)}</span>
      </div>
      ` : ""}
      <div class="grand-total">
        <span>Total Paid</span>
        <span>${formatReceiptAmount(calculatedGrandTotal)}</span>
      </div>
    </div>

    <div class="thanks">
      <p style="margin:0 0 4px 0; font-weight:600;">Thank you for dining with us!</p>
      <p style="margin:0; font-size:10px; color:#999;">Powered by Tiffzy</p>
    </div>
  </div>
</body>
</html>
`;
};

/**
 * Triggers browser print using window.open popup.
 */
export const printReceiptWindow = ({ markup, onBlocked } = {}) => {
    if (typeof window === "undefined") return false;

    const printWindow = window.open("", "_blank", "width=380,height=640");
    if (!printWindow) {
        if (typeof onBlocked === "function") {
            onBlocked();
        }
        return false;
    }

    try {
        printWindow.document.open();
        printWindow.document.write(markup);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            try {
                printWindow.print();
            } catch {
                // Ignore popup print errors if window was closed
            }
        }, 300);
        return true;
    } catch {
        return false;
    }
};
