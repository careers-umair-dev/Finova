import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import type { Express } from 'express';
import { expect } from 'vitest';

export type Agent = ReturnType<typeof request.agent>;
export const PW = 'correct-horse-battery';

/** Single-node replica set: needed for MongoDB transactions (matches Atlas). Returns the app and a teardown. */
export async function startApp() {
  const rs = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(rs.getUri());
  const app: Express = (await import('../src/app.js')).createApp();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // ensure unique/partial indexes exist
  return { app, stop: async () => { await mongoose.disconnect(); await rs.stop(); } };
}
export const clearDb = async () => { for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({}); };

export async function user(app: Express, email: string): Promise<Agent> {
  const a = request.agent(app);
  a.set('X-Requested-With', 'finova');
  expect((await a.post('/api/v1/auth/register').send({ name: 'U', email, password: PW })).status).toBe(201);
  return a;
}
export const meId = async (a: Agent) => (await a.get('/api/v1/me')).body.data.user.id as string;
export const mkWallet = async (a: Agent, body: object = {}) =>
  (await a.post('/api/v1/wallets').send({ name: 'Main', currency: 'USD', openingBalance: '1000.00', ...body })).body.data.wallet;
export const post = (a: Agent, w: { id: string }, over: object = {}) => a.post('/api/v1/transactions').send({ walletId: w.id, type: 'income', amount: '10.00', ...over });
export const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
export const binary = (res: any, cb: (e: Error | null, b?: Buffer) => void) => {
  const chunks: Buffer[] = []; res.on('data', (c: Buffer) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks)));
};
