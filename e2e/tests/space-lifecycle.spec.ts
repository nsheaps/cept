import { test, expect } from '@playwright/test';

/**
 * REQ-WS-024: create a space, rename it (which edits its space.cept.yaml) and
 * delete it, confirming first.
 */
test.describe('Space lifecycle', () => {
  test('creates, renames and deletes a space', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('start-writing').click();
    await expect(page.getByTestId('landing-page')).not.toBeVisible({ timeout: 10000 });

    const openSpaces = async () => {
      // On a narrow screen the sidebar starts closed.
      const menu = page.getByTestId('sidebar-app-menu-trigger');
      if (!(await menu.isVisible())) await page.getByTestId('sidebar-toggle').click();
      await menu.click();
      await page.getByTestId('sidebar-app-menu-settings').click();
      await page.getByTestId('settings-tab-spaces').click();
    };

    // Create
    await openSpaces();
    await page.getByTestId('create-space-btn').click();
    await page.getByTestId('wizard-choose-local').click();
    await page.getByTestId('wizard-space-name-input').fill('Work');
    await page.getByTestId('wizard-create-confirm').click();
    await expect(page.getByTestId('add-space-wizard-modal')).not.toBeVisible();

    // Rename: the name and the slug shown in its details
    await openSpaces();
    const work = page.locator('[data-testid^="space-item-space-"]');
    await expect(work).toContainText('Work');
    const id = (await work.getAttribute('data-testid'))!.replace('space-item-', '');
    await page.getByTestId(`space-settings-${id}`).click();
    await expect(page.getByTestId('space-detail-slug')).toHaveText('work');
    await page.getByTestId('space-details-name').click();
    await page.getByTestId('space-rename-input').fill('Office');
    await page.getByTestId('space-rename-save').click();
    await expect(page.getByTestId('space-details-name')).toContainText('Office');
    await page.getByTestId('space-detail-slug').click();
    await page.getByTestId('space-slug-input').fill('office');
    await expect(page.getByTestId('space-slug-warning')).toBeVisible();
    await page.getByTestId('space-slug-save').click();
    await expect(page.getByTestId('space-detail-slug')).toHaveText('office');

    // Delete, after confirming
    await page.getByTestId('space-details-delete').click();
    await expect(page.getByTestId('space-remove-title')).toHaveText('Delete "Office"?');
    await page.getByTestId('space-remove-confirm-btn').click();
    await expect(page.getByTestId(`space-item-${id}`)).toHaveCount(0);
    await expect(page.getByTestId('space-item-default')).toBeVisible();
  });
});
