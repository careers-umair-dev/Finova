import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { AppError } from '../lib/errors.js';
import { minorToDecimal, toCsv } from '../lib/csv.js';
import { money, oidStr } from '../lib/zod.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { TX_STATUSES, TX_TYPES } from '../models/Transaction.js';
import * as ledger from '../services/ledger.js';

const r = Router();
r.use(requireAuth);
const idParam = z.object({ id: oidStr });

const listQuery = z.object({
  walletId: oidStr.optional(), contactId: oidStr.optional(), type: z.enum(TX_TYPES).optional(), status: z.enum(TX_STATUSES).optional(),
  q: z.string().trim().max(80).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(),
  sort: z.enum(['occurredAt', 'amountMinor']).default('occurredAt'), order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
const filterOf = (q: any) => ({ walletId: q.walletId, contactId: q.contactId, type: q.type, status: q.status, q: q.q, from: q.from, to: q.to });

r.get('/', validate({ query: listQuery }), ah(async (req, res) => {
  const q: any = req.query;
  res.json({ data: await ledger.listTransactions(req.auth!.userId, filterOf(q), { sort: q.sort, order: q.order, page: q.page, limit: q.limit }) });
}));

// Registered before "/:id" so "export.csv" isn't treated as an id.
r.get('/export.csv', validate({ query: listQuery }), ah(async (req, res) => {
  const rows = await ledger.exportRows(req.auth!.userId, filterOf(req.query));
  const csv = toCsv([
    ['Date', 'Wallet', 'Counterparty', 'Type', 'Status', 'Amount', 'Currency', 'Description', 'Category'],
    ...rows.map((t) => [t.occurredAt.toISOString(), t.walletName, t.contact?.name, t.type, t.status, minorToDecimal(t.signedAmountMinor), t.currency, t.description, t.category]),
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="finova-transactions.csv"');
  res.send(csv);
}));

r.post('/', validate({ body: z.object({
  walletId: oidStr, type: z.enum(TX_TYPES), amount: money(false), status: z.enum(['completed', 'pending']).default('completed'),
  description: z.string().trim().max(140).optional(), category: z.string().trim().max(40).optional(), contactId: oidStr.optional(),
  occurredAt: z.coerce.date().refine((d) => d.getTime() <= Date.now() + 864e5, 'Date cannot be in the future').optional(),
}).strict() }), ah(async (req, res) => {
  const key = req.get('idempotency-key');
  if (key !== undefined && !/^[\w.-]{8,100}$/.test(key)) throw new AppError(400, 'BAD_IDEMPOTENCY_KEY', 'Idempotency-Key must be 8–100 chars of letters, digits, . _ -');
  const { amount, ...rest } = req.body;
  const out = await ledger.createTransaction(req.auth!.userId, { ...rest, amountMinor: amount }, key, req);
  if (out.replayed) res.setHeader('Idempotent-Replayed', 'true');
  res.status(out.replayed ? 200 : 201).json({ data: { transaction: await ledger.getTransaction(req.auth!.userId, out.id), replayed: out.replayed } });
}));

r.get('/:id', validate({ params: idParam }), ah(async (req, res) => {
  res.json({ data: { transaction: await ledger.getTransaction(req.auth!.userId, req.params.id!) } });
}));

// Amount, wallet, type and date are immutable so history stays auditable. Pending items can be completed or failed.
r.patch('/:id', validate({ params: idParam, body: z.object({
  description: z.string().trim().max(140), category: z.string().trim().max(40).nullable(),
  contactId: oidStr.nullable(), status: z.enum(['completed', 'failed']),
}).partial().strict() }), ah(async (req, res) => {
  res.json({ data: { transaction: await ledger.updateTransaction(req.auth!.userId, req.params.id!, req.body, req) } });
}));

export default r;
