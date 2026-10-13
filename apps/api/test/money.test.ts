import { describe, expect, it } from 'vitest';
import { formatMinor, parseMajorToMinor } from '../src/lib/money.js';

describe('money', () => {
  it('parses decimals into integer minor units without float drift', () => {
    expect(parseMajorToMinor('0.1')).toBe(10);
    expect(parseMajorToMinor('1234.5')).toBe(123450);
    expect(parseMajorToMinor('78989.09')).toBe(7898909);
  });
  it('rejects malformed amounts', () => {
    for (const bad of ['', '-1', '1e3', '1.234', 'abc', '1,000']) expect(() => parseMajorToMinor(bad)).toThrow();
  });
  it('formats minor units', () => {
    expect(formatMinor(7898909, 'USD')).toBe('$78,989.09');
  });
});
