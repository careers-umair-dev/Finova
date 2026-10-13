import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mails = vi.hoisted(() => [] as { to: string; link?: string }[]);
vi.mock('../src/lib/mailer.js', () => ({
  smtpEnabled: false,
  sendMail: async (to: string, _s: string, _t: string, link?: string) => { mails.push({ to, link }); },
}));

const H = { 'X-Requested-With': 'finova' };
const PW = 'correct-horse-battery';
let mongod: MongoMemoryServer;
let app: Express;

const cookie = (res: request.Response, name: string) =>
  (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(`${name}=`))!.split(';')[0]!;
const signup = (email = 'umair@example.com') => request(app).post('/api/v1/auth/register').set(H).send({ name: 'Umair', email, password: PW });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = (await import('../src/app.js')).createApp();
});
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { await mongoose.connection.dropDatabase(); mails.length = 0; });

describe('registration & login', () => {
  it('registers, sets httpOnly cookies, and never returns the password hash', async () => {
    const res = await signup();
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|correct-horse/);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toHaveLength(2);
    expect(cookies.every((c) => /HttpOnly/i.test(c))).toBe(true);
  });
  it('rejects weak passwords and unknown fields', async () => {
    expect((await request(app).post('/api/v1/auth/register').set(H).send({ name: 'A', email: 'a@b.co', password: 'short' })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/register').set(H).send({ name: 'A', email: 'a@b.co', password: PW, role: 'admin' })).status).toBe(400);
  });
  it('rejects duplicate email', async () => {
    await signup();
    expect((await signup()).status).toBe(409);
  });
  it('logs in with correct credentials and rejects wrong ones with the same message', async () => {
    await signup();
    const bad = await request(app).post('/api/v1/auth/login').set(H).send({ email: 'umair@example.com', password: 'wrong-password-1' });
    const ghost = await request(app).post('/api/v1/auth/login').set(H).send({ email: 'nobody@example.com', password: 'wrong-password-1' });
    expect(bad.status).toBe(401);
    expect(ghost.body.error.message).toBe(bad.body.error.message);
    expect((await request(app).post('/api/v1/auth/login').set(H).send({ email: 'umair@example.com', password: PW })).status).toBe(200);
  });
  it('blocks NoSQL operator injection', async () => {
    await signup();
    const res = await request(app).post('/api/v1/auth/login').set(H).send({ email: { $ne: null }, password: PW });
    expect(res.status).toBe(400);
  });
});

describe('protected routes', () => {
  it('requires auth', async () => {
    expect((await request(app).get('/api/v1/me')).status).toBe(401);
  });
  it('serves /me to a logged-in agent', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').set(H).send({ name: 'Umair', email: 'umair@example.com', password: PW });
    const me = await agent.get('/api/v1/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('umair@example.com');
  });
  it('rejects state-changing requests without the CSRF header', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'a@b.co', password: PW });
    expect(res.status).toBe(403);
  });
  it('logout revokes the session immediately, even for a still-valid access token', async () => {
    const res = await signup();
    const at = cookie(res, 'fv_at'), rt = cookie(res, 'fv_rt');
    expect((await request(app).get('/api/v1/me').set('Cookie', at)).status).toBe(200);
    await request(app).post('/api/v1/auth/logout').set(H).set('Cookie', rt);
    expect((await request(app).get('/api/v1/me').set('Cookie', at)).status).toBe(401);
  });
});

describe('refresh rotation', () => {
  it('rotates, and revokes the session if an old token is replayed', async () => {
    const res = await signup();
    const rt1 = cookie(res, 'fv_rt');
    const r2 = await request(app).post('/api/v1/auth/refresh').set(H).set('Cookie', rt1);
    expect(r2.status).toBe(200);
    const rt2 = cookie(r2, 'fv_rt');
    expect(rt2).not.toBe(rt1);
    expect((await request(app).post('/api/v1/auth/refresh').set(H).set('Cookie', rt1)).status).toBe(401); // replay
    expect((await request(app).post('/api/v1/auth/refresh').set(H).set('Cookie', rt2)).status).toBe(401); // session now dead
  });
});

describe('sessions', () => {
  it('lets a user revoke only their own sessions', async () => {
    const a = await signup('a@example.com');
    const b = await signup('b@example.com');
    const bSessions = await request(app).get('/api/v1/me/sessions').set('Cookie', cookie(b, 'fv_at'));
    const bId = bSessions.body.data.sessions[0].id;
    const attack = await request(app).delete(`/api/v1/me/sessions/${bId}`).set(H).set('Cookie', cookie(a, 'fv_at'));
    expect(attack.status).toBe(404);
    expect((await request(app).get('/api/v1/me').set('Cookie', cookie(b, 'fv_at'))).status).toBe(200);
  });
});

describe('password reset', () => {
  it('answers identically for unknown emails, resets with a one-time token, and signs out everywhere', async () => {
    const res = await signup();
    const at = cookie(res, 'fv_at');
    const ghost = await request(app).post('/api/v1/auth/forgot-password').set(H).send({ email: 'nobody@example.com' });
    expect(ghost.status).toBe(202);
    expect(mails).toHaveLength(0);

    await request(app).post('/api/v1/auth/forgot-password').set(H).send({ email: 'umair@example.com' });
    const token = new URL(mails[0]!.link!).searchParams.get('token')!;
    const done = await request(app).post('/api/v1/auth/reset-password').set(H).send({ token, password: 'a-brand-new-password' });
    expect(done.status).toBe(200);
    expect((await request(app).post('/api/v1/auth/reset-password').set(H).send({ token, password: 'another-new-password' })).status).toBe(400); // single use
    expect((await request(app).get('/api/v1/me').set('Cookie', at)).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').set(H).send({ email: 'umair@example.com', password: 'a-brand-new-password' })).status).toBe(200);
  });
});

describe('health', () => {
  it('reports ok and ready', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/health/ready')).status).toBe(200);
  });
});
