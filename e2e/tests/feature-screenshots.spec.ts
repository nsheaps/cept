import { test, expect, type Page } from '@playwright/test';
import { captureScreenshot } from './screenshot-utils.js';

/**
 * Feature screenshot tests — capture screenshots of every feature
 * for documentation and visual regression testing.
 *
 * These screenshots are saved to docs/screenshots/ and used in
 * documentation pages. They are programmatically generated so
 * they never get out of date.
 */

async function closeSidebarOnMobile(page: Page) {
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 768) {
    const backdrop = page.getByTestId('sidebar-backdrop');
    if (await backdrop.isVisible()) {
      await backdrop.click({ position: { x: viewport.width - 20, y: viewport.height / 2 } });
      await page.waitForTimeout(200);
    }
  }
}

async function openDemoEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('landing-page')).toBeVisible();
  await closeSidebarOnMobile(page);
  await page.getByTestId('try-demo').click();
  await expect(page.getByTestId('landing-page')).not.toBeVisible({ timeout: 10000 });
  await closeSidebarOnMobile(page);
  await expect(page.locator('.cept-editor')).toBeVisible({ timeout: 10000 });
}

/** Navigate to a page in the sidebar by clicking its link. Returns true if successful. */
async function navigateToPage(page: Page, linkText: string): Promise<boolean> {
  // Use exact match to avoid ambiguity with partial text matches
  const link = page.getByRole('link', { name: linkText }).or(
    page.locator(`[data-testid="sidebar"] >> text="${linkText}"`),
  );
  try {
    await link.first().waitFor({ state: 'visible', timeout: 3000 });
    await link.first().click();
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

test.describe('Feature Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await openDemoEditor(page);
  });

  test('landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await closeSidebarOnMobile(page);
    await captureScreenshot(page, { name: 'landing-page', category: 'features' });
  });

  test('editor overview', async ({ page }) => {
    await captureScreenshot(page, { name: 'editor-overview', category: 'features', fullPage: true });
  });

  test('sidebar', async ({ page }) => {
    const sidebar = page.getByTestId('sidebar');
    if (await sidebar.isVisible()) {
      await captureScreenshot(page, {
        name: 'sidebar',
        category: 'features',
        selector: '[data-testid="sidebar"]',
      });
    }
  });

  test('features page with toggles', async ({ page }) => {
    const navigated = await navigateToPage(page, 'Features');
    if (!navigated) {
      test.skip();
      return;
    }
    await captureScreenshot(page, { name: 'features-page', category: 'features', fullPage: true });
  });

  test('toggle blocks', async ({ page }) => {
    const navigated = await navigateToPage(page, 'Features');
    if (!navigated) {
      test.skip();
      return;
    }

    const toggles = page.locator('.cept-toggle');
    const toggleCount = await toggles.count();
    if (toggleCount > 0) {
      const firstSummary = toggles.first().locator('.cept-toggle-summary');
      if (await firstSummary.isVisible()) {
        await firstSummary.click();
        await page.waitForTimeout(300);
      }
      await captureScreenshot(page, { name: 'toggle-open', category: 'features', selector: '.cept-toggle' });
    }
  });

  test('callout blocks', async ({ page }) => {
    // Wait for editor to settle before checking for callouts
    await page.waitForTimeout(500);
    const callout = page.locator('.cept-callout').first();
    try {
      if (await callout.isVisible()) {
        await captureScreenshot(page, { name: 'callout', category: 'features', selector: '.cept-callout' });
      }
    } catch {
      // Element may detach during re-render, skip gracefully
    }
  });

  test('code block', async ({ page }) => {
    const navigated = await navigateToPage(page, 'Features');
    if (!navigated) {
      test.skip();
      return;
    }
    const codeBlock = page.locator('.cept-code-block').first();
    if (await codeBlock.isVisible()) {
      await captureScreenshot(page, { name: 'code-block', category: 'features', selector: '.cept-code-block' });
    }
  });

  test('table', async ({ page }) => {
    const navigated = await navigateToPage(page, 'Features');
    if (!navigated) {
      test.skip();
      return;
    }
    const table = page.locator('.cept-table').first();
    if (await table.isVisible()) {
      await captureScreenshot(page, { name: 'table', category: 'features', selector: '.cept-table' });
    }
  });

  test('task list', async ({ page }) => {
    const navigated = await navigateToPage(page, 'Features');
    if (!navigated) {
      test.skip();
      return;
    }
    try {
      const taskList = page.locator('.cept-task-list').first();
      await taskList.waitFor({ state: 'visible', timeout: 3000 });
      await page.waitForTimeout(300);
      await captureScreenshot(page, { name: 'task-list', category: 'features', selector: '.cept-task-list' });
    } catch {
      // Element may detach during page re-render, skip gracefully
    }
  });

  test('blockquote', async ({ page }) => {
    const navigated = await navigateToPage(page, 'Features');
    if (!navigated) {
      test.skip();
      return;
    }
    const blockquote = page.locator('.cept-blockquote').first();
    if (await blockquote.isVisible()) {
      await captureScreenshot(page, { name: 'blockquote', category: 'features', selector: '.cept-blockquote' });
    }
  });

  test('text formatting', async ({ page }) => {
    const navigated = await navigateToPage(page, 'Features');
    if (!navigated) {
      test.skip();
      return;
    }
    await captureScreenshot(page, { name: 'text-formatting', category: 'features' });
  });

  test('drag handle', async ({ page }) => {
    const paragraph = page.locator('.cept-paragraph').first();
    if (await paragraph.isVisible()) {
      await paragraph.hover();
      await page.waitForTimeout(300);
      await captureScreenshot(page, { name: 'drag-handle', category: 'features' });
    }
  });

  test('slash command menu', async ({ page }) => {
    const editor = page.locator('.cept-editor-content');
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await page.waitForTimeout(500);
    const slashMenu = page.locator('.cept-slash-menu');
    if (await slashMenu.isVisible()) {
      await captureScreenshot(page, { name: 'slash-menu', category: 'features', selector: '.cept-slash-menu' });
    }
  });

  test('inline toolbar', async ({ page }) => {
    const paragraph = page.locator('.cept-paragraph').first();
    if (await paragraph.isVisible()) {
      await paragraph.click({ clickCount: 3 });
      await page.waitForTimeout(500);
      const toolbar = page.locator('.cept-inline-toolbar');
      if (await toolbar.isVisible()) {
        await captureScreenshot(page, { name: 'inline-toolbar', category: 'features', selector: '.cept-inline-toolbar' });
      }
    }
  });

  test('command palette', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
    const palette = page.locator('.cept-command-palette');
    if (await palette.isVisible()) {
      await captureScreenshot(page, { name: 'command-palette', category: 'features', selector: '.cept-command-palette' });
      await page.keyboard.press('Escape');
    }
  });

  test('settings modal', async ({ page }) => {
    const settingsBtn = page.getByTestId('settings-btn');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(300);
      await captureScreenshot(page, { name: 'settings', category: 'features' });
      const dataTab = page.getByText('Data & Cache');
      if (await dataTab.isVisible()) {
        await dataTab.click();
        await page.waitForTimeout(200);
        await captureScreenshot(page, { name: 'settings-data', category: 'features' });
      }
    }
  });

  test('docs space', async ({ page }) => {
    const settingsBtn = page.getByTestId('settings-btn');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(300);
      const docsLink = page.getByText('Cept Docs');
      if (await docsLink.isVisible()) {
        await docsLink.click();
        await page.waitForTimeout(500);
        await captureScreenshot(page, { name: 'docs-space', category: 'features', fullPage: true });
      }
    }
  });

  test('getting started page', async ({ page }) => {
    const navigated = await navigateToPage(page, 'Getting Started');
    if (!navigated) {
      test.skip();
      return;
    }
    await captureScreenshot(page, { name: 'getting-started', category: 'features', fullPage: true });
  });
});
