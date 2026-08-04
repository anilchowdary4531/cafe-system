export const isValidPhone = (raw) => {
  const input = String(raw || "").trim();
  if (!input) return false;
  if (input.includes("@") || input.startsWith("google_")) return false;
  if (/[a-zA-Z]/.test(input)) return false;
  const digits = input.replace(/[^\d]/g, "");
  return digits.length >= 7;
};

export const normalizePhone = (raw) => {
  const input = String(raw || "").trim();
  if (!isValidPhone(input)) return "";

  // Keep digits only
  let digits = input.replace(/[^\d]/g, "");

  // Fix double 91 prefix (e.g. 919177764632 -> 9177764632)
  if (digits.length === 12 && digits.startsWith("9191")) {
    digits = digits.slice(2);
  }

  // Remove leading 0 if 11 digits (e.g. 09876543210 -> 9876543210)
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Prepend India country code 91 if 10 digits
  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  return digits;
};

export const getPhoneVariants = (raw) => {
  const input = String(raw || "").trim();
  if (!isValidPhone(input)) return [];

  const digits = input.replace(/[^\d]/g, "");
  const set = new Set();
  if (input) set.add(input);
  if (digits) set.add(digits);

  const norm = normalizePhone(input);
  if (norm) set.add(norm);

  if (digits.length === 10) {
    set.add(`91${digits}`);
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    set.add(digits.slice(2));
  }
  if (digits.length === 12 && digits.startsWith("9191")) {
    set.add(digits.slice(2));
    set.add(digits.slice(4));
  }

  return Array.from(set).filter(Boolean);
};