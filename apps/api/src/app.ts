import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { noSqlGuard } from './middleware/security.js';
import api from './routes/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
      const given = req.headers['x-request-id'];
      const id = typeof given === 'string' && /^[\w-]{8,64}$/.test(given) ? given : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
  }));
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true, allowedHeaders: ['Content-Type', 'X-Requested-With', 'Idempotency-Key'], methods: ['GET', 'POST', 'PATCH', 'DELETE'] }));

  app.get('/health', (_req, res) => void res.json({ status: 'ok' }));
  app.get('/health/ready', (_req, res) => {
    const up = mongoose.connection.readyState === 1;
    res.status(up ? 200 : 503).json({ status: up ? 'ready' : 'db_unavailable' });
  });

  app.get('/openapi.yaml', async (_req, res) => {
    res.type('text/yaml').send(await readFile(path.resolve(process.cwd(), 'openapi.yaml'), 'utf8'));
  });

  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => env.NODE_ENV === 'test' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(noSqlGuard);
  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
