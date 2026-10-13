// Runs before any test file imports the app, so src/config/env.ts validates successfully.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://placeholder/unused';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret-0000';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret-000';
process.env.CLIENT_URL = 'http://localhost:5173';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.UPLOAD_DIR = join(tmpdir(), `finova-test-uploads-${process.pid}`);
