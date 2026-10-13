import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false, // one shared in-memory database; every test registers its own unique user
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'node e2e/stack.mjs', // in-memory MongoDB replica set + API + Vite, torn down on exit
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000, // first run downloads a mongod binary
    stdout: 'pipe',
  },
});
