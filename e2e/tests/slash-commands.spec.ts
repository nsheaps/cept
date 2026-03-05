import { test, expect, type Page } from '@playwright/test';
import { captureScreenshot } from './screenshot-utils.js';

/**
 * On mobile viewports the sidebar opens by default with a fixed backdrop
 * (z-index 40) that covers the landing page buttons. Close it before interacting.
 */
async function closeSidebarOnMobile(page: Page) {
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 768) {
    const toggle = page.getByTestId('sidebar-toggle');
    if (await toggle.isVisible()) {
      await toggle.click();
      await page.waitForTimeout(200);
    }
  }
}

/**
 * Helper: Navigate to demo mode by clicking "Try the demo" on the landing page.
 * This is the most reliable way — it mirrors how a real user would enter demo mode.
 */
async function openDemoEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('landing-page')).toBeVisible();
  await closeSidebarOnMobile(page);
  await page.getByTestId('try-demo').click();
  await expect(page.getByTestId('landing-page')).not.toBeVisible({ timeout: 10000 });
  await closeSidebarOnMobile(page);
  await expect(page.locator('.cept-editor')).toBeVisible({ timeout: 10000 });
}

/**
 * Helper: Click into the editor, go to end, and type a slash command.
 * NOTE: Tiptap's Suggestion plugin does not allow spaces in queries,
 * so commandName must not contain spaces. Use description keywords
 * (e.g. "large" for Heading 1) to uniquely match commands.
 */
async function typeSlashCommand(page: Page, commandName: string) {
  const editor = page.locator('.cept-editor-content');
  await editor.click();
  // Move to end of document
  await page.keyboard.press('End');
  await page.keyboard.press('Control+End');
  // Add new line and type slash
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  // Wait for slash command menu to appear
  await page.waitForTimeout(300);
  // Type command name to filter
  await page.keyboard.type(commandName);
  await page.waitForTimeout(200);
}

/**
 * Helper: Select the first slash command result.
 */
async function selectFirstCommand(page: Page) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
}

test.describe('Demo Mode', () => {
  test('loads demo content with all block types', async ({ page }) => {
    await openDemoEditor(page);
    // Welcome page should show a blockquote (the demo content uses > with emoji)
    await expect(page.locator('.cept-editor-content blockquote, .cept-editor-content .cept-blockquote, .cept-editor-content .cept-callout').first()).toBeVisible();
    await captureScreenshot(page, { name: 'demo-welcome', category: 'demo' });
  });

  test('features page shows all block type demos', async ({ page }) => {
    await openDemoEditor(page);
    // Open sidebar if closed (mobile)
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      await page.getByTestId('sidebar-toggle').click();
      await page.waitForTimeout(200);
    }
    // Navigate to Features page
    await page.getByTestId('page-tree-button-features').click();
    await page.waitForTimeout(500);

    // Check page header shows the features page title
    await expect(page.getByTestId('page-title')).toContainText('Features');
    await captureScreenshot(page, { name: 'demo-features-top', category: 'demo' });

    // Scroll to see more blocks
    const editor = page.locator('section.flex-1');
    await editor.evaluate((el) => el.scrollTo(0, el.scrollHeight / 2));
    await page.waitForTimeout(300);
    await captureScreenshot(page, { name: 'demo-features-middle', category: 'demo' });

    await editor.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(300);
    await captureScreenshot(page, { name: 'demo-features-bottom', category: 'demo' });
  });

  test('getting started page renders', async ({ page }) => {
    await openDemoEditor(page);
    // Open sidebar if closed (mobile)
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      await page.getByTestId('sidebar-toggle').click();
      await page.waitForTimeout(200);
    }
    await page.getByTestId('page-tree-button-getting-started').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('page-title')).toContainText('Getting Started');
    await captureScreenshot(page, { name: 'demo-getting-started', category: 'demo' });
  });
});

test.describe('Slash Commands', () => {
  test.beforeEach(async ({ page }) => {
    await openDemoEditor(page);
    // Open sidebar if closed (mobile)
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      await page.getByTestId('sidebar-toggle').click();
      await page.waitForTimeout(200);
    }
    // Navigate to Notes page (empty) for testing
    await page.getByTestId('page-tree-button-notes').click();
    await page.waitForTimeout(500);
    // Close sidebar on mobile after navigation
    if (viewport && viewport.width < 768) {
      await page.getByTestId('sidebar-toggle').click();
      await page.waitForTimeout(200);
    }
  });

  test('slash menu appears when typing /', async ({ page }) => {
    const editor = page.locator('.cept-editor-content');
    await editor.click();
    await page.keyboard.type('/');
    await page.waitForTimeout(300);
    // The tippy popup should appear with slash command items
    await expect(page.locator('.tippy-content').or(page.locator('[role="listbox"]')).first()).toBeVisible();
    await captureScreenshot(page, { name: 'slash-menu-open', category: 'slash-commands' });
  });

  test('heading 1', async ({ page }) => {
    // "large" uniquely matches Heading 1 via description "Large heading"
    await typeSlashCommand(page, 'large');
    await selectFirstCommand(page);
    await page.keyboard.type('This is Heading 1');
    await expect(page.locator('.cept-editor-content h1')).toContainText('This is Heading 1');
    await captureScreenshot(page, { name: 'slash-heading1', category: 'slash-commands' });
  });

  test('heading 2', async ({ page }) => {
    // "medium" uniquely matches Heading 2 via description "Medium heading"
    await typeSlashCommand(page, 'medium');
    await selectFirstCommand(page);
    await page.keyboard.type('This is Heading 2');
    await expect(page.locator('.cept-editor-content h2')).toContainText('This is Heading 2');
    await captureScreenshot(page, { name: 'slash-heading2', category: 'slash-commands' });
  });

  test('heading 3', async ({ page }) => {
    // "small" uniquely matches Heading 3 via description "Small heading"
    await typeSlashCommand(page, 'small');
    await selectFirstCommand(page);
    await page.keyboard.type('This is Heading 3');
    await expect(page.locator('.cept-editor-content h3')).toContainText('This is Heading 3');
    await captureScreenshot(page, { name: 'slash-heading3', category: 'slash-commands' });
  });

  test('bullet list', async ({ page }) => {
    await typeSlashCommand(page, 'bullet');
    await selectFirstCommand(page);
    await page.keyboard.type('First bullet item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second bullet item');
    await expect(page.locator('.cept-editor-content .cept-bullet-list')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-bullet-list', category: 'slash-commands' });
  });

  test('numbered list', async ({ page }) => {
    await typeSlashCommand(page, 'numbered');
    await selectFirstCommand(page);
    await page.keyboard.type('First numbered item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second numbered item');
    await expect(page.locator('.cept-editor-content .cept-ordered-list')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-numbered-list', category: 'slash-commands' });
  });

  test('task list', async ({ page }) => {
    await typeSlashCommand(page, 'task');
    await selectFirstCommand(page);
    await page.keyboard.type('A task to complete');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Another task');
    await expect(page.locator('.cept-editor-content .cept-task-list')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-task-list', category: 'slash-commands' });
  });

  test('code block', async ({ page }) => {
    await typeSlashCommand(page, 'code');
    await selectFirstCommand(page);
    await page.keyboard.type('const hello = "world";');
    await expect(page.locator('.cept-editor-content .cept-code-block')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-code-block', category: 'slash-commands' });
  });

  test('blockquote', async ({ page }) => {
    await typeSlashCommand(page, 'blockquote');
    await selectFirstCommand(page);
    await page.keyboard.type('A wise quote goes here.');
    await expect(page.locator('.cept-editor-content .cept-blockquote')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-blockquote', category: 'slash-commands' });
  });

  test('divider', async ({ page }) => {
    // First add some text so divider is visible
    const editor = page.locator('.cept-editor-content');
    await editor.click();
    await page.keyboard.type('Text before divider');
    await typeSlashCommand(page, 'divider');
    await selectFirstCommand(page);
    await expect(page.locator('.cept-editor-content .cept-divider')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-divider', category: 'slash-commands' });
  });

  test('callout', async ({ page }) => {
    await typeSlashCommand(page, 'callout');
    await selectFirstCommand(page);
    await page.keyboard.type('This is an important callout');
    await expect(page.locator('.cept-editor-content .cept-callout')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-callout', category: 'slash-commands' });
  });

  test('toggle', async ({ page }) => {
    await typeSlashCommand(page, 'toggle');
    await selectFirstCommand(page);
    await page.keyboard.type('Hidden content inside toggle');
    await expect(page.locator('.cept-editor-content .cept-toggle')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-toggle', category: 'slash-commands' });
  });

  test('image (via prompt)', async ({ page }) => {
    // Mock window.prompt to return a URL
    await page.evaluate(() => {
      window.prompt = () => 'https://via.placeholder.com/400x200?text=Demo+Image';
    });
    await typeSlashCommand(page, 'image');
    await selectFirstCommand(page);
    await page.waitForTimeout(500);
    await expect(page.locator('.cept-editor-content .cept-image-block')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-image', category: 'slash-commands' });
  });

  test('embed (via prompt)', async ({ page }) => {
    await page.evaluate(() => {
      window.prompt = () => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    });
    // "vimeo" uniquely matches Embed via description "Embed YouTube, Vimeo, etc."
    // (typing "embed" also matches Image description "Upload or embed an image")
    await typeSlashCommand(page, 'vimeo');
    await selectFirstCommand(page);
    await page.waitForTimeout(500);
    await expect(page.locator('.cept-editor-content .cept-embed')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-embed', category: 'slash-commands' });
  });

  test('bookmark (via prompt)', async ({ page }) => {
    await page.evaluate(() => {
      window.prompt = () => 'https://example.com';
    });
    await typeSlashCommand(page, 'bookmark');
    await selectFirstCommand(page);
    await page.waitForTimeout(500);
    await expect(page.locator('.cept-editor-content .cept-bookmark')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-bookmark', category: 'slash-commands' });
  });

  test('2 columns', async ({ page }) => {
    // "two" uniquely matches 2 Columns via description "Split into two columns"
    await typeSlashCommand(page, 'two');
    await selectFirstCommand(page);
    await expect(page.locator('.cept-editor-content .cept-columns')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-2-columns', category: 'slash-commands' });
  });

  test('3 columns', async ({ page }) => {
    // "three" uniquely matches 3 Columns via description "Split into three columns"
    await typeSlashCommand(page, 'three');
    await selectFirstCommand(page);
    await expect(page.locator('.cept-editor-content .cept-columns')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-3-columns', category: 'slash-commands' });
  });

  test('math equation', async ({ page }) => {
    // "math" matches Math Equation first (before Inline Math in the list)
    await typeSlashCommand(page, 'math');
    await selectFirstCommand(page);
    // mathBlock is an atom node — default content "E = mc^2" is set by the extension
    await expect(page.locator('.cept-editor-content .cept-math-block')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-math-block', category: 'slash-commands' });
  });

  test('inline math', async ({ page }) => {
    const editor = page.locator('.cept-editor-content');
    await editor.click();
    await page.keyboard.type('The formula is ');
    // "inline" uniquely matches Inline Math (no spaces in query)
    await page.keyboard.type('/');
    await page.waitForTimeout(300);
    await page.keyboard.type('inline');
    await page.waitForTimeout(200);
    await selectFirstCommand(page);
    // inlineMath is an atom node — default content "x^2" is set by the extension
    await expect(page.locator('.cept-editor-content .cept-inline-math')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-inline-math', category: 'slash-commands' });
  });

  test('table', async ({ page }) => {
    await typeSlashCommand(page, 'table');
    await selectFirstCommand(page);
    await page.waitForTimeout(300);
    // Table should be inserted with header row
    await expect(page.locator('.cept-editor-content table')).toBeVisible();
    await expect(page.locator('.cept-editor-content th').first()).toBeVisible();
    // Type into the first header cell
    await page.keyboard.type('Column A');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Column B');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Column C');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Row 1 Data');
    await captureScreenshot(page, { name: 'slash-table', category: 'slash-commands' });
  });

  test('mermaid diagram', async ({ page }) => {
    await typeSlashCommand(page, 'mermaid');
    await selectFirstCommand(page);
    // mermaid is an atom node — default flowchart content is set by the extension
    await expect(page.locator('.cept-editor-content .cept-mermaid')).toBeVisible();
    await captureScreenshot(page, { name: 'slash-mermaid', category: 'slash-commands' });
  });
});

test.describe('Page Header', () => {
  test('page title is editable inline', async ({ page }) => {
    await openDemoEditor(page);
    const title = page.getByTestId('page-title');
    await expect(title).toBeVisible();
    await captureScreenshot(page, { name: 'page-header-title', category: 'features' });

    // Click to edit
    await title.click();
    await expect(page.getByTestId('page-title-input')).toBeVisible();
    await expect(page.getByTestId('page-title-save')).toBeVisible();
    await captureScreenshot(page, { name: 'page-header-editing', category: 'features' });
  });

  test('page menu has actions in header bar', async ({ page }) => {
    await openDemoEditor(page);
    await page.getByTestId('page-menu-btn').click();
    await expect(page.getByTestId('page-menu')).toBeVisible();
    await captureScreenshot(page, { name: 'page-menu', category: 'features' });
  });
});

test.describe('App Menu', () => {
  test('sidebar app menu opens with settings, help, about', async ({ page }) => {
    await openDemoEditor(page);
    // Open sidebar if closed (mobile)
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      await page.getByTestId('sidebar-toggle').click();
      await page.waitForTimeout(200);
    }
    await page.getByTestId('sidebar-app-menu-trigger').click();
    await expect(page.getByTestId('sidebar-app-menu')).toBeVisible();
    await captureScreenshot(page, { name: 'sidebar-app-menu-open', category: 'features' });
  });

  test('about panel displays via sidebar app menu', async ({ page }) => {
    await openDemoEditor(page);
    // Open sidebar if closed (mobile)
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      await page.getByTestId('sidebar-toggle').click();
      await page.waitForTimeout(200);
    }
    await page.getByTestId('sidebar-app-menu-trigger').click();
    await page.getByTestId('sidebar-app-menu-about').click();
    // About is now a tab in the Settings modal
    await expect(page.getByTestId('settings-panel-about')).toBeVisible();
    await captureScreenshot(page, { name: 'about-panel', category: 'features' });
  });
});

test.describe('Sidebar Actions', () => {
  test('selected page shows action buttons', async ({ page }) => {
    await openDemoEditor(page);
    // Open sidebar if closed (mobile)
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      await page.getByTestId('sidebar-toggle').click();
      await page.waitForTimeout(200);
    }
    // The welcome page is selected, should show ··· and + buttons
    const menuBtn = page.getByTestId('page-tree-menu-welcome');
    await expect(menuBtn).toBeVisible();
    await captureScreenshot(page, { name: 'sidebar-selected-actions', category: 'features' });
  });

  test('context menu opens from sidebar triple-dot', async ({ page }) => {
    await openDemoEditor(page);
    // Open sidebar if closed (mobile)
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      await page.getByTestId('sidebar-toggle').click();
      await page.waitForTimeout(200);
    }
    await page.getByTestId('page-tree-menu-welcome').click();
    await expect(page.getByTestId('page-context-menu')).toBeVisible();
    await captureScreenshot(page, { name: 'sidebar-context-menu', category: 'features' });
  });
});
