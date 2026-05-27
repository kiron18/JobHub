import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../src'),
    },
  },
});
