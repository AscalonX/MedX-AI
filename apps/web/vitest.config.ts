import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/pipeline/__tests__/**/*.test.ts', 'components/**/*.test.ts', 'app/**/*.test.ts'],
    // The pipeline/API suites replay seeds and synchronously persist audit events.
    // Keep worker RPC traffic in one process and allow those replays time under load.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    restoreMocks: true,
  },
});
