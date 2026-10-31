/**
 * Canonical Table Identity Contract
 * Table identity is strictly defined by restaurantId + tableId (where tableId = DiningTable.id).
 * tableNo is ONLY a human-readable display string.
 */

export function getTableId(table) {
  if (!table) return null;
  if (typeof table === "number" || typeof table === "string") {
    const n = Number(table);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  if (typeof table === "object") {
    const tid = Number(table.id || table.tableId || 0);
    return Number.isInteger(tid) && tid > 0 ? tid : null;
  }
  return null;
}

export function getCanonicalTableIdentity({ restaurantId, tableId, id } = {}) {
  const rid = restaurantId ? Number(restaurantId) : null;
  const tid = tableId ? Number(tableId) : (id ? Number(id) : null);
  if (!tid) {
    return null;
  }
  return rid ? `${rid}:${tid}` : String(tid);
}

export function getTableIdentity(table) {
  if (!table || typeof table !== "object") return null;
  const tid = getTableId(table);
  if (!tid) return null;
  const rid = table.restaurantId ? Number(table.restaurantId) : null;
  return rid ? `${rid}:${tid}` : String(tid);
}

export function isSameTable(tableA, tableB) {
  if (!tableA || !tableB) return false;
  const idA = getTableId(tableA);
  const idB = getTableId(tableB);
  if (!idA || !idB) return false;
  if (idA !== idB) return false;
  const ridA = tableA.restaurantId ? Number(tableA.restaurantId) : null;
  const ridB = tableB.restaurantId ? Number(tableB.restaurantId) : null;
  if (ridA && ridB && ridA !== ridB) return false;
  return true;
}

export function formatTableDisplayLabel({ section, tableNo }) {
  const cleanSection = section ? String(section).trim() : "";
  const cleanTableNo = tableNo ? String(tableNo).trim() : "";
  if (cleanSection && cleanTableNo) {
    return `${cleanSection} · Table ${cleanTableNo}`;
  }
  return cleanTableNo ? `Table ${cleanTableNo}` : "Table";
}
