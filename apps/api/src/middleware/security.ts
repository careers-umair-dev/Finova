import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';

/** Rejects `$operator` / dotted keys anywhere in body, query or params (NoSQL-injection guard). */
const bad = (v: unknown): boolean => {
  if (Array.isArray(v)) return v.some(bad);
  if (v && typeof v === 'object') return Object.entries(v).some(([k, x]) => k.startsWith('$') || k.includes('.') || bad(x));
  return false;
};
export const noSqlGuard = (req: Request, _res: Response, next: NextFunction) =>
  bad(req.body) || bad(req.query) || bad(req.params)
    ? next(new AppError(400, 'BAD_INPUT', 'Request contains invalid keys'))
    : next();

/** Cookie auth + CORS: state-changing calls must carry a custom header a cross-site form cannot send. */
export const csrfGuard = (req: Request, _res: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'finova') return next(new AppError(403, 'CSRF', 'Missing required request header'));
  next();
};
