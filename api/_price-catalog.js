// Canonical product prices, in major currency units (USD/EUR/INR/AED).
// This is the single source of truth for what a checkout is allowed to
// charge. Client-supplied amounts are NEVER trusted directly — every
// order/session endpoint must look the price up here and derive the
// amount itself. Keep this in sync with the pricingData objects in
// handstand-guide.html and lower-back-pain-guide.html.
export const PRICE_CATALOG = {
  'lower-back-pain-guide': {
    'pdf-only': { USD: 25, EUR: 21, INR: 2299, AED: 92 },
    'pdf-consultation': { USD: 42, EUR: 36, INR: 3799, AED: 154 },
    'pdf-sessions': { USD: 175, EUR: 153, INR: 15499, AED: 655 },
  },
  'handstand-guide': {
    'pdf-only': { USD: 25, EUR: 21, INR: 2299, AED: 92 },
    'pdf-consultation': { USD: 42, EUR: 36, INR: 3799, AED: 154 },
    'pdf-sessions': { USD: 175, EUR: 153, INR: 15499, AED: 655 },
  },
};

/**
 * Look up the authoritative price for a product/option/currency and return
 * it in the smallest currency unit (paise/cents/fils), matching what
 * Razorpay and Stripe both expect for `amount` / `unit_amount`.
 *
 * @param {string} product
 * @param {string} productOption
 * @param {string} currency
 * @returns {number|null} amount in smallest currency unit, or null if the
 *   product/option/currency combination is not recognized.
 */
export function resolveAmountInSmallestUnit(product, productOption, currency) {
  const productPrices = PRICE_CATALOG[product];
  if (!productPrices) return null;

  const optionPrices = productPrices[productOption];
  if (!optionPrices) return null;

  const price = optionPrices[currency];
  if (typeof price !== 'number') return null;

  return price * 100;
}
