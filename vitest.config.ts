import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.{js,ts}', 'tests/integration/**/*.test.{js,ts}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,ts}', 'server/**/*.ts', 'api/**/*.ts'],
      exclude: ['**/*.d.ts'],
      reporter: ['text', 'json-summary', 'lcov', 'html'],
    },
  },
});
