/**
 * CENTRALIZED UNIT CONVERSION SERVICE
 * Authoritative unit conversions for Raw Materials, Recipes, and Stock Movements.
 * Base Units:
 *   - WEIGHT: "g" (grams)
 *   - VOLUME: "ml" (milliliters)
 *   - COUNT: "pcs" (pieces)
 */

export const UNIT_TYPES = {
    WEIGHT: "WEIGHT",
    VOLUME: "VOLUME",
    COUNT: "COUNT",
};

export const SUPPORTED_UNITS = {
    // Weight units (base = g)
    g: { type: UNIT_TYPES.WEIGHT, baseUnit: "g", multiplier: 1, label: "Grams (g)" },
    kg: { type: UNIT_TYPES.WEIGHT, baseUnit: "g", multiplier: 1000, label: "Kilograms (kg)" },
    mg: { type: UNIT_TYPES.WEIGHT, baseUnit: "g", multiplier: 0.001, label: "Milligrams (mg)" },

    // Volume units (base = ml)
    ml: { type: UNIT_TYPES.VOLUME, baseUnit: "ml", multiplier: 1, label: "Milliliters (ml)" },
    L: { type: UNIT_TYPES.VOLUME, baseUnit: "ml", multiplier: 1000, label: "Liters (L)" },
    l: { type: UNIT_TYPES.VOLUME, baseUnit: "ml", multiplier: 1000, label: "Liters (L)" },

    // Count units (base = pcs)
    pcs: { type: UNIT_TYPES.COUNT, baseUnit: "pcs", multiplier: 1, label: "Pieces (pcs)" },
    pc: { type: UNIT_TYPES.COUNT, baseUnit: "pcs", multiplier: 1, label: "Piece (pc)" },
    dozen: { type: UNIT_TYPES.COUNT, baseUnit: "pcs", multiplier: 12, label: "Dozen (12 pcs)" },
    pack: { type: UNIT_TYPES.COUNT, baseUnit: "pcs", multiplier: 1, label: "Pack" },
    box: { type: UNIT_TYPES.COUNT, baseUnit: "pcs", multiplier: 1, label: "Box" },
};

/**
 * Normalizes unit string to standard code (e.g. "KG" -> "kg")
 */
export function normalizeUnit(unitStr) {
    if (!unitStr || typeof unitStr !== "string") return "pcs";
    const clean = unitStr.trim();
    if (clean === "L" || clean === "l") return "L";
    const lower = clean.toLowerCase();
    if (SUPPORTED_UNITS[lower]) return lower;
    if (SUPPORTED_UNITS[clean]) return clean;
    return lower;
}

/**
 * Converts quantity in any unit to its base unit.
 * Example: 2.5 kg -> { baseQuantity: 2500, baseUnit: "g" }
 */
export function toBaseUnit(quantity, unitStr) {
    const qty = Number(quantity || 0);
    const unit = normalizeUnit(unitStr);
    const config = SUPPORTED_UNITS[unit];

    if (!config) {
        // Fallback for unknown units
        return { baseQuantity: qty, baseUnit: unit, unitType: UNIT_TYPES.COUNT };
    }

    const baseQuantity = qty * config.multiplier;
    return {
        baseQuantity,
        baseUnit: config.baseUnit,
        unitType: config.type,
    };
}

/**
 * Converts base quantity to a requested display unit.
 * Example: 2500 g to "kg" -> 2.5
 */
export function fromBaseUnit(baseQuantity, targetUnitStr) {
    const baseQty = Number(baseQuantity || 0);
    const targetUnit = normalizeUnit(targetUnitStr);
    const config = SUPPORTED_UNITS[targetUnit];

    if (!config || !config.multiplier) return baseQty;
    return baseQty / config.multiplier;
}

/**
 * Checks if two units are compatible (e.g. both weight or both volume).
 */
export function isCompatibleUnit(unitA, unitB) {
    const normA = normalizeUnit(unitA);
    const normB = normalizeUnit(unitB);

    const configA = SUPPORTED_UNITS[normA];
    const configB = SUPPORTED_UNITS[normB];

    if (!configA || !configB) return true; // allow custom units
    return configA.type === configB.type;
}

/**
 * Formats base quantity into human friendly display string.
 * Example: 12500 g -> "12.5 kg", 450 g -> "450 g"
 */
export function formatDisplayQuantity(baseQuantity, baseUnit, preferredDisplayUnit = null) {
    const qty = Number(baseQuantity || 0);
    const bUnit = normalizeUnit(baseUnit);

    let displayUnit = preferredDisplayUnit ? normalizeUnit(preferredDisplayUnit) : null;

    if (!displayUnit) {
        if (bUnit === "g" && Math.abs(qty) >= 1000) {
            displayUnit = "kg";
        } else if (bUnit === "ml" && Math.abs(qty) >= 1000) {
            displayUnit = "L";
        } else {
            displayUnit = bUnit;
        }
    }

    const converted = fromBaseUnit(qty, displayUnit);
    const formattedNum = Number.isInteger(converted)
        ? converted.toString()
        : converted.toFixed(2).replace(/\.?0+$/, "");

    return `${formattedNum} ${displayUnit}`;
}
