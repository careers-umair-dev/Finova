import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (_req, res) =>
  void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError)
    return void res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
  if (err instanceof AppError)
    return void res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  if (err?.type === 'entity.parse.failed')
    return void res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body' } });
  if (err?.type === 'entity.too.large')
    return void res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'File is too large (5 MB maximum)' } });
  if (err?.code === 11000)
    return void res.status(409).json({ error: { code: 'DUPLICATE', message: 'A record with these values already exists' } });
  req.log?.error({ err }, 'unhandled error'); // pino redacts cookies; message to client stays generic
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong', requestId: String(req.id ?? '') } });
};
