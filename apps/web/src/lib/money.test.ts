import { describe, expect, it } from 'vitest';
import { AMOUNT_RE, compactMinor, formatMinor, splitMoney } from './money';

describe('money helpers', () => {
  it('formats integer minor units', () => { expect(formatMinor(7898909, 'USD')).toBe('$78,989.09'); });
  it('splits main and fraction for the big balance style', () => { expect(splitMoney(3267890, 'USD')).toEqual({ main: '$32,678', frac: '.90' }); });
  it('compacts axis labels', () => { expect(compactMinor(450000)).toBe('4.5K'); });
  it('validates amounts like the API does', () => {
    for (const ok of ['1', '0.5', '1234.56']) expect(AMOUNT_RE.test(ok)).toBe(true);
    for (const bad of ['', '-1', '1.234', '1e3', 'abc', '1,000']) expect(AMOUNT_RE.test(bad)).toBe(false);
  });
});
