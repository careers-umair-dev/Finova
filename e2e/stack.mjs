// Starts everything the e2e tests need: MongoDB (in-memory replica set), the API, and the Vite dev server.
import { spawn } from 'node:child_process';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const rs = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const apiEnv = {
  ...process.env, NODE_ENV: 'test', // 'test' disables rate limiting (many users register from one IP) and uses non-Secure cookies
  PORT: '4000', MONGODB_URI: rs.getUri(), CLIENT_URL: 'http://localhost:5173', UPLOAD_DIR: '.e2e-uploads',
  JWT_ACCESS_SECRET: 'e2e-access-secret-e2e-access-secret-0000', JWT_REFRESH_SECRET: 'e2e-refresh-secret-e2e-refresh-secret-000',
};
const sh = process.platform === 'win32';
const api = spawn('npx', ['tsx', 'src/server.ts'], { cwd: 'apps/api', env: apiEnv, stdio: 'inherit', shell: sh });

for (let i = 0; ; i++) { // wait until the API answers before exposing the web port Playwright polls
  try { if ((await fetch('http://localhost:4000/health/ready')).ok) break; } catch { /* not up yet */ }
  if (i > 120) { console.error('API did not become ready in 60s'); await shutdown(1); }
  await new Promise((r) => setTimeout(r, 500));
}
const web = spawn('npx', ['vite', '--host', 'localhost', '--port', '5173', '--strictPort'], { cwd: 'apps/web', env: { ...process.env, NODE_ENV: 'development' }, stdio: 'inherit', shell: sh });

async function shutdown(code = 0) { api.kill(); web?.kill(); await rs.stop(); process.exit(code); }
process.on('SIGINT', () => shutdown()); process.on('SIGTERM', () => shutdown());
api.on('exit', (c) => { if (c) { console.error('API exited', c); shutdown(1); } });
