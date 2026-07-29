export const normalizePhone = (raw) => {
  const input = String(raw || "").trim();
  if (!input) return "";

  // If it's an email, don't normalize it like a phone number
  if (input.includes("@")) {
    return input.toLowerCase();
  }

  // Keep digits only
  let digits = input.replace(/[^\d]/g, "");

  // Add India country code if missing
  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  return digits;
};