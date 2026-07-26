import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,mts,tsx}'],
    exclude: ['node_modules', '.next', 'tests/**/*.test.mjs'],
    setupFiles: [],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['lib/templates/**', 'lib/norms/**', 'lib/jurisprudencia/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
