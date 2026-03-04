import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('application loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Cept/);
  });

  test('onboarding screen shows backend options', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Get Started')).toBeVisible();
    await expect(page.getByText('Start writing')).toBeVisible();
    await expect(page.getByText('Open a folder')).toBeVisible();
    await expect(page.getByText('Connect a Git repo')).toBeVisible();
  });
});
