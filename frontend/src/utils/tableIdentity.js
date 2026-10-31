/**
 * Canonical Table Identity Contract
 * Table identity is strictly defined by restaurantId + tableId.
 * tableNo is ONLY a human-readable display string.
 */

export function getCanonicalTableIdentity({ restaurantId, tableId }) {
  const rid = restaurantId ? Number(restaurantId) : null;
  const tid = tableId ? Number(tableId) : null;
  if (!tid) {
    return null;
  }
  return rid ? `${rid}:${tid}` : String(tid);
}

export function formatTableDisplayLabel({ section, tableNo }) {
  const cleanSection = section ? String(section).trim() : "";
  const cleanTableNo = tableNo ? String(tableNo).trim() : "";
  if (cleanSection && cleanTableNo) {
    return `${cleanSection} · Table ${cleanTableNo}`;
  }
  return cleanTableNo ? `Table ${cleanTableNo}` : "Table";
}
