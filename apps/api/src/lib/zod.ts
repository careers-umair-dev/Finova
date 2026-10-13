import { z } from 'zod';
import { parseMajorToMinor } from './money.js';

export const oidStr = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const MAX_TX_MINOR = 100_000_000_000; // 1,000,000,000.00

/** Accepts "12.50" (preferred) or 12.5; yields integer minor units. Never does float arithmetic. */
export const money = (allowZero = false) =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    try {
      const minor = parseMajorToMinor(String(v).trim());
      if ((!allowZero && minor < 1) || minor > MAX_TX_MINOR) throw new Error('range');
      return minor;
    } catch {
      ctx.addIssue({ code: 'custom', message: `Enter ${allowZero ? 'an' : 'a positive'} amount with at most 2 decimals` });
      return z.NEVER;
    }
  });
