import { Types } from 'mongoose';
import { ah } from '../lib/async.js';
import { AppError, unauthorized } from '../lib/errors.js';
import { verifyAccess } from '../lib/tokens.js';
import { Session } from '../models/Session.js';

/**
 * Identity comes ONLY from the signed cookie + a live session row — never from request bodies/params.
 * Checking the session on each call makes revocation take effect immediately.
 */
export const requireAuth = ah(async (req, _res, next) => {
  const token = req.cookies?.fv_at as string | undefined;
  if (!token) throw unauthorized();
  let payload;
  try { payload = verifyAccess(token); }
  catch { throw new AppError(401, 'TOKEN_EXPIRED', 'Access token expired or invalid'); }
  const sid = payload.sid as string | undefined;
  const sub = payload.sub;
  if (!sid || !sub || !Types.ObjectId.isValid(sid) || !Types.ObjectId.isValid(sub)) throw unauthorized();
  const live = await Session.exists({ _id: sid, userId: sub, revokedAt: null, expiresAt: { $gt: new Date() } });
  if (!live) throw unauthorized('Session revoked');
  req.auth = { userId: sub, sessionId: sid };
  next();
});
