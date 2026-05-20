export const normalizePhone = (raw) => {
  const input = String(raw || "").trim();
  if (!input) return "";

  // Keep digits only
  let digits = input.replace(/[^\d]/g, "");

  // Add India country code if missing
  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  return digits;
};