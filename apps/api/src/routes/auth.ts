import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { clearAuthCookies, setAuthCookies } from '../lib/cookies.js';
import { env } from '../config/env.js';
import { validate } from '../middleware/validate.js';
import { logActivity } from '../services/activity.js';
import * as auth from '../services/auth.js';

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(10, 'Use at least 10 characters').max(72); // 72 = bcrypt byte limit
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => env.NODE_ENV === 'test',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a few minutes.' } } });

const r = Router();

r.post('/register', limiter, validate({ body: z.object({ name: z.string().trim().min(1).max(80), email, password }).strict() }),
  ah(async (req, res) => {
    const { user, access, refresh } = await auth.register(req.body, req);
    await logActivity(user._id, 'auth.register', req);
    setAuthCookies(res, access, refresh);
    res.status(201).json({ data: { user: auth.publicUser(user) } });
  }));

r.post('/login', limiter, validate({ body: z.object({ email, password: z.string().min(1).max(72) }).strict() }),
  ah(async (req, res) => {
    const { user, access, refresh } = await auth.login(req.body.email, req.body.password, req);
    await logActivity(user._id, 'auth.login', req);
    setAuthCookies(res, access, refresh);
    res.json({ data: { user: auth.publicUser(user) } });
  }));

r.post('/refresh', ah(async (req, res) => {
  const { access, refresh } = await auth.rotate(req.cookies?.fv_rt);
  setAuthCookies(res, access, refresh);
  res.json({ data: { ok: true } });
}));

r.post('/logout', ah(async (req, res) => {
  await auth.revokeByRefresh(req.cookies?.fv_rt);
  clearAuthCookies(res);
  res.json({ data: { ok: true } });
}));

r.post('/forgot-password', limiter, validate({ body: z.object({ email }).strict() }),
  ah(async (req, res) => {
    await auth.requestPasswordReset(req.body.email);
    res.status(202).json({ data: { message: 'If that email has an account, a reset link is on its way.' } });
  }));

r.post('/reset-password', limiter, validate({ body: z.object({ token: z.string().min(20).max(200), password }).strict() }),
  ah(async (req, res) => {
    const user = await auth.resetPassword(req.body.token, req.body.password);
    await logActivity(user._id, 'auth.password_reset', req);
    res.json({ data: { ok: true } });
  }));

r.post('/verify-email', validate({ body: z.object({ token: z.string().min(20).max(200) }).strict() }),
  ah(async (req, res) => {
    const user = await auth.verifyEmail(req.body.token);
    await logActivity(user._id, 'auth.email_verified', req);
    res.json({ data: { ok: true } });
  }));

export default r;
