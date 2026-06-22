// Shared helper so menu pricing stays consistent across create and update flows.
const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value) => Math.round(Math.max(0, Number(value) || 0) * 100) / 100;

export function resolveMenuPricing(body = {}, existing = null) {
  const hasOriginalPrice = hasValue(body.originalPrice);
  const hasDiscountPercent = hasValue(body.discountPercent);
  const hasPrice = hasValue(body.price);

  let originalPrice = hasOriginalPrice
    ? toNumber(body.originalPrice, toNumber(existing?.originalPrice ?? existing?.price ?? 0))
    : toNumber(existing?.originalPrice ?? existing?.price ?? 0);

  let discountPercent = hasDiscountPercent
    ? Math.max(0, toNumber(body.discountPercent, toNumber(existing?.discountPercent ?? 0)))
    : toNumber(existing?.discountPercent ?? 0);

  let price = toNumber(existing?.price ?? originalPrice);

  if (hasPrice && !hasOriginalPrice && !hasDiscountPercent) {
    price = toNumber(body.price, price);
    originalPrice = price;
    discountPercent = 0;
  } else {
    if (hasPrice) {
      price = toNumber(body.price, price);
    } else {
      price = originalPrice * (1 - discountPercent / 100);
    }
  }

  return {
    originalPrice: roundMoney(originalPrice),
    discountPercent: roundMoney(discountPercent),
    price: roundMoney(price),
  };
}
