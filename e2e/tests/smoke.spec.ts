import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('application loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Cept/);
  });

  test('onboarding screen shows landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await expect(page.getByTestId('start-writing')).toBeVisible();
    await expect(page.getByTestId('try-demo')).toBeVisible();
    await expect(page.getByTestId('storage-options')).toBeVisible();
  });

  test('try demo enters demo mode with editor', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await page.getByTestId('try-demo').click();
    await expect(page.getByTestId('landing-page')).not.toBeVisible({ timeout: 10000 });
    // On narrow viewports, close the sidebar so the editor is uncovered
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      await page.getByTestId('sidebar-toggle').click();
      await page.waitForTimeout(200);
    }
    await expect(page.locator('.cept-editor')).toBeVisible({ timeout: 10000 });
  });

  test('start writing creates a new page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await page.getByTestId('start-writing').click();
    await expect(page.getByTestId('landing-page')).not.toBeVisible({ timeout: 10000 });
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      await page.getByTestId('sidebar-toggle').click();
      await page.waitForTimeout(200);
    }
    await expect(page.locator('.cept-editor')).toBeVisible({ timeout: 10000 });
  });
});
