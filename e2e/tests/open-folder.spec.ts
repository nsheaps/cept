import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * REQ-WS-012, REQ-WEB-023, REQ-WS-019: open a folder on this device as a
 * space. The folder picker is mocked with a folder in the origin private file
 * system, whose handles behave like picked ones (they persist in IndexedDB and
 * keep their permission), so the reload restores the space.
 */

const FILES: Record<string, string> = {
  'space.cept.yaml': 'version: 1\nname: Field notes\nslug: field-notes\n',
  'Welcome.md': '---\ntitle: Welcome\n---\n# Welcome\n\nNotes kept as plain files.\n',
  'Guides/Setup.md': '# Setup\n\nInstall nothing.\n',
  'photo.txt': 'not a page',
};

/** Make `showDirectoryPicker` return the `field-notes` folder of the private file system. */
async function mockPicker(page: Page) {
  await page.addInitScript(() => {
    (
      window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
    ).showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle('field-notes', { create: true });
    };
  });
}

/** Write the fixture files into the private file system folder. */
async function seedFolder(page: Page) {
  await page.evaluate(async (files) => {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry('field-notes', { recursive: true }).catch(() => undefined);
    const folder = await root.getDirectoryHandle('field-notes', { create: true });
    for (const [path, text] of Object.entries(files)) {
      const parts = path.split('/');
      let dir = folder;
      for (const part of parts.slice(0, -1)) {
        dir = await dir.getDirectoryHandle(part, { create: true });
      }
      const file = await dir.getFileHandle(parts.at(-1)!, { create: true });
      const writable = await file.createWritable();
      await writable.write(text);
      await writable.close();
    }
  }, FILES);
}

/** Every file in the folder with its text. */
async function folderFiles(page: Page): Promise<Record<string, string>> {
  return page.evaluate(async () => {
    const out: Record<string, string> = {};
    const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
      for await (const [name, entry] of (
        dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }
      ).entries()) {
        const path = prefix ? `${prefix}/${name}` : name;
        if (entry.kind === 'directory') await walk(entry as FileSystemDirectoryHandle, path);
        else out[path] = await (await (entry as FileSystemFileHandle).getFile()).text();
      }
    };
    const root = await navigator.storage.getDirectory();
    await walk(await root.getDirectoryHandle('field-notes'), '');
    return out;
  });
}

test.describe('Open a local folder as a space', () => {
  test.beforeEach(({}, testInfo) => {
    // The sidebar layout differs on phones; the folder logic is the same.
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'Desktop Chrome only');
  });

  test('opens a space folder, writes nothing to it, and restores it after a reload', async ({
    page,
  }) => {
    await mockPicker(page);
    await page.goto('/');
    await seedFolder(page);
    await expect(page.getByTestId('landing-page')).toBeVisible();

    await page.getByTestId('landing-open-folder').click();
    const tree = page.locator('[data-testid^="page-tree-button-"]');
    await expect(tree.filter({ hasText: 'Welcome' })).toBeVisible({ timeout: 10000 });
    await expect(tree.filter({ hasText: 'Guides' })).toBeVisible();

    await tree.filter({ hasText: 'Welcome' }).click();
    const editor = page.locator('.cept-editor');
    await expect(editor).toContainText('Notes kept as plain files.', { timeout: 10000 });

    // Opening and reading changed nothing in the folder and added nothing to it.
    await page.waitForTimeout(1000);
    expect(await folderFiles(page)).toEqual(FILES);

    // The browser file system saves the app's own state shortly after a change.
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(editor).toContainText('Notes kept as plain files.', { timeout: 10000 });
    await expect(tree.filter({ hasText: 'Guides' })).toBeVisible();
    expect(await folderFiles(page)).toEqual(FILES);
  });

  test('a plain folder becomes a space only when asked, by adding its marker', async ({ page }) => {
    await mockPicker(page);
    await page.goto('/');
    await seedFolder(page);
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const folder = await root.getDirectoryHandle('field-notes');
      await folder.removeEntry('space.cept.yaml');
    });
    const before = await folderFiles(page);

    await page.getByTestId('landing-open-folder').click();
    await expect(page.getByTestId('open-folder-dialog')).toBeVisible({ timeout: 10000 });
    expect(await folderFiles(page)).toEqual(before);

    await page.getByTestId('open-folder-make-space').click();
    const tree = page.locator('[data-testid^="page-tree-button-"]');
    await expect(tree.filter({ hasText: 'Welcome' })).toBeVisible({ timeout: 10000 });
    const after = await folderFiles(page);
    expect(Object.keys(after).sort()).toEqual([...Object.keys(before), 'space.cept.yaml'].sort());
    expect(after['space.cept.yaml']).toContain('name: field-notes');
    for (const [path, text] of Object.entries(before)) expect(after[path]).toBe(text);
  });
});
