import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

await mongoose.connect(env.MONGODB_URI);
if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'local')
  logger.warn('STORAGE_DRIVER=local in production: uploaded documents are lost unless UPLOAD_DIR is a persistent volume.');
const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT }, 'Finova API listening'));

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref(); // force-exit if connections hang
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
