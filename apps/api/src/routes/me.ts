import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { CURRENCIES } from '../lib/money.js';
import { notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { UserPreferences } from '../models/UserPreferences.js';
import { logActivity } from '../services/activity.js';
import * as auth from '../services/auth.js';

const oid = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });
const r = Router();
r.use(requireAuth);

r.get('/', ah(async (req, res) => {
  const user = await User.findById(req.auth!.userId);
  if (!user) throw notFound();
  res.json({ data: { user: auth.publicUser(user) } });
}));

r.patch('/', validate({ body: z.object({ name: z.string().trim().min(1).max(80) }).strict() }), ah(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.auth!.userId, { name: req.body.name }, { new: true });
  if (!user) throw notFound();
  await logActivity(user._id, 'profile.update', req);
  res.json({ data: { user: auth.publicUser(user) } });
}));

r.post('/password', validate({ body: z.object({ currentPassword: z.string().max(72), newPassword: z.string().min(10).max(72) }).strict() }),
  ah(async (req, res) => {
    await auth.changePassword(req.auth!.userId, req.body.currentPassword, req.body.newPassword, req.auth!.sessionId);
    await logActivity(req.auth!.userId, 'auth.password_change', req);
    res.json({ data: { ok: true } });
  }));

r.get('/preferences', ah(async (req, res) => {
  const prefs = await UserPreferences.findOneAndUpdate({ ownerId: req.auth!.userId }, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json({ data: { preferences: prefs } });
}));

r.patch('/preferences', validate({ body: z.object({
  theme: z.enum(['light', 'system']), locale: z.string().max(10), currency: z.enum(CURRENCIES),
  notifications: z.object({ inApp: z.boolean(), email: z.boolean() }).partial(),
}).partial().strict() }), ah(async (req, res) => {
  const { notifications, ...rest } = req.body;
  const set: Record<string, unknown> = { ...rest };
  for (const [k, v] of Object.entries(notifications ?? {})) set[`notifications.${k}`] = v;
  const prefs = await UserPreferences.findOneAndUpdate({ ownerId: req.auth!.userId }, { $set: set }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json({ data: { preferences: prefs } });
}));

r.get('/sessions', ah(async (req, res) => {
  const rows = await Session.find({ userId: req.auth!.userId, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastUsedAt: -1 }).lean();
  res.json({ data: { sessions: rows.map((s) => ({ id: String(s._id), userAgent: s.userAgent, ip: s.ip, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt, current: String(s._id) === req.auth!.sessionId })) } });
}));

r.delete('/sessions/:id', validate({ params: oid }), ah(async (req, res) => {
  const hit = await Session.findOneAndUpdate({ _id: req.params.id, userId: req.auth!.userId, revokedAt: null }, { revokedAt: new Date() });
  if (!hit) throw notFound('Session not found'); // same answer whether it doesn't exist or belongs to someone else
  await logActivity(req.auth!.userId, 'session.revoke', req, { entityType: 'session', entityId: req.params.id });
  res.json({ data: { ok: true } });
}));

export default r;
