import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * REQ-WS-013: a link to a file in a GitHub repository opens it in a remote
 * space; a later link into the same repository opens in that space; the page
 * menu links to the page on GitHub, refreshes the space from its remote and
 * opens the space's settings. GitHub is a local bare repository served by
 * `git http-backend` behind the CORS proxy URL the app uses.
 */

const PROXY = 'https://cors.isomorphic-git.org';
const REPO_PATH = '/github.com/e2e/notes';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, {
    cwd,
    stdio: 'ignore',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'E2E',
      GIT_AUTHOR_EMAIL: 'e2e@example.com',
      GIT_COMMITTER_NAME: 'E2E',
      GIT_COMMITTER_EMAIL: 'e2e@example.com',
    },
  });
}

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

/** Answer a proxied smart-HTTP request from `git http-backend`. */
async function serveGit(route: Route, root: string): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: corsHeaders() });
    return;
  }
  if (!url.pathname.startsWith(`${REPO_PATH}/`) && !url.pathname.startsWith(`${REPO_PATH}.git/`)) {
    await route.fulfill({ status: 404, headers: corsHeaders(), body: 'not found' });
    return;
  }
  const rest = url.pathname.slice(REPO_PATH.length).replace(/^\.git/, '');
  const result = spawnSync('git', ['http-backend'], {
    input: request.postDataBuffer() ?? Buffer.alloc(0),
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_PROJECT_ROOT: root,
      GIT_HTTP_EXPORT_ALL: '1',
      PATH_INFO: `/notes${rest}`,
      QUERY_STRING: url.search.replace(/^\?/, ''),
      REQUEST_METHOD: request.method(),
      CONTENT_TYPE: request.headers()['content-type'] ?? '',
    },
  });
  const out = result.stdout;
  const split = out.indexOf('\r\n\r\n');
  const head = out.subarray(0, split).toString('utf8');
  const body = out.subarray(split + 4);
  const headers: Record<string, string> = corsHeaders();
  let status = 200;
  for (const line of head.split('\r\n')) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (name.toLowerCase() === 'status') status = Number.parseInt(value, 10);
    else headers[name] = value;
  }
  await route.fulfill({ status, headers, body });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Expose-Headers': '*',
  };
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
    await page.route(`${PROXY}/**`, (route) => serveGit(route, root));

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
