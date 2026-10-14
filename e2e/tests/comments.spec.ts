import { test, expect, type Page } from '@playwright/test';
import { captureScreenshot } from './screenshot-utils.js';

async function openDemoEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('landing-page')).toBeVisible();
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 768) {
    const backdrop = page.getByTestId('sidebar-backdrop');
    if (await backdrop.isVisible()) {
      await backdrop.click({ position: { x: viewport.width - 20, y: viewport.height / 2 } });
    }
  }
  await page.getByTestId('try-demo').click();
  await expect(page.getByTestId('landing-page')).not.toBeVisible({ timeout: 10000 });
  await expect(page.locator('.cept-editor')).toBeVisible({ timeout: 10000 });
}

test.describe('Comments', () => {
  test('comment on a selection, asked for a name, and see it highlighted', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'the bubble menu needs a mouse selection');
    await openDemoEditor(page);

    const paragraph = page.locator('.cept-editor-content p').first();
    await paragraph.click({ clickCount: 3 });
    await page.getByTestId('toolbar-comment').click();

    const composer = page.getByTestId('comment-composer');
    await expect(composer).toBeVisible();
    await expect(page.getByTestId('comment-name')).toBeVisible();
    await expect(page.getByTestId('comment-submit')).toBeDisabled();

    await page.getByTestId('comment-name').fill('Nate');
    await page.getByTestId('comment-body').fill('Is this the wording we want?');
    await captureScreenshot(page, {
      name: 'comment-composer',
      category: 'features',
      selector: '[data-testid="comment-composer"]',
    });
    await page.getByTestId('comment-submit').click();

    await expect(composer).not.toBeVisible();
    await expect(
      page.locator('.cept-editor-content .cept-comment-highlight').first(),
    ).toBeVisible();
    // Collapse the selection so it does not cover the highlight.
    await page.keyboard.press('ArrowRight');
    await captureScreenshot(page, {
      name: 'comment-highlight',
      category: 'features',
      selector: '.cept-editor-content > :first-child',
    });

    // The name is remembered: the next comment does not ask again.
    await page.getByTestId('comment-on-page').click();
    await expect(page.getByTestId('comment-name')).toHaveCount(0);
  });

  test('the keyboard shortcut opens the composer', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'no hardware keyboard');
    await openDemoEditor(page);
    await page.locator('.cept-editor-content p').first().click({ clickCount: 3 });
    await page.keyboard.press('Control+Alt+KeyM');
    await expect(page.getByTestId('comment-composer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('comment-composer')).not.toBeVisible();
  });
});
