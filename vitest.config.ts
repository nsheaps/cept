import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@cept/core': path.resolve(__dirname, 'packages/core/src'),
      '@cept/ui': path.resolve(__dirname, 'packages/ui/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/index.ts'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: [
            'packages/*/src/**/*.{test,spec}.{ts,tsx}',
          ],
          exclude: ['node_modules', 'dist', 'e2e'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: [
            'features/step-definitions/**/*.steps.ts',
          ],
          exclude: ['node_modules', 'dist', 'e2e'],
        },
      },
    ],
  },
});
