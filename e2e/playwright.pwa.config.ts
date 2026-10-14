import { defineConfig, devices } from '@playwright/test';

/**
 * Checks against the BUILT bundle served at the production base path
 * (`/cept/app/`), not the dev server: the manifest and icons only break
 * under a base path, and only the build rewrites their URLs.
 */
const PORT = 4173;

export default defineConfig({
  testDir: './pwa',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list']] : [['html', { open: 'never' }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'on-first-retry' },
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        // Lets a sandbox with a different Chromium layout point at its own binary.
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: `export VITE_BASE_PATH=/cept/app/ && bun run --cwd ../packages/web build && bun run --cwd ../packages/web preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/cept/app/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
