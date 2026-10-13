import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { CURRENCIES } from '../lib/money.js';
import { money, oidStr } from '../lib/zod.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as ledger from '../services/ledger.js';

const r = Router();
r.use(requireAuth);
const idParam = z.object({ id: oidStr });

r.get('/', validate({ query: z.object({ includeArchived: z.enum(['true', 'false']).default('false') }).strict() }),
  ah(async (req, res) => {
    res.json({ data: await ledger.listWallets(req.auth!.userId, req.query.includeArchived === 'true') });
  }));

r.post('/', validate({ body: z.object({
  name: z.string().trim().min(1).max(60), currency: z.enum(CURRENCIES), openingBalance: money(true).optional(),
}).strict() }), ah(async (req, res) => {
  const wallet = await ledger.createWallet(req.auth!.userId, { name: req.body.name, currency: req.body.currency, openingBalanceMinor: req.body.openingBalance ?? 0 }, req);
  res.status(201).json({ data: { wallet } });
}));

r.get('/:id', validate({ params: idParam }), ah(async (req, res) => {
  res.json({ data: { wallet: await ledger.getWallet(req.auth!.userId, req.params.id!) } });
}));

r.patch('/:id', validate({ params: idParam, body: z.object({
  name: z.string().trim().min(1).max(60), archived: z.boolean(), currency: z.enum(CURRENCIES), openingBalance: money(true),
}).partial().strict() }), ah(async (req, res) => {
  const { openingBalance, ...rest } = req.body;
  const wallet = await ledger.updateWallet(req.auth!.userId, req.params.id!, { ...rest, openingBalanceMinor: openingBalance }, req);
  res.json({ data: { wallet } });
}));

export default r;
