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
  loyaltyDiscountSubunit = 0,
} = {}) => {
  const normalizedItems = Array.isArray(items) ? items : [];

  const subtotalSubunit = normalizedItems.reduce((sum, item) => {
    const qty = Math.max(1, Number(item?.qty || 1));
    const unit = clampSubunit(item?.priceSubunit);
    return sum + unit * qty;
  }, 0);

  const promoDiscount = Math.max(0, clampSubunit(discountSubunit));
  const loyaltyDiscount = Math.max(0, clampSubunit(loyaltyDiscountSubunit));
  const totalDiscount = promoDiscount + loyaltyDiscount;

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

  const totalSubunit = Math.max(0, totalBeforeDiscount - totalDiscount);

  return {
    subtotalSubunit,
    taxSubunit,
    serviceChargeSubunit,
    discountSubunit: totalDiscount,
    promoDiscountSubunit: promoDiscount,
    loyaltyDiscountSubunit: loyaltyDiscount,
    totalSubunit,
    // Backward-compatible float fields for existing schema.
    subtotal: fromSubunit(subtotalSubunit),
    taxAmount: fromSubunit(taxSubunit),
    serviceChargeAmount: fromSubunit(serviceChargeSubunit),
    discountAmount: fromSubunit(totalDiscount),
    promoDiscountAmount: fromSubunit(promoDiscount),
    loyaltyDiscountAmount: fromSubunit(loyaltyDiscount),
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
      priceSubunit: toSubunit(finalUnitPrice),
    });
  }

  return normalized;
};
