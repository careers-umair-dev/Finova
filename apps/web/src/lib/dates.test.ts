import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { customRange, fmtRange, presetRange } from './dates';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T08:00:00Z')); });
afterEach(() => vi.useRealTimers());

describe('date ranges', () => {
  it('presets leave `to` open ("now") so newly added transactions are never excluded', () => {
    for (const key of ['7d', '30d', '60d', '90d', 'ytd']) expect(presetRange(key).to, key).toBeNull();
    const r = presetRange('60d');
    expect(Math.round((Date.now() - +r.from) / 864e5)).toBe(60);
  });
  it('a custom range ending today or later is also open-ended; a past end date is the end of that day', () => {
    expect(customRange('2026-09-01', '2026-10-11')?.to).toBeNull();
    const future = customRange('2026-09-01', '2027-01-01')!;                         // a future end date is clamped to "now"
    expect(future).not.toBeNull(); expect(future.to).toBeNull();
    const past = customRange('2026-08-01', '2026-08-31')!;
    expect(past.to).not.toBeNull(); expect(past.to!.getHours()).toBe(23);
  });
  it('rejects empty, reversed and over-long ranges', () => {
    expect(customRange('', '2026-08-31')).toBeNull();
    expect(customRange('2026-08-31', '2026-08-01')).toBeNull();
    expect(customRange('2024-01-01', '2026-08-01')).toBeNull();
  });
  it('labels an open range with today as the end', () => {
    expect(fmtRange(new Date('2026-08-12T00:00:00'), null)).toMatch(/12 Aug, 2026 – 11 Oct, 2026/);
  });
});
