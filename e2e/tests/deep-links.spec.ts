import { test, expect } from '@playwright/test';

/**
 * D-42: a page's URL is its path in the space, so a link opens that page
 * directly, and a link to a page that does not exist shows a not-found page
 * that keeps the link in the address bar.
 */
test.describe('Deep links', () => {
  test('a link to a page opens that page', async ({ page }) => {
    await page.goto('/s/demo/features');
    await expect(page.getByTestId('breadcrumbs')).toContainText('Features', { timeout: 10000 });
    await expect(page.getByTestId('not-found')).toHaveCount(0);
    await expect(page).toHaveURL(/\/s\/demo\/features$/);
  });

  test('a link to a missing page shows the not-found page', async ({ page }) => {
    await page.goto('/s/demo/no-such-page.md');
    await expect(page.getByTestId('not-found')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('not-found-path')).toContainText('/s/demo/no-such-page.md');
    await expect(page).toHaveURL(/\/s\/demo\/no-such-page\.md$/);

    await page.getByTestId('not-found-home').click();
    await expect(page.getByTestId('not-found')).toHaveCount(0);
    await expect(page.locator('.cept-editor')).toBeVisible();
  });

  // GitHub Pages sends an unknown path to 404.html, which reloads the app with
  // the path in `?route=`; the app must restore it as if it had been opened.
  test('a link that comes through the 404 redirect opens its page, or not-found', async ({
    page,
  }) => {
    await page.goto('/?route=%2Fs%2Fdemo%2Ffeatures');
    await expect(page.getByTestId('breadcrumbs')).toContainText('Features', { timeout: 10000 });
    await expect(page).toHaveURL(/\/s\/demo\/features$/);

    await page.goto('/?route=%2Fs%2Fdemo%2Fno-such-page.md');
    await expect(page.getByTestId('not-found')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('not-found-path')).toHaveText('/s/demo/no-such-page.md');
    await expect(page).toHaveURL(/\/s\/demo\/no-such-page\.md$/);
  });
});
