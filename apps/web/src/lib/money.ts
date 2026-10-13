export const CURRENCIES = ['USD', 'EUR', 'GBP', 'PKR', 'AED'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/; // matches the API's rule: positive decimal, max 2 places

/** Display only. Stored/transmitted amounts are integer minor units or decimal strings, never floats. */
export const formatMinor = (minor: number, currency: string, locale = 'en-US') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);

/** Splits "$32,678.90" into main "$32,678" and fraction ".90" so the fraction can be styled lighter. */
export function splitMoney(minor: number, currency: string, locale = 'en-US') {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(minor / 100);
  const i = parts.findIndex((p) => p.type === 'decimal');
  if (i < 0) return { main: formatMinor(minor, currency, locale), frac: '' };
  const j = parts.findIndex((p, k) => k > i && p.type !== 'fraction');
  const end = j < 0 ? parts.length : j;
  const join = (a: number, b: number) => parts.slice(a, b).map((p) => p.value).join('');
  return { main: join(0, i) + join(end, parts.length), frac: join(i, end) };
}
export const compactMinor = (minor: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(minor / 100);
