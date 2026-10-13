import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { notFound } from '../lib/errors.js';
import { oidStr } from '../lib/zod.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Notification } from '../models/Notification.js';

const r = Router();
r.use(requireAuth);
const view = (n: any) => ({ id: String(n._id), type: n.type, title: n.title, body: n.body ?? null, read: Boolean(n.readAt), readAt: n.readAt ?? null, createdAt: n.createdAt });

r.get('/', validate({ query: z.object({
  unreadOnly: z.enum(['true', 'false']).default('false'),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict() }), ah(async (req, res) => {
  const q: any = req.query; const ownerId = req.auth!.userId;
  const filter = { ownerId, ...(q.unreadOnly === 'true' && { readAt: null }) };
  const [total, unreadCount, rows] = await Promise.all([
    Notification.countDocuments(filter), Notification.countDocuments({ ownerId, readAt: null }),
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
  ]);
  res.json({ data: { items: rows.map(view), unreadCount, total, page: q.page, limit: q.limit } });
}));

r.post('/read-all', ah(async (req, res) => {
  const out = await Notification.updateMany({ ownerId: req.auth!.userId, readAt: null }, { readAt: new Date() });
  res.json({ data: { updated: out.modifiedCount } });
}));

r.patch('/:id/read', validate({ params: z.object({ id: oidStr }) }), ah(async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, ownerId: req.auth!.userId });
  if (!n) throw notFound('Notification not found');
  if (!n.readAt) { n.readAt = new Date(); await n.save(); }
  res.json({ data: { notification: view(n) } });
}));

export default r;
