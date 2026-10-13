import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { minorToDecimal, toCsv } from '../lib/csv.js';
import { CURRENCIES } from '../lib/money.js';
import { oidStr } from '../lib/zod.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as analytics from '../services/analytics.js';

const r = Router();
const validTz = (v: string) => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; } };
const scope = {
  currency: z.enum(CURRENCIES).optional(), walletId: oidStr.optional(),
  tz: z.string().max(60).refine(validTz, 'Unknown IANA timezone').default('UTC'),
};
const range = { from: z.coerce.date().optional(), to: z.coerce.date().optional() };
const q = (shape: z.ZodRawShape) => validate({ query: z.object(shape).strict() });

// Dashboard cards: balance, weekly income, trend line.
r.get('/dashboard/summary', requireAuth, q({ ...scope, ...range }),
  ah(async (req, res) => { res.json({ data: await analytics.summary(req.auth!.userId, req.query as any) }); }));

// Dashboard bar chart. monthly = last 6 months, annual = last 6 years.
r.get('/dashboard/activity', requireAuth, q({ ...scope, period: z.enum(['monthly', 'annual']).default('monthly') }),
  ah(async (req, res) => { res.json({ data: await analytics.activity(req.auth!.userId, req.query as any) }); }));

r.get('/reports/cash-flow', requireAuth, q({ ...scope, ...range }),
  ah(async (req, res) => { res.json({ data: await analytics.cashFlowReport(req.auth!.userId, req.query as any) }); }));

r.get('/reports/cash-flow.csv', requireAuth, q({ ...scope, ...range }), ah(async (req, res) => {
  const d = await analytics.cashFlowReport(req.auth!.userId, req.query as any);
  const csv = toCsv([
    ['Month', 'Income', 'Expense', 'Net', 'Currency'],
    ...d.series.map((s) => [s.month, minorToDecimal(s.incomeMinor), minorToDecimal(s.expenseMinor), minorToDecimal(s.netMinor), d.currency]),
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="finova-cash-flow.csv"');
  res.send(csv);
}));

r.get('/reports/compare', requireAuth, q(scope),
  ah(async (req, res) => { res.json({ data: await analytics.yearComparison(req.auth!.userId, req.query as any) }); }));

export default r;
