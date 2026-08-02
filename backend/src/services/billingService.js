import { clampSubunit, fromSubunit, toSubunit } from "./moneyService.js";

const toBasisPoints = (percent) => {
  const p = Number(percent || 0);
  if (!Number.isFinite(p)) return 0;
  return Math.round(p * 100); // 1% = 100bp
};

const percentOf = (amountSubunit, percent) => {
  const bp = toBasisPoints(percent);
  // amount * bp / 10000, rounded to nearest subunit.
  return Math.round(clampSubunit(amountSubunit) * bp / 10000);
};

export const computeBill = ({
  items = [],
  taxEnabled = false,
  taxType = "EXCLUSIVE",
  taxPercent = 0,
  serviceChargeEnabled = false,
  serviceChargePercent = 0,
  discountSubunit = 0,
} = {}) => {
  const normalizedItems = Array.isArray(items) ? items : [];

  const subtotalSubunit = normalizedItems.reduce((sum, item) => {
    const qty = Math.max(1, Number(item?.qty || 1));
    const unit = clampSubunit(item?.priceSubunit);
    return sum + unit * qty;
  }, 0);

  const discount = Math.max(0, clampSubunit(discountSubunit));

  let taxSubunit = 0;
  if (taxEnabled) {
    taxSubunit = percentOf(subtotalSubunit, taxPercent);
  }

  let serviceChargeSubunit = 0;
  if (serviceChargeEnabled) {
    serviceChargeSubunit = percentOf(subtotalSubunit, serviceChargePercent);
  }

  const normalizedTaxType = String(taxType || "EXCLUSIVE").toUpperCase();
  const totalBeforeDiscount =
    normalizedTaxType === "INCLUSIVE" ? subtotalSubunit + serviceChargeSubunit : subtotalSubunit + taxSubunit + serviceChargeSubunit;

  const totalSubunit = Math.max(0, totalBeforeDiscount - discount);

  return {
    subtotalSubunit,
    taxSubunit,
    serviceChargeSubunit,
    discountSubunit: discount,
    totalSubunit,
    // Backward-compatible float fields for existing schema.
    subtotal: fromSubunit(subtotalSubunit),
    taxAmount: fromSubunit(taxSubunit),
    serviceChargeAmount: fromSubunit(serviceChargeSubunit),
    discountAmount: fromSubunit(discount),
    total: fromSubunit(totalSubunit),
  };
};

export const toPriceSubunitItems = ({ menuItems = [], items = [] } = {}) => {
  const byId = new Map((menuItems || []).map((m) => [Number(m.id), m]));
  const byName = new Map((menuItems || []).map((m) => [String(m.name || "").trim().toLowerCase(), m]));

  const normalized = [];
  for (const raw of Array.isArray(items) ? items : []) {
    const menuItemId = Number(raw?.menuItemId || raw?.id || 0);
    const rawName = String(raw?.itemName || raw?.name || "").trim().toLowerCase();
    const qty = Math.max(1, Number(raw?.qty || raw?.quantity || 1));

    let dbItem = byId.get(menuItemId) || byName.get(rawName);
    if (!dbItem && menuItems.length > 0) {
      dbItem = menuItems[0];
    }

    if (!dbItem) {
      const err = new Error("invalid_item");
      err.code = "invalid_item";
      throw err;
    }
    normalized.push({
      menuItemId: dbItem.id,
      itemName: String(dbItem.name || "").trim(),
      preparedByName: String(raw?.preparedByName || raw?.chefName || raw?.preparedBy || "").trim() || null,
      qty,
      priceSubunit: toSubunit(dbItem.price),
    });
  }

  return normalized;
};
