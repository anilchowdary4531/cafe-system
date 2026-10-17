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

export const normalizeOrderType = (t) => {
  const norm = String(t || "").trim().toUpperCase();
  if (norm === "PICKUP" || norm === "TAKE_AWAY") return "TAKEAWAY";
  if (norm === "DINEIN" || norm === "TABLE") return "DINE_IN";
  return norm;
};

export const matchesOrderType = (appliesTo, currentOrderType = "ALL") => {
  if (!appliesTo) return true;
  const current = normalizeOrderType(currentOrderType || "ALL");
  if (typeof appliesTo === "string") {
    const norm = normalizeOrderType(appliesTo);
    return norm === "ALL" || norm === current || current === "ALL";
  }
  if (Array.isArray(appliesTo)) {
    if (appliesTo.length === 0) return true;
    const uppercased = appliesTo.map((a) => normalizeOrderType(a));
    return uppercased.includes("ALL") || uppercased.includes(current) || current === "ALL";
  }
  return true;
};

export const resolveRestaurantBillingConfig = (restaurant) => {
  if (!restaurant) return { taxes: [], charges: [], roundOff: false, allowTips: true };
  let config = restaurant.billingConfig;
  if (typeof config === "string") {
    try {
      config = JSON.parse(config);
    } catch {
      config = null;
    }
  }
  if (config && (Array.isArray(config.taxes) || Array.isArray(config.charges))) {
    return {
      taxes: Array.isArray(config.taxes) ? config.taxes : [],
      charges: Array.isArray(config.charges) ? config.charges : [],
      roundOff: Boolean(config.roundOff),
      allowTips: config.allowTips !== false,
    };
  }

  // Construct from legacy fields
  const taxes = [];
  if (restaurant.taxEnabled && Number(restaurant.defaultTaxPercent || 0) > 0) {
    taxes.push({
      name: "GST",
      rate: Number(restaurant.defaultTaxPercent),
      type: "PERCENTAGE",
      isInclusive: String(restaurant.taxType || "EXCLUSIVE").toUpperCase() === "INCLUSIVE",
      isEnabled: true,
      appliesTo: ["ALL"],
    });
  }

  const charges = [];
  if (restaurant.serviceChargeEnabled && Number(restaurant.serviceChargePercent || 0) > 0) {
    charges.push({
      name: "Service Charge",
      amount: Number(restaurant.serviceChargePercent),
      type: "PERCENTAGE",
      isEnabled: true,
      appliesTo: ["ALL"],
    });
  }

  return {
    taxes,
    charges,
    roundOff: false,
    allowTips: true,
  };
};

export const calculateBill = ({
  items = [],
  orderType = "ALL",
  billingConfig = null,
  taxes = null,
  charges = null,
  taxEnabled = false,
  taxType = "EXCLUSIVE",
  taxPercent = 0,
  serviceChargeEnabled = false,
  serviceChargePercent = 0,
  discountSubunit = 0,
  discountAmount = 0,
  couponDiscountSubunit = 0,
  couponDiscount = 0,
  promoDiscountSubunit = 0,
  promoDiscountAmount = 0,
  loyaltyDiscountSubunit = 0,
  loyaltyDiscountAmount = 0,
  tip = 0,
  tipSubunit = 0,
  roundOff = null,
} = {}) => {
  const normalizedItems = Array.isArray(items) ? items : [];

  const subtotalSubunit = normalizedItems.reduce((sum, item) => {
    const qty = Math.max(1, Number(item?.qty || item?.quantity || 1));
    const unit =
      item?.priceSubunit !== undefined
        ? clampSubunit(item.priceSubunit)
        : toSubunit(item?.price ?? item?.unitPrice ?? 0);
    return sum + unit * qty;
  }, 0);

  const effectiveDiscountSubunit =
    discountSubunit || couponDiscountSubunit || promoDiscountSubunit;
  const effectiveDiscountAmount =
    discountAmount || couponDiscount || promoDiscountAmount;

  const promoDiscount = Math.max(
    0,
    effectiveDiscountSubunit
      ? clampSubunit(effectiveDiscountSubunit)
      : toSubunit(effectiveDiscountAmount || 0)
  );
  const loyaltyDiscount = Math.max(
    0,
    loyaltyDiscountSubunit ? clampSubunit(loyaltyDiscountSubunit) : toSubunit(loyaltyDiscountAmount || 0)
  );
  const totalDiscount = promoDiscount + loyaltyDiscount;
  const netSubtotalSubunit = Math.max(0, subtotalSubunit - totalDiscount);

  const normalizedOrderType = String(orderType || "ALL").trim().toUpperCase();

  let effectiveBillingConfig = billingConfig;
  if (typeof effectiveBillingConfig === "string") {
    try {
      effectiveBillingConfig = JSON.parse(effectiveBillingConfig);
    } catch {
      effectiveBillingConfig = null;
    }
  }

  // Resolve taxes list
  let resolvedTaxes = [];
  if (Array.isArray(taxes)) {
    resolvedTaxes = taxes;
  } else if (effectiveBillingConfig && Array.isArray(effectiveBillingConfig.taxes)) {
    resolvedTaxes = effectiveBillingConfig.taxes;
  } else if (taxEnabled) {
    resolvedTaxes = [
      {
        name: "Tax",
        rate: Number(taxPercent || 0),
        type: "PERCENTAGE",
        isInclusive: String(taxType || "EXCLUSIVE").toUpperCase() === "INCLUSIVE",
        isEnabled: true,
        appliesTo: ["ALL"],
      },
    ];
  }

  const activeTaxes = resolvedTaxes.filter(
    (t) => t.isEnabled !== false && matchesOrderType(t.appliesTo, normalizedOrderType)
  );

  const inclusiveTaxes = activeTaxes.filter((t) => Boolean(t.isInclusive));
  const exclusiveTaxes = activeTaxes.filter((t) => !t.isInclusive);

  // Inclusive tax calculation
  const inclusiveTaxSnapshots = [];
  const totalInclusivePercent = inclusiveTaxes.reduce(
    (acc, t) => acc + (String(t.type || "PERCENTAGE").toUpperCase() === "PERCENTAGE" ? Number(t.rate || 0) : 0),
    0
  );

  let totalInclusiveTaxSubunit = 0;
  if (inclusiveTaxes.length > 0 && totalInclusivePercent > 0) {
    const baseBeforeTax = Math.round(subtotalSubunit / (1 + totalInclusivePercent / 100));
    totalInclusiveTaxSubunit = Math.max(0, subtotalSubunit - baseBeforeTax);

    inclusiveTaxes.forEach((t) => {
      const rate = Number(t.rate || 0);
      const taxPart = Math.round((totalInclusiveTaxSubunit * rate) / totalInclusivePercent);
      inclusiveTaxSnapshots.push({
        name: t.name || "Tax (Inclusive)",
        rate,
        type: t.type || "PERCENTAGE",
        isInclusive: true,
        amount: fromSubunit(taxPart),
        amountSubunit: taxPart,
      });
    });
  }

  // Exclusive tax calculation
  const exclusiveTaxSnapshots = [];
  let totalExclusiveTaxSubunit = 0;

  exclusiveTaxes.forEach((t) => {
    const isFixed = String(t.type || "").toUpperCase() === "FIXED";
    let taxAmtSubunit = 0;
    if (isFixed) {
      taxAmtSubunit = clampSubunit(toSubunit(t.rate || t.amount || 0));
    } else {
      taxAmtSubunit = percentOf(subtotalSubunit, t.rate || 0);
    }
    totalExclusiveTaxSubunit += taxAmtSubunit;
    exclusiveTaxSnapshots.push({
      name: t.name || "Tax",
      rate: Number(t.rate || 0),
      type: isFixed ? "FIXED" : "PERCENTAGE",
      isInclusive: false,
      amount: fromSubunit(taxAmtSubunit),
      amountSubunit: taxAmtSubunit,
    });
  });

  const allTaxSnapshots = [...inclusiveTaxSnapshots, ...exclusiveTaxSnapshots];
  const totalTaxSubunit = totalInclusiveTaxSubunit + totalExclusiveTaxSubunit;

  // Resolve charges list
  let resolvedCharges = [];
  if (Array.isArray(charges)) {
    resolvedCharges = charges;
  } else if (effectiveBillingConfig && Array.isArray(effectiveBillingConfig.charges)) {
    resolvedCharges = effectiveBillingConfig.charges;
  } else if (serviceChargeEnabled) {
    resolvedCharges = [
      {
        name: "Service Charge",
        amount: Number(serviceChargePercent || 0),
        type: "PERCENTAGE",
        isEnabled: true,
        appliesTo: ["ALL"],
      },
    ];
  }

  const activeCharges = resolvedCharges.filter(
    (c) => c.isEnabled !== false && matchesOrderType(c.appliesTo, normalizedOrderType)
  );

  const chargeSnapshots = [];
  let totalChargesSubunit = 0;
  let serviceChargeSubunit = 0;

  activeCharges.forEach((c) => {
    const isPercentage = String(c.type || "").toUpperCase() === "PERCENTAGE";
    let chargeSubunit = 0;
    if (isPercentage) {
      chargeSubunit = percentOf(subtotalSubunit, c.amount || c.rate || 0);
    } else {
      chargeSubunit = clampSubunit(toSubunit(c.amount || c.rate || 0));
    }

    totalChargesSubunit += chargeSubunit;
    if (String(c.name || "").toLowerCase().includes("service")) {
      serviceChargeSubunit += chargeSubunit;
    }

    chargeSnapshots.push({
      name: c.name || "Charge",
      amount: fromSubunit(chargeSubunit),
      amountSubunit: chargeSubunit,
      type: isPercentage ? "PERCENTAGE" : "FIXED",
      isTaxable: Boolean(c.isTaxable),
    });
  });

  // Tip
  const resolvedTipSubunit = tipSubunit
    ? clampSubunit(tipSubunit)
    : clampSubunit(toSubunit(tip || 0));

  // Pre-discount total
  const totalBeforeDiscount =
    subtotalSubunit + totalExclusiveTaxSubunit + totalChargesSubunit;
  const totalBeforeRounding = Math.max(0, totalBeforeDiscount - totalDiscount) + resolvedTipSubunit;

  // Round-off
  const shouldRoundOff = Boolean(
    roundOff !== null && roundOff !== undefined ? roundOff : effectiveBillingConfig?.roundOff
  );

  let roundOffSubunit = 0;
  let grandTotalSubunit = totalBeforeRounding;

  if (shouldRoundOff && totalBeforeRounding > 0) {
    const rounded = Math.round(totalBeforeRounding / 100) * 100;
    roundOffSubunit = rounded - totalBeforeRounding;
    grandTotalSubunit = Math.max(0, rounded);
  } else {
    grandTotalSubunit = Math.max(0, totalBeforeRounding);
  }

  return {
    subtotalSubunit,
    taxSubunit: totalTaxSubunit,
    exclusiveTaxSubunit: totalExclusiveTaxSubunit,
    inclusiveTaxSubunit: totalInclusiveTaxSubunit,
    serviceChargeSubunit,
    chargesSubunit: totalChargesSubunit,
    discountSubunit: totalDiscount,
    promoDiscountSubunit: promoDiscount,
    loyaltyDiscountSubunit: loyaltyDiscount,
    tipSubunit: resolvedTipSubunit,
    roundOffSubunit,
    totalSubunit: grandTotalSubunit,

    // Backward-compatible float fields for existing schema
    subtotal: fromSubunit(subtotalSubunit),
    taxAmount: fromSubunit(totalTaxSubunit),
    tax: fromSubunit(totalTaxSubunit),
    serviceChargeAmount: fromSubunit(serviceChargeSubunit || totalChargesSubunit),
    serviceCharge: fromSubunit(serviceChargeSubunit || totalChargesSubunit),
    totalCharges: fromSubunit(totalChargesSubunit),
    charges: chargeSnapshots,
    taxes: allTaxSnapshots,
    tip: fromSubunit(resolvedTipSubunit),
    roundOff: fromSubunit(roundOffSubunit),
    discount: fromSubunit(totalDiscount),
    discountAmount: fromSubunit(totalDiscount),
    totalDiscount: fromSubunit(totalDiscount),
    promoDiscountAmount: fromSubunit(promoDiscount),
    couponDiscount: fromSubunit(promoDiscount),
    loyaltyDiscountAmount: fromSubunit(loyaltyDiscount),
    loyaltyDiscount: fromSubunit(loyaltyDiscount),
    netSubtotal: fromSubunit(netSubtotalSubunit),
    deliveryFee: 0,
    total: fromSubunit(grandTotalSubunit),
    grandTotal: fromSubunit(grandTotalSubunit),

    // Financial snapshot suitable for Order.billingSnapshot storage
    snapshot: {
      subtotal: fromSubunit(subtotalSubunit),
      discount: fromSubunit(totalDiscount),
      promoDiscount: fromSubunit(promoDiscount),
      loyaltyDiscount: fromSubunit(loyaltyDiscount),
      netSubtotal: fromSubunit(netSubtotalSubunit),
      taxes: allTaxSnapshots.map((t) => ({
        name: t.name,
        rate: t.rate,
        type: t.type,
        isInclusive: t.isInclusive,
        amount: t.amount,
      })),
      charges: chargeSnapshots.map((c) => ({
        name: c.name,
        amount: c.amount,
        type: c.type,
      })),
      totalTax: fromSubunit(totalTaxSubunit),
      totalCharges: fromSubunit(totalChargesSubunit),
      tip: fromSubunit(resolvedTipSubunit),
      roundOff: fromSubunit(roundOffSubunit),
      total: fromSubunit(grandTotalSubunit),
    },
  };
};

export const computeBill = calculateBill;

export const toPriceSubunitItems = ({ menuItems = [], items = [] } = {}) => {
  const byId = new Map((menuItems || []).map((m) => [Number(m.id), m]));
  const byName = new Map((menuItems || []).map((m) => [String(m.name || "").trim().toLowerCase(), m]));

  const normalized = [];
  for (const raw of Array.isArray(items) ? items : []) {
    const menuItemId = Number(raw?.menuItemId || raw?.id || 0);
    const rawName = String(raw?.itemName || raw?.name || "").trim().toLowerCase();
    const qty = Math.max(1, Number(raw?.qty || raw?.quantity || 1));

    let dbItem = byId.get(menuItemId) || byName.get(rawName);

    if (!dbItem) {
      const rawPrice = Number(raw?.price);
      if (raw?.price !== undefined && raw?.price !== null && !Number.isNaN(rawPrice) && rawPrice >= 0) {
        normalized.push({
          menuItemId: null,
          itemName: String(raw?.name || raw?.itemName || "Item").trim(),
          preparedByName: String(raw?.preparedByName || raw?.chefName || raw?.preparedBy || "").trim() || null,
          variantId: null,
          variantName: null,
          variantPrice: null,
          selectedModifiers: null,
          notes: String(raw?.notes || "").trim() || null,
          qty,
          unitPrice: rawPrice,
          price: rawPrice,
          total: rawPrice * qty,
          priceSubunit: toSubunit(rawPrice),
        });
        continue;
      }
      const err = new Error("invalid_item");
      err.code = "invalid_item";
      throw err;
    }

    // 1. Authoritative Variant Price Lookup
    let basePrice = Number(dbItem.price || 0);
    let variantId = null;
    let variantName = null;
    let variantPrice = null;

    const dbVariants = Array.isArray(dbItem.variants) ? dbItem.variants : [];
    const rawVariantId = Number(raw?.variantId || raw?.variant?.id || 0);

    if (rawVariantId > 0) {
      const selectedVar = dbVariants.find((v) => Number(v.id) === rawVariantId);
      if (!selectedVar || selectedVar.isActive === false) {
        const err = new Error(`Variant not found or inactive for item '${dbItem.name}'`);
        err.code = "invalid_variant";
        throw err;
      }
      variantId = selectedVar.id;
      variantName = selectedVar.name;
      variantPrice = Number(selectedVar.price || 0);
      basePrice = variantPrice;
    } else if (dbVariants.length > 0) {
      const defaultVar = dbVariants.find((v) => v.isDefault && v.isActive !== false) || dbVariants.find((v) => v.isActive !== false);
      if (defaultVar) {
        variantId = defaultVar.id;
        variantName = defaultVar.name;
        variantPrice = Number(defaultVar.price || 0);
        basePrice = variantPrice;
      }
    }

    // 2. Authoritative Modifier Groups Validation & Price Lookup
    const dbModifierGroups = Array.isArray(dbItem.modifierGroups) ? dbItem.modifierGroups : [];
    const rawModifiersInput = Array.isArray(raw?.selectedModifiers)
      ? raw.selectedModifiers
      : Array.isArray(raw?.modifiers)
        ? raw.modifiers
        : [];

    const selectedModifiersSnapshot = [];
    let sumModifierPrices = 0;

    for (const group of dbModifierGroups) {
      const dbGroupModifiers = Array.isArray(group.modifiers) ? group.modifiers : [];

      const selectedForGroup = rawModifiersInput.filter((mInput) => {
        const inputModId = Number(mInput?.modifierId || mInput?.id || mInput || 0);
        const inputGroupId = Number(mInput?.modifierGroupId || mInput?.groupId || 0);
        if (inputGroupId > 0 && inputGroupId === group.id) return true;
        return dbGroupModifiers.some((dbM) => dbM.id === inputModId);
      });

      const selectedCount = selectedForGroup.length;

      if (group.isRequired && selectedCount === 0) {
        const err = new Error(`Selection required for group '${group.name}' in item '${dbItem.name}'`);
        err.code = "required_modifier_missing";
        throw err;
      }

      if (group.minSelect > 0 && selectedCount < group.minSelect) {
        const err = new Error(`Minimum ${group.minSelect} selection(s) required for '${group.name}'`);
        err.code = "min_modifiers_not_met";
        throw err;
      }

      if (group.maxSelect > 0 && selectedCount > group.maxSelect) {
        const err = new Error(`Maximum ${group.maxSelect} selection(s) allowed for '${group.name}'`);
        err.code = "max_modifiers_exceeded";
        throw err;
      }

      for (const mInput of selectedForGroup) {
        const inputModId = Number(mInput?.modifierId || mInput?.id || mInput || 0);
        const dbMod = dbGroupModifiers.find((m) => m.id === inputModId);

        if (!dbMod || dbMod.isAvailable === false) {
          const err = new Error(`Selected modifier option not available in '${group.name}'`);
          err.code = "invalid_modifier";
          throw err;
        }

        const modPrice = Number(dbMod.price || 0);
        sumModifierPrices += modPrice;

        selectedModifiersSnapshot.push({
          modifierGroupId: group.id,
          groupName: group.name,
          modifierId: dbMod.id,
          name: dbMod.name,
          price: modPrice,
        });
      }
    }

    const finalUnitPrice = basePrice + sumModifierPrices;

    normalized.push({
      menuItemId: dbItem.id,
      itemName: String(dbItem.name).trim(),
      preparedByName: String(raw?.preparedByName || raw?.chefName || raw?.preparedBy || "").trim() || null,
      variantId,
      variantName,
      variantPrice,
      selectedModifiers: selectedModifiersSnapshot.length > 0 ? selectedModifiersSnapshot : null,
      notes: String(raw?.notes || "").trim() || null,
      qty,
      unitPrice: finalUnitPrice,
      price: finalUnitPrice,
      total: finalUnitPrice * qty,
      priceSubunit: toSubunit(finalUnitPrice),
    });
  }

  return normalized;
};
