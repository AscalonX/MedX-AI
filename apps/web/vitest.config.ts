import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['lib/pipeline/__tests__/**/*.test.ts'], fileParallelism: false, restoreMocks: true } });
