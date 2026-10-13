import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['test/env.ts'],
    fileParallelism: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    testTimeout: 180000,
    hookTimeout: 180000,
  },
});
