import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Cast: vitest 2 bundles its own (older) vite types, which clash with this app's vite 6 plugin types and break `tsc` (and so the Vercel build).
  plugins: [react() as any],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // Same-origin in dev: the browser talks to :5173 and Vite forwards /api to the Express server,
  // so the httpOnly cookies work with COOKIE_SAMESITE=lax.
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000', '/openapi.yaml': 'http://localhost:4000' } },
  test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'] },
});
