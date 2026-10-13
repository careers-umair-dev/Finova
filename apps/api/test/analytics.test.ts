import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDb, daysAgo, meId, mkWallet, post, startApp, user } from './helpers.js';

let app: Express; let stop: () => Promise<void>;
beforeAll(async () => { ({ app, stop } = await startApp()); });
afterAll(async () => stop());
beforeEach(clearDb);

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const now = new Date(); const Y = now.getUTCFullYear(), M = now.getUTCMonth();
const monthMid = (back: number) => new Date(Date.UTC(Y, M - back, 15, 12)).toISOString(); // 15th, 12:00 UTC, `back` months ago
const get = (a: any, path: string) => a.get(`/api/v1${path}`);

describe('dashboard summary', () => {
  it('computes balance, range totals, weekly change and trend from completed USD transactions only', async () => {
    const a = await user(app, 'a@example.com'); const w = await mkWallet(a, { openingBalance: '1000.00' });
    await post(a, w, { amount: '200.00', occurredAt: daysAgo(1) });
    await post(a, w, { type: 'expense', amount: '50.00', occurredAt: daysAgo(2) });
    await post(a, w, { amount: '100.00', occurredAt: daysAgo(10) });                      // previous week
    await post(a, w, { amount: '999.00', status: 'pending' });                              // never counted
    const eur = await mkWallet(a, { name: 'EUR', currency: 'EUR', openingBalance: '0' });
    await post(a, eur, { amount: '5000.00' });                                              // never mixed into USD

    const s = (await get(a, '/dashboard/summary')).body.data;
    expect(s.currency).toBe('USD');
    expect(s.balanceMinor).toBe(100000 + 20000 - 5000 + 10000);
    expect(s.income).toBe(30000); expect(s.expense).toBe(5000); expect(s.net).toBe(25000);
    expect(s.pendingCount).toBe(1);
    expect(s.weeklyIncome).toEqual({ amountMinor: 20000, changePct: 100 });                // 200 vs 100
    expect(s.trend.at(-1).balanceMinor).toBe(s.balanceMinor);
    expect(s.trend[0].balanceMinor).toBeGreaterThanOrEqual(100000);

    const e = (await get(a, '/dashboard/summary?currency=EUR')).body.data;
    expect(e.currency).toBe('EUR'); expect(e.balanceMinor).toBe(500000);
  });
  it('returns an empty state for accounts with no wallets', async () => {
    const a = await user(app, 'a@example.com');
    const s = (await get(a, '/dashboard/summary')).body.data;
    expect(s).toMatchObject({ hasData: false, balanceMinor: 0, trend: [] });
  });
  it("never shows another user's figures and rejects their wallet ids", async () => {
    const alice = await user(app, 'alice@example.com'); const bob = await user(app, 'bob@example.com');
    const aw = await mkWallet(alice); await post(alice, aw, { amount: '500.00' });
    expect((await get(bob, '/dashboard/summary')).body.data.hasData).toBe(false);
    expect((await get(bob, `/dashboard/summary?walletId=${aw.id}`)).status).toBe(404);
    expect((await get(bob, '/reports/cash-flow')).body.data.hasData).toBe(false);
    expect((await request(app).get('/api/v1/dashboard/summary')).status).toBe(401);
  });
  it('validates query input', async () => {
    const a = await user(app, 'a@example.com'); await mkWallet(a);
    for (const qs of ['tz=Mars/Phobos', 'bogus=1', `from=${daysAgo(400)}&to=${daysAgo(0)}`, `from=${daysAgo(1)}&to=${daysAgo(5)}`, 'currency=JPY'])
      expect((await get(a, `/dashboard/summary?${qs}`)).status, qs).toBe(400);
  });
});

describe('dashboard activity chart', () => {
  it('returns six monthly buckets with change vs previous bucket and the peak', async () => {
    const a = await user(app, 'a@example.com'); const w = await mkWallet(a, { openingBalance: '1000.00' });
    await post(a, w, { amount: '100.00', occurredAt: monthMid(2) });
    await post(a, w, { amount: '200.00', occurredAt: monthMid(1) });
    await post(a, w, { amount: '400.00', occurredAt: new Date(Date.now() - 60e3).toISOString() });
    await post(a, w, { type: 'expense', amount: '100.00', occurredAt: new Date(Date.now() - 60e3).toISOString() });
    const d = (await get(a, '/dashboard/activity?period=monthly')).body.data;
    expect(d.buckets).toHaveLength(6); expect(d.hasData).toBe(true);
    const [b2, b1, b0] = d.buckets.slice(-3);
    expect(b0).toMatchObject({ label: MONTHS[M], incomeMinor: 40000, expenseMinor: 10000, netMinor: 30000, changePct: 50 });
    expect(b1).toMatchObject({ netMinor: 20000, changePct: 100 });
    expect(b2.netMinor).toBe(10000);
    expect(d.peakIndex).toBe(5);
  });
  it('supports annual buckets', async () => {
    const a = await user(app, 'a@example.com'); const w = await mkWallet(a);
    await post(a, w, { amount: '400.00', occurredAt: new Date(Date.now() - 60e3).toISOString() });
    const d = (await get(a, '/dashboard/activity?period=annual')).body.data;
    expect(d.buckets).toHaveLength(6); expect(d.buckets.at(-1).label).toBe(String(Y)); expect(d.buckets.at(-1).incomeMinor).toBeGreaterThanOrEqual(40000);
  });
  it('buckets by the caller\'s timezone', async () => {
    const a = await user(app, 'a@example.com'); const w = await mkWallet(a);
    await post(a, w, { amount: '75.00', occurredAt: new Date(Date.UTC(Y, M, 0, 20, 0)).toISOString() }); // last day of prev month, 20:00 UTC = 01:00 on the 1st in Karachi
    const utc = (await get(a, '/dashboard/activity?tz=UTC')).body.data.buckets;
    const pk = (await get(a, '/dashboard/activity?tz=Asia/Karachi')).body.data.buckets;
    expect(utc.at(-1).incomeMinor).toBe(0); expect(utc.at(-2).incomeMinor).toBe(7500);
    expect(pk.at(-1).incomeMinor).toBe(7500);
  });
  it('is an empty state without data', async () => {
    const a = await user(app, 'a@example.com'); await mkWallet(a);
    const d = (await get(a, '/dashboard/activity')).body.data;
    expect(d.hasData).toBe(false); expect(d.peakIndex).toBeNull(); expect(d.buckets).toHaveLength(6);
  });
});

describe('reports', () => {
  async function fixture() {
    const a = await user(app, 'a@example.com'); const w = await mkWallet(a, { openingBalance: '1000.00' });
    const { Contact } = await import('../src/models/Contact.js'); const owner = await meId(a);
    const acme = await Contact.create({ ownerId: owner, name: 'Acme Co' }); const bolt = await Contact.create({ ownerId: owner, name: 'Bolt Ltd' });
    await post(a, w, { amount: '300.00', category: 'Consulting', contactId: String(acme._id), occurredAt: daysAgo(5) });
    await post(a, w, { amount: '100.00', category: 'Consulting', occurredAt: daysAgo(6) });
    await post(a, w, { amount: '100.00', occurredAt: daysAgo(7) });
    await post(a, w, { type: 'expense', amount: '50.00', category: 'Software', contactId: String(bolt._id), occurredAt: daysAgo(8) });
    await post(a, w, { type: 'expense', amount: '150.00', category: 'Software', occurredAt: daysAgo(9) });
    await post(a, w, { amount: '250.00', occurredAt: daysAgo(90) });                                  // previous period
    const p = (await post(a, w, { amount: '5.00', status: 'pending', occurredAt: daysAgo(3) })).body.data.transaction;
    await a.patch(`/api/v1/transactions/${p.id}`).send({ status: 'failed' });
    return a;
  }
  it('totals, compares with the previous period, breaks down by category and counterparty', async () => {
    const a = await fixture();
    const r = (await get(a, `/reports/cash-flow?from=${encodeURIComponent(daysAgo(60))}&to=${encodeURIComponent(daysAgo(0))}`)).body.data;
    expect(r.totals).toEqual({ incomeMinor: 50000, expenseMinor: 20000, netMinor: 30000 });
    expect(r.series.reduce((s: number, x: any) => s + x.incomeMinor, 0)).toBe(50000);
    expect(r.previous.incomeMinor).toBe(25000);
    expect(r.change).toEqual({ incomePct: 100, expensePct: null, netPct: 20 });                      // net: 300 vs 250 => +20%
    expect(r.breakdown.income).toEqual([
      { category: 'Consulting', amountMinor: 40000, count: 2, sharePct: 80 },
      { category: 'Uncategorised', amountMinor: 10000, count: 1, sharePct: 20 },
    ]);
    expect(r.breakdown.expense[0]).toMatchObject({ category: 'Software', amountMinor: 20000, sharePct: 100 });
    expect(r.topCounterparties[0]).toMatchObject({ name: 'Acme Co', volumeMinor: 30000, netMinor: 30000 });
    expect(r.statusCounts).toEqual({ completed: 5, failed: 1 });
  });
  it('exports the monthly series as CSV', async () => {
    const a = await fixture();
    const res = await get(a, `/reports/cash-flow.csv?from=${encodeURIComponent(daysAgo(60))}&to=${encodeURIComponent(daysAgo(0))}`);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe('Month,Income,Expense,Net,Currency');
    const income = lines.slice(1).reduce((s: number, l: string) => s + Number(l.split(',')[1]), 0);
    expect(income).toBe(500);
  });
  it('compares this year with last year by month', async () => {
    const a = await user(app, 'a@example.com'); const w = await mkWallet(a);
    await post(a, w, { amount: '500.00', occurredAt: new Date(Date.UTC(Y - 1, 5, 15, 12)).toISOString() });
    await post(a, w, { amount: '100.00', occurredAt: new Date(Date.now() - 60e3).toISOString() });
    const c = (await get(a, '/reports/compare')).body.data;
    expect(c.year).toBe(Y); expect(c.months).toHaveLength(12);
    expect(c.months[5].lastYear.incomeMinor).toBe(50000);
    expect(c.totals.lastYear.incomeMinor).toBe(50000);
    expect(c.months[M].thisYear.incomeMinor).toBeGreaterThanOrEqual(10000);
  });
});
