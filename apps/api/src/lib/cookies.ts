import type { Response } from 'express';
import { env } from '../config/env.js';
import { ACCESS_TTL_MS, REFRESH_TTL_MS } from './tokens.js';

const base = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production' || env.COOKIE_SAMESITE === 'none',
  sameSite: env.COOKIE_SAMESITE,
} as const;
const REFRESH_PATH = '/api/v1/auth';

export function setAuthCookies(res: Response, access: string, refresh: string) {
  res.cookie('fv_at', access, { ...base, path: '/', maxAge: ACCESS_TTL_MS });
  res.cookie('fv_rt', refresh, { ...base, path: REFRESH_PATH, maxAge: REFRESH_TTL_MS });
}
export function clearAuthCookies(res: Response) {
  res.clearCookie('fv_at', { ...base, path: '/' });
  res.clearCookie('fv_rt', { ...base, path: REFRESH_PATH });
}
