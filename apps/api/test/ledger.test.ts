import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Transactions need a replica set, so these tests use a single-node replset (same as Atlas behaviour).
const PW = 'correct-horse-battery';
let rs: MongoMemoryReplSet;
let app: Express;
type Agent = ReturnType<typeof request.agent>;

async function user(email: string): Promise<Agent> {
  const a = request.agent(app);
  a.set('X-Requested-With', 'finova');
  expect((await a.post('/api/v1/auth/register').send({ name: 'U', email, password: PW })).status).toBe(201);
  return a;
}
const mkWallet = async (a: Agent, body: object = {}) =>
  (await a.post('/api/v1/wallets').send({ name: 'Main', currency: 'USD', openingBalance: '100.00', ...body })).body.data.wallet;
const post = (a: Agent, w: { id: string }, over: object = {}, key?: string) => {
  const r = a.post('/api/v1/transactions').send({ walletId: w.id, type: 'income', amount: '10.00', ...over });
  return key ? r.set('Idempotency-Key', key) : r;
};
const bal = async (a: Agent, id: string) => (await a.get(`/api/v1/wallets/${id}`)).body.data.wallet.balanceMinor as number;

beforeAll(async () => {
  rs = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(rs.getUri());
  app = (await import('../src/app.js')).createApp();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // make sure unique indexes exist
});
afterAll(async () => { await mongoose.disconnect(); await rs.stop(); });
beforeEach(async () => { for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({}); });

describe('wallets & balances', () => {
  it('derives balance from opening balance + completed transactions only, in integer minor units', async () => {
    const a = await user('a@example.com');
    const w = await mkWallet(a, { openingBalance: '100.00' });
    expect(w.balanceMinor).toBe(10000);
    await post(a, w, { amount: '0.10' }); await post(a, w, { amount: '0.20' });          // classic float trap: 0.1 + 0.2
    expect(await bal(a, w.id)).toBe(10030);
    await post(a, w, { type: 'expense', amount: '30.00', status: 'pending' });            // pending doesn't count
    expect(await bal(a, w.id)).toBe(10030);
  });
  it('rejects client-supplied currency/balance fields and bad amounts', async () => {
    const a = await user('a@example.com'); const w = await mkWallet(a);
    expect((await post(a, w, { currency: 'EUR' })).status).toBe(400);
    expect((await post(a, w, { balanceMinor: 999999 })).status).toBe(400);
    for (const amount of ['-5', '0', '1.234', 'abc', '1e3']) expect((await post(a, w, { amount })).status).toBe(400);
    expect((await a.post('/api/v1/wallets').send({ name: 'X', currency: 'JPY' })).status).toBe(400);
  });
  it('locks currency/opening balance after the first transaction, but allows rename and archive', async () => {
    const a = await user('a@example.com'); const w = await mkWallet(a);
    expect((await a.patch(`/api/v1/wallets/${w.id}`).send({ currency: 'EUR' })).status).toBe(200); // no transactions yet
    await post(a, w);
    expect((await a.patch(`/api/v1/wallets/${w.id}`).send({ currency: 'USD' })).status).toBe(409);
    expect((await a.patch(`/api/v1/wallets/${w.id}`).send({ name: 'Renamed' })).body.data.wallet.name).toBe('Renamed');
    expect((await a.patch(`/api/v1/wallets/${w.id}`).send({ archived: true })).status).toBe(200);
    expect((await post(a, w)).status).toBe(409);                                                 // archived wallet takes no new entries
    expect((await a.get('/api/v1/wallets')).body.data.wallets).toHaveLength(0);
    expect((await a.get('/api/v1/wallets?includeArchived=true')).body.data.wallets).toHaveLength(1);
  });
});

describe('overdraft protection', () => {
  it('rejects an expense larger than the balance', async () => {
    const a = await user('a@example.com'); const w = await mkWallet(a, { openingBalance: '50.00' });
    const res = await post(a, w, { type: 'expense', amount: '50.01' });
    expect(res.status).toBe(422); expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');
    expect(await bal(a, w.id)).toBe(5000);
  });
  it('never overdraws under concurrent requests', async () => {
    const a = await user('a@example.com'); const w = await mkWallet(a, { openingBalance: '100.00' });
    const results = await Promise.all([1, 2, 3, 4, 5].map((i) => post(a, w, { type: 'expense', amount: '40.00' }, `concurrent-key-${i}`)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(await bal(a, w.id)).toBe(2000);
  });
  it('re-checks funds when a pending expense is completed', async () => {
    const a = await user('a@example.com'); const w = await mkWallet(a, { openingBalance: '100.00' });
    const small = (await post(a, w, { type: 'expense', amount: '30.00', status: 'pending' })).body.data.transaction;
    const big = (await post(a, w, { type: 'expense', amount: '90.00', status: 'pending' })).body.data.transaction;
    expect((await a.patch(`/api/v1/transactions/${small.id}`).send({ status: 'completed' })).status).toBe(200);
    expect(await bal(a, w.id)).toBe(7000);
    const res = await a.patch(`/api/v1/transactions/${big.id}`).send({ status: 'completed' });
    expect(res.status).toBe(422);
    expect((await a.get(`/api/v1/transactions/${big.id}`)).body.data.transaction.status).toBe('pending');
    expect((await a.patch(`/api/v1/transactions/${small.id}`).send({ status: 'failed' })).status).toBe(409); // completed is final
  });
});

describe('idempotency & immutability', () => {
  it('does not double-apply a retried request', async () => {
    const a = await user('a@example.com'); const w = await mkWallet(a);
    const first = await post(a, w, { amount: '25.00' }, 'retry-key-0001');
    const again = await post(a, w, { amount: '25.00' }, 'retry-key-0001');
    expect(first.status).toBe(201); expect(again.status).toBe(200);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(again.body.data.transaction.id).toBe(first.body.data.transaction.id);
    expect(await bal(a, w.id)).toBe(12500);
  });
  it('refuses to reuse a key for a different request', async () => {
    const a = await user('a@example.com'); const w = await mkWallet(a);
    await post(a, w, { amount: '25.00' }, 'retry-key-0002');
    expect((await post(a, w, { amount: '99.00' }, 'retry-key-0002')).status).toBe(422);
  });
  it('does not let amount, wallet, or type be edited', async () => {
    const a = await user('a@example.com'); const w = await mkWallet(a);
    const t = (await post(a, w)).body.data.transaction;
    for (const body of [{ amountMinor: 1 }, { amount: '1.00' }, { type: 'expense' }, { walletId: w.id }])
      expect((await a.patch(`/api/v1/transactions/${t.id}`).send(body)).status).toBe(400);
  });
});

describe('user data isolation', () => {
  it("never exposes or mutates another user's wallets, transactions or contacts", async () => {
    const alice = await user('alice@example.com'); const bob = await user('bob@example.com');
    const aw = await mkWallet(alice); const at = (await post(alice, aw)).body.data.transaction;
    const bw = await mkWallet(bob, { name: 'Bob wallet' });

    expect((await bob.get(`/api/v1/wallets/${aw.id}`)).status).toBe(404);
    expect((await bob.patch(`/api/v1/wallets/${aw.id}`).send({ name: 'pwned' })).status).toBe(404);
    expect((await bob.get(`/api/v1/transactions/${at.id}`)).status).toBe(404);
    expect((await bob.patch(`/api/v1/transactions/${at.id}`).send({ description: 'pwned' })).status).toBe(404);
    expect((await post(bob, aw)).status).toBe(404);                                              // can't write into Alice's wallet
    expect((await bob.get('/api/v1/wallets')).body.data.wallets.map((w: any) => w.id)).toEqual([bw.id]);
    expect((await bob.get('/api/v1/transactions')).body.data.total).toBe(0);
    expect((await bob.get(`/api/v1/transactions?walletId=${aw.id}`)).body.data.total).toBe(0);   // filtering by a foreign id leaks nothing
    expect((await bob.get('/api/v1/transactions/export.csv')).text).not.toContain('Main');
    expect(await bal(alice, aw.id)).toBe(11000);

    const { Contact } = await import('../src/models/Contact.js');
    const me = (await alice.get('/api/v1/me')).body.data.user.id;
    const c = await Contact.create({ ownerId: me, name: 'Alice client' });
    expect((await post(bob, bw, { contactId: String(c._id) })).status).toBe(404);                 // can't attach Alice's contact
  });
  it('requires authentication', async () => {
    for (const path of ['/api/v1/wallets', '/api/v1/transactions', '/api/v1/transactions/export.csv'])
      expect((await request(app).get(path)).status).toBe(401);
  });
});

describe('history: filters, sorting, pagination, CSV', () => {
  async function fixture() {
    const a = await user('a@example.com'); const w = await mkWallet(a, { openingBalance: '1000.00' });
    await post(a, w, { amount: '10.00', description: 'Alpha invoice', occurredAt: '2026-01-10T10:00:00Z' });
    await post(a, w, { amount: '20.00', description: 'Beta invoice', occurredAt: '2026-02-10T10:00:00Z' });
    await post(a, w, { type: 'expense', amount: '5.00', description: 'Gamma hosting', occurredAt: '2026-03-10T10:00:00Z' });
    await post(a, w, { type: 'expense', amount: '7.00', status: 'pending', description: 'Delta travel', occurredAt: '2026-04-10T10:00:00Z' });
    await post(a, w, { amount: '40.00', description: '=HYPERLINK("http://evil.example")', occurredAt: '2026-05-10T10:00:00Z' });
    return { a, w };
  }
  it('filters by status, type, text and date range', async () => {
    const { a } = await fixture();
    const total = async (qs: string) => (await a.get(`/api/v1/transactions?${qs}`)).body.data.total;
    expect(await total('status=pending')).toBe(1);
    expect(await total('type=expense')).toBe(2);
    expect(await total('q=invoice')).toBe(2);
    expect(await total('q=.*')).toBe(0);                                                          // regex chars are escaped, not interpreted
    expect(await total('from=2026-02-01T00:00:00Z&to=2026-03-31T00:00:00Z')).toBe(2);
    expect((await a.get('/api/v1/transactions?bogus=1')).status).toBe(400);
  });
  it('sorts and paginates', async () => {
    const { a } = await fixture();
    const p2 = (await a.get('/api/v1/transactions?limit=2&page=2')).body.data;
    expect(p2.items).toHaveLength(2); expect(p2.total).toBe(5);
    const byAmt = (await a.get('/api/v1/transactions?sort=amountMinor&order=asc')).body.data.items;
    expect(byAmt[0].amountMinor).toBe(500);
  });
  it('exports CSV with signed amounts, honours filters, and neutralises formula injection', async () => {
    const { a } = await fixture();
    const res = await a.get('/api/v1/transactions/export.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe('Date,Wallet,Counterparty,Type,Status,Amount,Currency,Description,Category');
    expect(lines).toHaveLength(6);
    expect(res.text).toContain(',-5.00,USD,');
    expect(res.text).toContain(`'=HYPERLINK`);                                                    // prefixed so Excel won't run it
    const filtered = await a.get('/api/v1/transactions/export.csv?status=pending');
    expect(filtered.text.trim().split('\r\n')).toHaveLength(2);
  });
});
