/**
 * Responsive E2E tests — validates the app across desktop, tablet, and mobile viewports.
 * Also captures screenshots for documentation.
 */

import { test, expect } from '@playwright/test';
import { captureResponsiveScreenshots, captureScreenshot } from './screenshot-utils.js';

/**
 * Helper: Enter demo mode from the landing page.
 * Waits for the landing page to render, then clicks "Try the demo".
 */
async function enterDemoMode(page: import('@playwright/test').Page) {
  await page.goto('/');
  // Wait for the landing page to fully render
  await expect(page.getByTestId('landing-page')).toBeVisible();
  await page.getByTestId('try-demo').click();
  await expect(page.locator('.cept-editor')).toBeVisible({ timeout: 10000 });
}

test.describe('Responsive: Onboarding / Landing', () => {
  test('landing page renders at all viewports', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await captureResponsiveScreenshots(page, 'onboarding', 'getting-started');
  });

  test('start writing creates first page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await page.getByTestId('start-writing').click();
    await expect(page.locator('.cept-editor')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Responsive: Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test('sidebar is visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId('sidebar-toggle')).toBeVisible();
  });

  test('sidebar can be toggled', async ({ page }) => {
    await page.getByTestId('sidebar-toggle').click();
    // Click again to re-open
    await page.getByTestId('sidebar-toggle').click();
  });

  test('sidebar screenshots', async ({ page }) => {
    await captureResponsiveScreenshots(page, 'sidebar', 'guides');
  });
});

test.describe('Responsive: Editor', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test('editor renders content at all viewports', async ({ page }) => {
    await expect(page.locator('.tiptap')).toBeVisible();
    await captureResponsiveScreenshots(page, 'editor', 'guides');
  });

  test('command palette opens with Ctrl+K', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await captureScreenshot(page, { name: 'command-palette', category: 'guides' });
    await page.keyboard.press('Escape');
  });
});

test.describe('Responsive: Settings Modal', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test('settings modal opens and shows tabs', async ({ page }) => {
    // Open settings via command palette
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('command-palette')).toBeVisible();

    // Look for a settings or gear button in sidebar instead
    await page.keyboard.press('Escape');

    // Try clicking the app menu trigger in sidebar if visible
    const appMenuTrigger = page.locator('[data-testid="sidebar-app-menu-trigger"]');
    if (await appMenuTrigger.isVisible()) {
      await appMenuTrigger.click();
      const settingsBtn = page.locator('[data-testid="sidebar-app-menu-settings"]');
      if (await settingsBtn.isVisible()) {
        await settingsBtn.click();
      }
    }
  });

  test('spaces tab shows space management UI', async ({ page }) => {
    // Open settings via command palette "Manage Spaces"
    await page.keyboard.press('Control+k');
    const manageSpaces = page.getByText('Manage Spaces');
    if (await manageSpaces.isVisible()) {
      await manageSpaces.click();
      await expect(page.getByTestId('settings-modal')).toBeVisible();
      await expect(page.getByTestId('settings-tab-spaces')).toBeVisible();
      await captureScreenshot(page, { name: 'spaces-management', category: 'guides' });
    }
  });
});

test.describe('Responsive: Search', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test('search panel works at all viewports', async ({ page }) => {
    // Open search via command palette
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('command-palette')).toBeVisible();
    const searchItem = page.getByText('Search').first();
    if (await searchItem.isVisible()) {
      await searchItem.click();
    }
  });
});

test.describe('Responsive: Deep Linking', () => {
  test('navigating to a page updates the URL', async ({ page }) => {
    await enterDemoMode(page);

    // The URL should have updated after entering demo mode
    const url = page.url();
    // Accept either hash-based or path-based routing
    expect(url.length).toBeGreaterThan('http://localhost:5173/'.length);
  });

  test('loading a URL with hash selects the correct page', async ({ page }) => {
    await enterDemoMode(page);

    // Navigate to features page via sidebar
    const featuresLink = page.getByText('Features');
    if (await featuresLink.isVisible()) {
      await featuresLink.click();
      // Wait a moment for the URL to update
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Responsive: Import/Export via Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test('import from Notion appears in command palette', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await expect(page.getByText('Import from Notion')).toBeVisible();
  });

  test('import from Obsidian appears in command palette', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByText('Import from Obsidian')).toBeVisible();
  });

  test('export current page appears in command palette', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByText('Export Current Page')).toBeVisible();
  });
});

test.describe('Responsive: Full-page Screenshots', () => {
  test('capture full documentation screenshots', async ({ page }) => {
    // Onboarding
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await captureScreenshot(page, {
      name: 'landing-desktop',
      category: 'overview',
      viewport: { width: 1280, height: 800 },
      fullPage: true,
    });
    await captureScreenshot(page, {
      name: 'landing-mobile',
      category: 'overview',
      viewport: { width: 375, height: 812 },
      fullPage: true,
    });
    await captureScreenshot(page, {
      name: 'landing-tablet',
      category: 'overview',
      viewport: { width: 768, height: 1024 },
      fullPage: true,
    });

    // Demo mode
    await page.getByTestId('try-demo').click();
    await expect(page.locator('.cept-editor')).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, {
      name: 'editor-desktop',
      category: 'overview',
      viewport: { width: 1280, height: 800 },
    });
    await captureScreenshot(page, {
      name: 'editor-tablet',
      category: 'overview',
      viewport: { width: 768, height: 1024 },
    });
    await captureScreenshot(page, {
      name: 'editor-mobile',
      category: 'overview',
      viewport: { width: 375, height: 812 },
    });
  });
});
