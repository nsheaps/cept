import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';

const isCI = !!process.env.CI;
const ciWorkers = Math.max(1, os.cpus().length - 2);

/**
 * In CI we only install Chromium (`bunx playwright install --with-deps chromium`),
 * so we restrict the project list to Chromium-based browsers.
 * Locally all five projects run so developers can test cross-browser.
 */
const ciProjects = [
  { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
  { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
];

const allProjects = [
  ...ciProjects,
  { name: 'Desktop Firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
  { name: 'Tablet', use: { ...devices['iPad (gen 7)'] } },
];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? ciWorkers : undefined,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: isCI ? ciProjects : allProjects,
  webServer: {
    command: 'bun run --cwd ../packages/web dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !isCI,
    timeout: 30000,
  },
});
