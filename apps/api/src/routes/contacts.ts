import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { notFound } from '../lib/errors.js';
import { escapeRx } from '../lib/text.js';
import { oidStr } from '../lib/zod.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Contact } from '../models/Contact.js';
import { Transaction } from '../models/Transaction.js';
import { logActivity } from '../services/activity.js';

const r = Router();
r.use(requireAuth);
const idParam = z.object({ id: oidStr });
const view = (c: any) => ({ id: String(c._id), name: c.name, email: c.email ?? null, phone: c.phone ?? null, notes: c.notes ?? null, archived: Boolean(c.archivedAt), createdAt: c.createdAt, updatedAt: c.updatedAt });

const fields = {
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().regex(/^[+\d\s().-]{5,30}$/, 'Enter a valid phone number'),
  notes: z.string().trim().max(500),
};

r.get('/', validate({ query: z.object({
  q: z.string().trim().max(80).optional(), includeArchived: z.enum(['true', 'false']).default('false'),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict() }), ah(async (req, res) => {
  const q: any = req.query; const filter: Record<string, any> = { ownerId: req.auth!.userId };
  if (q.includeArchived !== 'true') filter.archivedAt = null;
  if (q.q) { const rx = new RegExp(escapeRx(q.q), 'i'); filter.$or = [{ name: rx }, { email: rx }]; }
  const [total, rows] = await Promise.all([Contact.countDocuments(filter), Contact.find(filter).sort({ name: 1, _id: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean()]);
  res.json({ data: { items: rows.map(view), page: q.page, limit: q.limit, total } });
}));

r.post('/', validate({ body: z.object({ name: fields.name, email: fields.email.optional(), phone: fields.phone.optional(), notes: fields.notes.optional() }).strict() }),
  ah(async (req, res) => {
    const c = await Contact.create({ ownerId: req.auth!.userId, ...req.body });
    await logActivity(req.auth!.userId, 'contact.create', req, { entityType: 'contact', entityId: c.id });
    res.status(201).json({ data: { contact: view(c) } });
  }));

// Detail includes per-currency totals of completed ledger entries linked to this contact.
r.get('/:id', validate({ params: idParam }), ah(async (req, res) => {
  const ownerId = req.auth!.userId;
  const c = await Contact.findOne({ _id: req.params.id, ownerId }).lean();
  if (!c) throw notFound('Contact not found');
  const rows: any[] = await Transaction.aggregate([
    { $match: { ownerId: new Types.ObjectId(ownerId), contactId: c._id, status: 'completed' } },
    { $group: { _id: { cur: '$currency', t: '$type' }, sum: { $sum: '$amountMinor' }, count: { $sum: 1 }, last: { $max: '$occurredAt' } } },
  ]);
  const byCur: Record<string, { incomeMinor: number; expenseMinor: number; count: number }> = {};
  let lastActivityAt: Date | null = null;
  for (const x of rows) {
    const e = (byCur[x._id.cur] ??= { incomeMinor: 0, expenseMinor: 0, count: 0 });
    x._id.t === 'income' ? (e.incomeMinor += x.sum) : (e.expenseMinor += x.sum); e.count += x.count;
    if (!lastActivityAt || x.last > lastActivityAt) lastActivityAt = x.last;
  }
  res.json({ data: { contact: view(c), stats: { byCurrency: byCur, lastActivityAt } } });
}));

r.patch('/:id', validate({ params: idParam, body: z.object({
  name: fields.name, email: fields.email.nullable(), phone: fields.phone.nullable(), notes: fields.notes.nullable(), archived: z.boolean(),
}).partial().strict() }), ah(async (req, res) => {
  const { archived, ...rest } = req.body; const $set: Record<string, unknown> = {}; const $unset: Record<string, 1> = {};
  for (const [k, v] of Object.entries(rest)) v === null ? ($unset[k] = 1) : ($set[k] = v);
  if (archived !== undefined) $set.archivedAt = archived ? new Date() : null;
  const c = await Contact.findOneAndUpdate({ _id: req.params.id, ownerId: req.auth!.userId },
    { ...(Object.keys($set).length && { $set }), ...(Object.keys($unset).length && { $unset }) }, { new: true }).lean();
  if (!c) throw notFound('Contact not found');
  await logActivity(req.auth!.userId, archived === undefined ? 'contact.update' : archived ? 'contact.archive' : 'contact.restore', req, { entityType: 'contact', entityId: req.params.id });
  res.json({ data: { contact: view(c) } });
}));

export default r;
