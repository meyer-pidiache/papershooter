import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/support/setup.ts'],
    include: ['tests/unit/**/*.test.{js,ts}', 'tests/integration/**/*.test.{js,ts}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,ts}', 'server/**/*.ts', 'api/**/*.ts'],
      exclude: ['**/*.d.ts'],
      reporter: ['text', 'json-summary', 'lcov', 'html'],
      thresholds: { statements: 80, lines: 80, functions: 80, branches: 70 },
    },
  },
});
