import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PROXY, git, serveGit } from './git-http.js';

/**
 * REQ-WS-013: a link to a file in a GitHub repository opens it in a remote
 * space; a later link into the same repository opens in that space; the page
 * menu links to the page on GitHub, refreshes the space from its remote and
 * opens the space's settings. GitHub is a local bare repository served by
 * `git http-backend` behind the CORS proxy URL the app uses.
 */

const REPO_PATH = '/github.com/e2e/notes';

/** A bare repository `notes` under `root`, and a work tree that pushes to it. */
function createRepo(root: string): string {
  git(root, 'init', '-q', '--bare', '-b', 'main', 'notes');
  const work = path.join(root, 'work');
  mkdirSync(path.join(work, 'docs'), { recursive: true });
  writeFileSync(path.join(work, 'README.md'), '# Notes home\n\nThe start.\n');
  writeFileSync(path.join(work, 'docs', 'guide.md'), '# The guide\n\nRead me.\n');
  writeFileSync(path.join(work, 'docs', 'intro.md'), '# The intro\n\nHello.\n');
  git(root, 'init', '-q', '-b', 'main', 'work');
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'first');
  git(work, 'remote', 'add', 'origin', path.join(root, 'notes'));
  git(work, 'push', '-q', 'origin', 'main');
  return work;
}

async function openPageMenu(page: Page): Promise<void> {
  await page.getByTestId('page-menu-btn').click();
}

test.describe('Remote spaces', () => {
  let root: string;
  let work: string;

  test.beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'cept-e2e-remote-'));
    work = createRepo(root);
  });

  test.afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('opens repository links in one space, links to GitHub and refreshes', async ({ page }) => {
    await page.route(`${PROXY}/**`, (route) => serveGit(route, root, REPO_PATH, 'notes'));

    // A link to a file at the repository root makes a space for the repository.
    await page.goto('/g/github.com/e2e/notes/blob/main/README.md');
    await expect(page.getByTestId('breadcrumbs')).toContainText('Notes home', { timeout: 20000 });

    // A link deeper in the same repository opens in that space (REQ-WS-013).
    // lightning-fs saves its file table 500 ms after the last write, so a reload
    // sooner than that would lose the new space; wait it out first.
    await page.waitForTimeout(1500);
    await page.goto('/g/github.com/e2e/notes/blob/main/docs/intro.md');
    await expect(page.getByTestId('breadcrumbs')).toContainText('The intro', { timeout: 20000 });
    await expect(page.getByTestId('not-found')).toHaveCount(0);

    // The page menu links to the page on GitHub.
    await openPageMenu(page);
    const viewOnGitHub = page.getByTestId('page-menu-view-remote');
    await expect(viewOnGitHub).toHaveAttribute(
      'href',
      'https://github.com/e2e/notes/blob/main/docs/intro.md',
    );
    await expect(viewOnGitHub).toHaveAttribute('target', '_blank');

    // A new commit on the remote shows up after a refresh, and the open page stays open.
    writeFileSync(path.join(work, 'docs', 'extra.md'), '# Extra page\n\nNew.\n');
    git(work, 'add', '.');
    git(work, 'commit', '-q', '-m', 'second');
    git(work, 'push', '-q', 'origin', 'main');
    await page.getByTestId('page-menu-refresh-space').click();
    await expect(page.getByText('is refreshed from its remote')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('breadcrumbs')).toContainText('The intro');

    // Space settings open on this space, which is the only remote one, and link to GitHub.
    await openPageMenu(page);
    await page.getByTestId('page-menu-space-settings').click();
    await expect(page.getByTestId('space-detail-remote-link')).toHaveAttribute(
      'href',
      'https://github.com/e2e/notes/tree/main',
    );
    await page.getByTestId('space-details-back').click();
    await expect(page.locator('[data-testid^="space-item-github.com/e2e/notes"]')).toHaveCount(1);
    await page.keyboard.press('Escape');

    // The new page is in the space.
    await page.goto('/g/github.com/e2e/notes/blob/main/docs/extra.md');
    await expect(page.getByTestId('breadcrumbs')).toContainText('Extra page', { timeout: 20000 });
  });
});
