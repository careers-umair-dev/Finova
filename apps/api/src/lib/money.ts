// All stored amounts are integer minor units (cents). Floats are used for display only.
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'PKR', 'AED'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** "1234.5" -> 123450. Rejects anything that isn't a plain decimal with <= 2 places. */
export function parseMajorToMinor(input: string): number {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(input)) throw new Error('Invalid amount');
  const [whole, frac = ''] = input.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
export function formatMinor(minor: number, currency: Currency, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
}
