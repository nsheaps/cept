import { test, expect } from '@playwright/test';

/**
 * On mobile viewports the sidebar opens by default with a fixed backdrop
 * (z-index 40) that covers the landing page buttons. The sidebar itself
 * (z-index 50) also covers the header toggle button, so we close by
 * clicking the backdrop (visible to the right of the 260px sidebar).
 */
async function closeSidebarOnMobile(page: import('@playwright/test').Page) {
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 768) {
    const backdrop = page.getByTestId('sidebar-backdrop');
    if (await backdrop.isVisible()) {
      await backdrop.click({ position: { x: viewport.width - 20, y: viewport.height / 2 } });
      await page.waitForTimeout(200);
    }
  }
}

test.describe('Smoke Tests', () => {
  test('application loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Cept/);
  });

  test('onboarding screen shows landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await closeSidebarOnMobile(page);
    await expect(page.getByTestId('start-writing')).toBeVisible();
    await expect(page.getByTestId('try-demo')).toBeVisible();
    await expect(page.getByTestId('storage-options')).toBeVisible();
  });

  test('try demo enters demo mode with editor', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await closeSidebarOnMobile(page);
    await page.getByTestId('try-demo').click();
    await expect(page.getByTestId('landing-page')).not.toBeVisible({ timeout: 10000 });
    await closeSidebarOnMobile(page);
    await expect(page.locator('.cept-editor')).toBeVisible({ timeout: 10000 });
  });

  test('start writing creates a new page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await closeSidebarOnMobile(page);
    await page.getByTestId('start-writing').click();
    await expect(page.getByTestId('landing-page')).not.toBeVisible({ timeout: 10000 });
    await closeSidebarOnMobile(page);
    await expect(page.locator('.cept-editor')).toBeVisible({ timeout: 10000 });
  });
});
