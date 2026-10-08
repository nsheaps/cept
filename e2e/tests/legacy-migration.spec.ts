import { test, expect } from '@playwright/test';

/**
 * REQ-WS-025: a space saved in the old flat layout opens converted to files
 * and folders, with the same pages, and stays that way after a reload.
 */
test.describe('Legacy flat space conversion', () => {
  test('a legacy space shows the same pages after conversion and after a reload', async ({
    page,
  }) => {
    // The oldest saved form: the whole workspace in localStorage. Seed it once
    // per tab, so the reload reads what the app saved.
    await page.addInitScript(() => {
      if (sessionStorage.getItem('legacy-seeded')) return;
      sessionStorage.setItem('legacy-seeded', '1');
      localStorage.setItem(
        'cept-workspace',
        JSON.stringify({
          pages: [
            {
              id: 'page-1',
              title: 'Travel',
              isExpanded: true,
              children: [{ id: 'page-2', title: 'Packing list', children: [] }],
            },
          ],
          pageContents: {
            'page-1': '<p>Trips I want to take</p>',
            'page-2': '<p>Passport and charger</p>',
          },
          favorites: [],
          recentPages: [],
          selectedPageId: 'page-2',
          spaceName: 'Legacy',
        }),
      );
    });

    const editor = page.locator('.cept-editor');
    const breadcrumbs = page.getByTestId('breadcrumbs');

    await page.goto('/');
    await expect(page.getByText(/now keeps its pages as files and folders/)).toBeVisible({
      timeout: 10000,
    });
    await expect(editor).toContainText('Passport and charger', { timeout: 10000 });
    await expect(breadcrumbs).toContainText('Travel');
    await expect(breadcrumbs).toContainText('Packing list');

    // The browser file system writes its file table to IndexedDB shortly after
    // the last change, so give it that moment before reloading.
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(editor).toContainText('Passport and charger', { timeout: 10000 });
    await expect(breadcrumbs).toContainText('Travel');
    await expect(breadcrumbs).toContainText('Packing list');
    // Converted once: the reload does not convert again.
    await expect(page.getByText(/now keeps its pages as files and folders/)).toHaveCount(0);
  });
});
