import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';

const ciWorkers = Math.max(1, os.cpus().length - 2);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? ciWorkers : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bun run --cwd ../packages/web dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
