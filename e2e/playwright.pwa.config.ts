import { defineConfig, devices } from '@playwright/test';

/**
 * Checks against the BUILT bundle served at the production base path
 * (`/cept/app/`), not the dev server. The build is done by `test:pwa` before
 * Playwright starts, so the web server timeout only covers `vite preview`: the manifest and icons only break
 * under a base path, and only the build rewrites their URLs.
 */
const PORT = 4173;

export default defineConfig({
  testDir: './pwa',
  forbidOnly: !!process.env.CI,
  // Own report and output folders, so this run neither overwrites the dev-server
  // run's traces nor leaves CI without artifacts when a PWA spec fails.
  outputDir: './test-results-pwa',
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-pwa' }]]
    : [['html', { open: 'never', outputFolder: 'playwright-report-pwa' }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'on-first-retry' },
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        // Lets a sandbox with a different Chromium layout point at its own binary.
        ...(process.env.PW_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
  webServer: {
    command: `VITE_BASE_PATH=/cept/app/ bun run --cwd ../packages/web preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/cept/app/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
