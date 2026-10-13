import { createHash, createHmac, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const ACCESS_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const randomToken = (bytes = 48) => randomBytes(bytes).toString('base64url');
/** Refresh tokens are opaque; only an HMAC of them is stored, so a DB leak can't be replayed. */
export const hashRefresh = (t: string) => createHmac('sha256', env.JWT_REFRESH_SECRET).update(t).digest('hex');
export const hashOneTime = (t: string) => createHash('sha256').update(t).digest('hex');

export const signAccess = (userId: string, sessionId: string) =>
  jwt.sign({ sid: sessionId }, env.JWT_ACCESS_SECRET, { subject: userId, expiresIn: Math.floor(ACCESS_TTL_MS / 1000), algorithm: 'HS256' });
export const verifyAccess = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
