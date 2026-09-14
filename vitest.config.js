import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['js/modules/nutrition/__tests__/**/*.test.js'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['js/modules/nutrition/**/*.js'],
      exclude: ['js/modules/nutrition/__tests__/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
