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
    // On narrow viewports the sidebar may cover the editor, so check for
    // the editor OR the sidebar-toggle (which proves we left the landing page)
    await expect(
      page.locator('.cept-editor').or(page.getByTestId('sidebar-toggle')),
    ).first().toBeVisible({ timeout: 10000 });
  });

  test('start writing creates a new page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await page.getByTestId('start-writing').click();
    await expect(
      page.locator('.cept-editor').or(page.getByTestId('sidebar-toggle')),
    ).first().toBeVisible({ timeout: 10000 });
  });
});
