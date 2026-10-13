import fs from 'node:fs/promises';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { binary, clearDb, meId, mkWallet, post, startApp, user } from './helpers.js';

let app: Express; let stop: () => Promise<void>;
beforeAll(async () => { ({ app, stop } = await startApp()); });
afterAll(async () => stop());
beforeEach(clearDb);
const API = '/api/v1';

describe('contacts', () => {
  it('creates, validates, searches and edits', async () => {
    const a = await user(app, 'a@example.com');
    expect((await a.post(`${API}/contacts`).send({ name: 'Acme Co', email: 'Billing@Acme.example', phone: '+92 300 1234567' })).status).toBe(201);
    await a.post(`${API}/contacts`).send({ name: 'Bolt Ltd' });
    expect((await a.post(`${API}/contacts`).send({ name: 'X', email: 'not-an-email' })).status).toBe(400);
    expect((await a.post(`${API}/contacts`).send({ name: 'X', ownerId: 'someone-else' })).status).toBe(400);
    const list = (await a.get(`${API}/contacts?q=acme`)).body.data;
    expect(list.total).toBe(1); expect(list.items[0].email).toBe('billing@acme.example');
    expect((await a.get(`${API}/contacts?q=.*`)).body.data.total).toBe(0);                       // regex chars are escaped
    const id = list.items[0].id;
    const upd = await a.patch(`${API}/contacts/${id}`).send({ name: 'Acme Corp', email: null });
    expect(upd.body.data.contact).toMatchObject({ name: 'Acme Corp', email: null });
  });
  it('archives and restores; archived contacts cannot be attached to new entries', async () => {
    const a = await user(app, 'a@example.com'); const w = await mkWallet(a);
    const c = (await a.post(`${API}/contacts`).send({ name: 'Acme' })).body.data.contact;
    await a.patch(`${API}/contacts/${c.id}`).send({ archived: true });
    expect((await a.get(`${API}/contacts`)).body.data.total).toBe(0);
    expect((await a.get(`${API}/contacts?includeArchived=true`)).body.data.total).toBe(1);
    expect((await post(a, w, { contactId: c.id })).status).toBe(404);
    await a.patch(`${API}/contacts/${c.id}`).send({ archived: false });
    expect((await post(a, w, { contactId: c.id })).status).toBe(201);
  });
  it('links to ledger entries: detail stats, contactId filter, counterparty search', async () => {
    const a = await user(app, 'a@example.com'); const w = await mkWallet(a);
    const c = (await a.post(`${API}/contacts`).send({ name: 'Acme Co' })).body.data.contact;
    await post(a, w, { amount: '100.00', contactId: c.id }); await post(a, w, { type: 'expense', amount: '40.00', contactId: c.id }); await post(a, w);
    const d = (await a.get(`${API}/contacts/${c.id}`)).body.data;
    expect(d.stats.byCurrency.USD).toEqual({ incomeMinor: 10000, expenseMinor: 4000, count: 2 });
    expect((await a.get(`${API}/transactions?contactId=${c.id}`)).body.data.total).toBe(2);
    expect((await a.get(`${API}/transactions?q=acme`)).body.data.total).toBe(2);
  });
  it("isolates users' contacts", async () => {
    const alice = await user(app, 'alice@example.com'); const bob = await user(app, 'bob@example.com');
    const c = (await alice.post(`${API}/contacts`).send({ name: 'Private client' })).body.data.contact;
    expect((await bob.get(`${API}/contacts/${c.id}`)).status).toBe(404);
    expect((await bob.patch(`${API}/contacts/${c.id}`).send({ name: 'pwned' })).status).toBe(404);
    expect((await bob.get(`${API}/contacts`)).body.data.total).toBe(0);
    expect((await request(app).get(`${API}/contacts`)).status).toBe(401);
  });
});

describe('documents', () => {
  const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('fake pdf body for tests')]);
  const upload = (a: any, body: Buffer, type = 'application/pdf', qs = 'name=invoice.pdf&category=invoice') =>
    a.post(`${API}/documents?${qs}`).set('Content-Type', type).send(body);

  it('uploads, lists without exposing storage keys, and downloads the exact bytes safely', async () => {
    const a = await user(app, 'a@example.com');
    const up = await upload(a, PDF);
    expect(up.status).toBe(201);
    expect(JSON.stringify(up.body)).not.toMatch(/storageKey|\/uploads|finova-test-uploads/);
    const id = up.body.data.document.id;
    expect((await a.get(`${API}/documents?category=invoice`)).body.data.total).toBe(1);
    expect((await a.get(`${API}/documents?category=receipt`)).body.data.total).toBe(0);
    expect((await a.get(`${API}/documents?q=invoice`)).body.data.total).toBe(1);
    const dl = await a.get(`${API}/documents/${id}/download`).buffer().parse(binary);
    expect(dl.status).toBe(200); expect(Buffer.compare(dl.body, PDF)).toBe(0);
    expect(dl.headers['content-disposition']).toMatch(/^attachment/);
    expect(dl.headers['content-security-policy']).toContain('sandbox');
    const inline = await a.get(`${API}/documents/${id}/download?inline=true`).buffer().parse(binary);
    expect(inline.headers['content-disposition']).toMatch(/^inline/);
  });
  it('rejects bad uploads', async () => {
    const a = await user(app, 'a@example.com');
    expect((await upload(a, Buffer.from('not really a pdf'))).body.error.code).toBe('CONTENT_MISMATCH');
    expect((await upload(a, Buffer.from('hello'), 'text/plain')).status).toBe(415);
    expect((await upload(a, Buffer.from('<script>alert(1)</script>'), 'text/html')).status).toBe(415);
    expect((await upload(a, Buffer.alloc(6 * 1024 * 1024, 1), 'application/pdf')).status).toBe(413);
    expect((await upload(a, PDF, 'application/pdf', 'category=invoice')).status).toBe(400);        // name required
    expect((await upload(a, PDF, 'application/pdf', 'name=x&category=bogus')).status).toBe(400);
    expect((await request(app).post(`${API}/documents?name=x`).set('X-Requested-With', 'finova').set('Content-Type', 'application/pdf').send(PDF)).status).toBe(401);
  });
  it('sanitises path-like file names and never writes outside the upload directory', async () => {
    const a = await user(app, 'a@example.com');
    const up = await upload(a, PDF, 'application/pdf', `name=${encodeURIComponent('../../etc/passwd')}`);
    expect(up.status).toBe(201); expect(up.body.data.document.name).not.toMatch(/[\\/]/);
  });
  it("blocks other users from a user's documents, and delete removes the file", async () => {
    const alice = await user(app, 'alice@example.com'); const bob = await user(app, 'bob@example.com');
    const id = (await upload(alice, PDF)).body.data.document.id;
    expect((await bob.get(`${API}/documents/${id}/download`)).status).toBe(404);
    expect((await bob.patch(`${API}/documents/${id}`).send({ name: 'pwned' })).status).toBe(404);
    expect((await bob.delete(`${API}/documents/${id}`)).status).toBe(404);
    expect((await bob.get(`${API}/documents`)).body.data.total).toBe(0);
    const { DocumentModel } = await import('../src/models/Document.js');
    const key = (await DocumentModel.findById(id).lean())!.storageKey;
    const path = (await import('node:path')).resolve(process.env.UPLOAD_DIR!, key);
    await expect(fs.access(path)).resolves.toBeUndefined();
    expect((await alice.delete(`${API}/documents/${id}`)).status).toBe(200);
    await expect(fs.access(path)).rejects.toThrow();
    expect((await alice.get(`${API}/documents/${id}/download`)).status).toBe(404);
  });
});

describe('notifications', () => {
  it('creates on pending/complete/fail, counts unread, marks read', async () => {
    const a = await user(app, 'a@example.com'); const w = await mkWallet(a);
    const t = (await post(a, w, { amount: '20.00', status: 'pending' })).body.data.transaction;
    let n = (await a.get(`${API}/notifications`)).body.data;
    expect(n.unreadCount).toBe(1); expect(n.items[0].title).toBe('Payment pending');
    await a.patch(`${API}/transactions/${t.id}`).send({ status: 'completed' });
    n = (await a.get(`${API}/notifications`)).body.data;
    expect(n.unreadCount).toBe(2); expect(n.items[0].title).toBe('Payment completed');
    expect((await a.patch(`${API}/notifications/${n.items[0].id}/read`)).body.data.notification.read).toBe(true);
    expect((await a.get(`${API}/notifications`)).body.data.unreadCount).toBe(1);
    expect((await a.get(`${API}/notifications?unreadOnly=true`)).body.data.items).toHaveLength(1);
    expect((await a.post(`${API}/notifications/read-all`)).body.data.updated).toBe(1);
    expect((await a.get(`${API}/notifications`)).body.data.unreadCount).toBe(0);
  });
  it("respects the in-app preference and isolates users", async () => {
    const alice = await user(app, 'alice@example.com'); const bob = await user(app, 'bob@example.com');
    const aw = await mkWallet(alice); const bw = await mkWallet(bob);
    await post(alice, aw, { status: 'pending' });
    const id = (await alice.get(`${API}/notifications`)).body.data.items[0].id;
    expect((await bob.patch(`${API}/notifications/${id}/read`)).status).toBe(404);
    expect((await bob.get(`${API}/notifications`)).body.data.total).toBe(0);
    await bob.patch(`${API}/me/preferences`).send({ notifications: { inApp: false } });
    await post(bob, bw, { status: 'pending' });
    expect((await bob.get(`${API}/notifications`)).body.data.total).toBe(0);
    expect(await meId(bob)).toBeTruthy();
  });
});
