export const normalizePhone = (raw) => {
  const input = String(raw || "").trim();
  if (!input) return "";

  // If it's an email, don't normalize it like a phone number
  if (input.includes("@")) {
    return input.toLowerCase();
  }

  // Keep digits only
  let digits = input.replace(/[^\d]/g, "");

  // Remove leading 0 if 11 digits (e.g. 09876543210 -> 9876543210 -> 919876543210)
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Add India country code if missing
  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  return digits;
};