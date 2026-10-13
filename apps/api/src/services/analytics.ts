import { Types } from 'mongoose';
import { AppError, notFound } from '../lib/errors.js';
import type { Currency } from '../lib/money.js';
import { Contact } from '../models/Contact.js';
import { Transaction } from '../models/Transaction.js';
import { UserPreferences } from '../models/UserPreferences.js';
import { Wallet } from '../models/Wallet.js';

/*
 * Rules that keep the numbers honest:
 *  - Only COMPLETED transactions count toward balances and flows.
 *  - Figures are scoped to ONE currency at a time (never summed across currencies) and to the user's active wallets
 *    (or one explicit wallet, which may be archived).
 *  - Day / month / year buckets use the caller's IANA timezone (default UTC).
 */
const oid = (s: string | Types.ObjectId) => new Types.ObjectId(String(s));
const DAY = 864e5;
const NET = { $cond: [{ $eq: ['$type', 'income'] }, '$amountMinor', { $multiply: ['$amountMinor', -1] }] };
const pct = (cur: number, prev: number) => (prev !== 0 ? Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10 : null);
const agg = (p: any[]) => Transaction.aggregate(p) as unknown as Promise<any[]>;

type Opts = { currency?: Currency; walletId?: string; tz: string };
type Scope = { currency: Currency; ids: Types.ObjectId[]; openingMinor: number };

export async function resolveScope(ownerId: string, o: Pick<Opts, 'currency' | 'walletId'>): Promise<Scope> {
  if (o.walletId) {
    const w = await Wallet.findOne({ _id: o.walletId, ownerId }).lean();
    if (!w) throw notFound('Wallet not found');
    return { currency: w.currency as Currency, ids: [w._id], openingMinor: w.openingBalanceMinor };
  }
  const active = await Wallet.find({ ownerId, archivedAt: null }).lean();
  let cur = o.currency;
  if (!cur) {
    const prefs = await UserPreferences.findOne({ ownerId }).lean();
    cur = (prefs?.currency as Currency | undefined) ?? 'USD';
    if (active.length && !active.some((w) => w.currency === cur)) cur = active[0]!.currency as Currency;
  }
  const mine = active.filter((w) => w.currency === cur);
  return { currency: cur, ids: mine.map((w) => w._id), openingMinor: mine.reduce((s, w) => s + w.openingBalanceMinor, 0) };
}

export function resolveRange(from?: Date, to?: Date, defaultDays = 30) {
  const end = to ?? new Date();
  const start = from ?? new Date(end.getTime() - defaultDays * DAY);
  if (start >= end) throw new AppError(400, 'BAD_RANGE', '"from" must be before "to"');
  if (end.getTime() - start.getTime() > 366 * DAY) throw new AppError(400, 'BAD_RANGE', 'Date range cannot exceed 366 days');
  return { from: start, to: end };
}

/* ---- tz-aware key helpers ---- */
const dayKey = (d: Date, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const ymNow = (tz: string, at = new Date()) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).formatToParts(at);
  return { y: Number(p.find((x) => x.type === 'year')!.value), m: Number(p.find((x) => x.type === 'month')!.value) };
};
const monthKeysBack = (count: number, tz: string) => {
  let { y, m } = ymNow(tz); const keys: string[] = [];
  for (let i = 0; i < count; i++) { keys.unshift(`${y}-${String(m).padStart(2, '0')}`); if (--m === 0) { m = 12; y--; } }
  return keys;
};
const monthKeysBetween = (from: Date, to: Date, tz: string) => {
  const a = ymNow(tz, from), b = ymNow(tz, to); const keys: string[] = [];
  for (let y = a.y, m = a.m; y < b.y || (y === b.y && m <= b.m); m === 12 ? (y++, (m = 1)) : m++) keys.push(`${y}-${String(m).padStart(2, '0')}`);
  return keys;
};
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const monthLabel = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1]!;

type Flow = { incomeMinor: number; expenseMinor: number; netMinor: number };
const flow = (income = 0, expense = 0): Flow => ({ incomeMinor: income, expenseMinor: expense, netMinor: income - expense });
async function flowsByKey(ownerId: string, s: Scope, format: string, tz: string, from: Date, to?: Date) {
  const rows = await agg([
    { $match: { ownerId: oid(ownerId), walletId: { $in: s.ids }, status: 'completed', occurredAt: { $gte: from, ...(to && { $lte: to }) } } },
    { $group: { _id: { k: { $dateToString: { format, date: '$occurredAt', timezone: tz } }, t: '$type' }, sum: { $sum: '$amountMinor' } } },
  ]);
  const m = new Map<string, { i: number; e: number }>();
  for (const r of rows) { const c = m.get(r._id.k) ?? { i: 0, e: 0 }; r._id.t === 'income' ? (c.i += r.sum) : (c.e += r.sum); m.set(r._id.k, c); }
  return (k: string) => { const c = m.get(k); return flow(c?.i, c?.e); };
}

/* ---------- dashboard: balance card, weekly income, line chart ---------- */
export async function summary(ownerId: string, o: Opts & { from?: Date; to?: Date }) {
  const s = await resolveScope(ownerId, o);
  const { from, to } = resolveRange(o.from, o.to);
  if (!s.ids.length) return { currency: s.currency, hasData: false, balanceMinor: 0, range: { from, to }, income: 0, expense: 0, net: 0, pendingCount: 0, weeklyIncome: { amountMinor: 0, changePct: null }, trend: [] };

  const base = { ownerId: oid(ownerId), walletId: { $in: s.ids }, status: 'completed' };
  const now = new Date(); const w1 = new Date(now.getTime() - 7 * DAY), w2 = new Date(now.getTime() - 14 * DAY);
  const net = (extra: object) => agg([{ $match: { ...base, ...extra } }, { $group: { _id: null, net: { $sum: NET } } }]);
  const [all, before, inRange, daily, weekly, pendingCount] = await Promise.all([
    net({}), net({ occurredAt: { $lt: from } }),
    agg([{ $match: { ...base, occurredAt: { $gte: from, $lte: to } } }, { $group: { _id: '$type', sum: { $sum: '$amountMinor' } } }]),
    agg([{ $match: { ...base, occurredAt: { $gte: from, $lte: to } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt', timezone: o.tz } }, net: { $sum: NET } } }]),
    agg([{ $match: { ...base, type: 'income', occurredAt: { $gte: w2 } } }, { $group: { _id: { $cond: [{ $gte: ['$occurredAt', w1] }, 'cur', 'prev'] }, sum: { $sum: '$amountMinor' } } }]),
    Transaction.countDocuments({ ownerId: oid(ownerId), walletId: { $in: s.ids }, status: 'pending' }),
  ]);
  const sum = (rows: any[], id: string) => rows.find((r) => r._id === id)?.sum ?? 0;
  const dayNet = new Map(daily.map((r) => [r._id as string, r.net as number]));
  let run = s.openingMinor + (before[0]?.net ?? 0); const trend: { date: string; balanceMinor: number }[] = [];
  const seen = new Set<string>();
  for (let t = from.getTime(); t <= to.getTime() + DAY; t += DAY / 2) {
    const k = dayKey(new Date(Math.min(t, to.getTime())), o.tz);
    if (seen.has(k)) continue; seen.add(k); run += dayNet.get(k) ?? 0; trend.push({ date: k, balanceMinor: run });
  }
  const income = sum(inRange, 'income'), expense = sum(inRange, 'expense');
  return {
    currency: s.currency, hasData: true, balanceMinor: s.openingMinor + (all[0]?.net ?? 0), range: { from, to },
    income, expense, net: income - expense, pendingCount,
    weeklyIncome: { amountMinor: sum(weekly, 'cur'), changePct: pct(sum(weekly, 'cur'), sum(weekly, 'prev')) }, trend,
  };
}

/* ---------- dashboard: bar chart ("monthly" = last 6 months, "annual" = last 6 years) ---------- */
export async function activity(ownerId: string, o: Opts & { period: 'monthly' | 'annual' }) {
  const s = await resolveScope(ownerId, o); const count = 6;
  const monthly = o.period === 'monthly';
  let keys: string[];
  if (monthly) keys = monthKeysBack(count + 1, o.tz);
  else { const y = ymNow(o.tz).y; keys = Array.from({ length: count + 1 }, (_, i) => String(y - count + i)); }
  if (!s.ids.length) return { currency: s.currency, period: o.period, hasData: false, buckets: keys.slice(1).map((k) => ({ key: k, label: monthly ? monthLabel(k) : k, ...flow(), changePct: null })), peakIndex: null };
  const from = new Date(Date.now() - (count + 1) * (monthly ? 32 : 367) * DAY);
  const get = await flowsByKey(ownerId, s, monthly ? '%Y-%m' : '%Y', o.tz, from);
  const buckets = keys.map((k) => ({ key: k, label: monthly ? monthLabel(k) : k, ...get(k) }));
  const out = buckets.slice(1).map((b, i) => ({ ...b, changePct: pct(b.netMinor, buckets[i]!.netMinor) }));
  const hasData = out.some((b) => b.incomeMinor || b.expenseMinor);
  let peakIndex: number | null = null;
  if (hasData) out.forEach((b, i) => { if (peakIndex === null || b.netMinor > out[peakIndex]!.netMinor) peakIndex = i; });
  return { currency: s.currency, period: o.period, hasData, buckets: out, peakIndex };
}

/* ---------- reports ---------- */
export async function cashFlowReport(ownerId: string, o: Opts & { from?: Date; to?: Date }) {
  const s = await resolveScope(ownerId, o); const { from, to } = resolveRange(o.from, o.to, 180);
  const keys = monthKeysBetween(from, to, o.tz);
  const empty = { currency: s.currency, range: { from, to }, hasData: false, totals: flow(), previous: flow(), change: { incomePct: null, expensePct: null, netPct: null }, series: keys.map((k) => ({ month: k, ...flow() })), breakdown: { income: [], expense: [] }, topCounterparties: [], statusCounts: {} };
  if (!s.ids.length) return empty;

  const base = { ownerId: oid(ownerId), walletId: { $in: s.ids } };
  const span = to.getTime() - from.getTime(); const prevFrom = new Date(from.getTime() - span);
  const [get, prevTotals, cats, cps, statuses] = await Promise.all([
    flowsByKey(ownerId, s, '%Y-%m', o.tz, from, to),
    flowsByKey(ownerId, s, 'all', o.tz, prevFrom, new Date(from.getTime() - 1)),
    agg([{ $match: { ...base, status: 'completed', occurredAt: { $gte: from, $lte: to } } },
      { $group: { _id: { t: '$type', c: { $ifNull: ['$category', 'Uncategorised'] } }, sum: { $sum: '$amountMinor' }, count: { $sum: 1 } } }, { $sort: { sum: -1 } }]),
    agg([{ $match: { ...base, status: 'completed', contactId: { $ne: null }, occurredAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$contactId', volumeMinor: { $sum: '$amountMinor' }, netMinor: { $sum: NET }, count: { $sum: 1 } } }, { $sort: { volumeMinor: -1 } }, { $limit: 5 }]),
    agg([{ $match: { ...base, occurredAt: { $gte: from, $lte: to } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  const series = keys.map((k) => ({ month: k, ...get(k) }));
  const totals = series.reduce((a, b) => flow(a.incomeMinor + b.incomeMinor, a.expenseMinor + b.expenseMinor), flow());
  const previous = prevTotals('all');
  const share = (t: 'income' | 'expense') => {
    const rows = cats.filter((r) => r._id.t === t); const total = rows.reduce((a, r) => a + r.sum, 0);
    return rows.map((r) => ({ category: r._id.c as string, amountMinor: r.sum as number, count: r.count as number, sharePct: total ? Math.round((r.sum / total) * 1000) / 10 : 0 }));
  };
  const names = new Map((await Contact.find({ ownerId, _id: { $in: cps.map((c) => c._id) } }).select('name').lean()).map((c) => [String(c._id), c.name]));
  return {
    currency: s.currency, range: { from, to }, hasData: series.some((x) => x.incomeMinor || x.expenseMinor), totals, previous,
    change: { incomePct: pct(totals.incomeMinor, previous.incomeMinor), expensePct: pct(totals.expenseMinor, previous.expenseMinor), netPct: pct(totals.netMinor, previous.netMinor) },
    series, breakdown: { income: share('income'), expense: share('expense') },
    topCounterparties: cps.map((c) => ({ contactId: String(c._id), name: names.get(String(c._id)) ?? 'Unknown', volumeMinor: c.volumeMinor, netMinor: c.netMinor, count: c.count })),
    statusCounts: Object.fromEntries(statuses.map((r) => [r._id, r.count])),
  };
}

export async function yearComparison(ownerId: string, o: Opts) {
  const s = await resolveScope(ownerId, o); const y = ymNow(o.tz).y;
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  if (!s.ids.length) return { currency: s.currency, year: y, hasData: false, months: months.map((m, i) => ({ month: MONTHS[i], thisYear: flow(), lastYear: flow() })), totals: { thisYear: flow(), lastYear: flow(), netChangePct: null } };
  const get = await flowsByKey(ownerId, s, '%Y-%m', o.tz, new Date(Date.UTC(y - 1, 0, 1) - 2 * DAY));
  const rows = months.map((m, i) => ({ month: MONTHS[i]!, thisYear: get(`${y}-${m}`), lastYear: get(`${y - 1}-${m}`) }));
  const sumOf = (pick: (r: (typeof rows)[number]) => Flow) => rows.reduce((a, r) => flow(a.incomeMinor + pick(r).incomeMinor, a.expenseMinor + pick(r).expenseMinor), flow());
  const t = { thisYear: sumOf((r) => r.thisYear), lastYear: sumOf((r) => r.lastYear) };
  return { currency: s.currency, year: y, hasData: rows.some((r) => r.thisYear.incomeMinor || r.thisYear.expenseMinor || r.lastYear.incomeMinor || r.lastYear.expenseMinor), months: rows, totals: { ...t, netChangePct: pct(t.thisYear.netMinor, t.lastYear.netMinor) } };
}
