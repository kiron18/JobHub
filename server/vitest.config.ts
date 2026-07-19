import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 10000,
    // Only run TypeScript source tests. The compiled dist/ copies are CommonJS
    // and can't import vitest — scanning them produced 61 phantom failures.
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../src'),
    },
  },
});
