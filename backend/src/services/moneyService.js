export const MONEY_SCALE = 100; // paise per INR

export const toSubunit = (value, scale = MONEY_SCALE) => {
  if (value === null || value === undefined) return 0;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * scale);
  }

  const raw = String(value).trim();
  if (!raw) return 0;

  const neg = raw.startsWith("-");
  const normalized = raw.replace(/[^0-9.]/g, "");
  const [intPartRaw, fracRaw = ""] = normalized.split(".");
  const intPart = Number(intPartRaw || 0);
  const fracPadded = (fracRaw + "00").slice(0, 2);
  const fracPart = Number(fracPadded || 0);
  const subunit = intPart * scale + fracPart;
  return neg ? -subunit : subunit;
};

export const fromSubunit = (subunit, scale = MONEY_SCALE) => {
  const value = Number(subunit || 0);
  if (!Number.isFinite(value)) return 0;
  return value / scale;
};

export const clampSubunit = (subunit) => {
  const v = Number(subunit || 0);
  if (!Number.isFinite(v)) return 0;
  return Math.trunc(v);
};

