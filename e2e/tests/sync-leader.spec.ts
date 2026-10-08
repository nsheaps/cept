import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PROXY, corsHeaders, git, serveGit } from './git-http.js';

/**
 * REQ-WS-027: one tab per space is the sync leader. Only the tab holding the
 * Web Lock `cept-sync:<space>|<login>` runs automatic syncs; the other tabs of
 * the origin wait in the lock's queue, and take over when the leader closes.
 *
 * Both tabs are pages of ONE browser context, so they share IndexedDB (the
 * space's clone, the spaces manifest, the saved token) and Web Locks. GitHub's
 * REST API is mocked and the repository is served by `git http-backend` behind
 * the CORS proxy URL, as in discovered-spaces.spec.ts.
 */

const TOKEN = 'github_pat_e2eSyncLeader_0123456789';
const REPO = 'e2e/handbook';
const SPACE_ID = `github.com/${REPO}@main/docs`;

/** A bare repository `handbook` holding one space, `docs`. */
function createRepo(root: string): void {
  git(root, 'init', '-q', '--bare', '-b', 'main', 'handbook');
  const work = path.join(root, 'work');
  mkdirSync(path.join(work, 'docs'), { recursive: true });
  writeFileSync(
    path.join(work, 'docs', 'space.cept.yaml'),
    `version: '1'\nname: Docs\nslug: docs\n`,
  );
  writeFileSync(path.join(work, 'docs', 'intro.md'), '# The intro\n\nHello.\n');
  git(root, 'init', '-q', '-b', 'main', 'work');
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'first');
  git(work, 'remote', 'add', 'origin', path.join(root, 'handbook'));
  git(work, 'push', '-q', 'origin', 'main');
}

function gitOut(cwd: string, ...args: string[]): Buffer {
  return execFileSync('git', args, { cwd });
}

/** Answer GitHub REST requests for the signed-in account from the work tree. */
async function serveApi(route: Route, work: string): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const json = (body: unknown, status = 200) =>
    route.fulfill({ status, json: body, headers: corsHeaders() });
  if (request.headers()['authorization'] !== `Bearer ${TOKEN}`)
    return json({ message: 'Bad credentials' }, 401);

  if (url.pathname === '/user')
    return json({ login: 'octocat', name: 'The Octocat', avatar_url: '' });
  if (url.pathname === '/user/repos')
    return json([
      {
        full_name: REPO,
        name: 'handbook',
        html_url: `https://github.com/${REPO}`,
        private: true,
        fork: false,
        archived: false,
        default_branch: 'main',
      },
    ]);
  if (url.pathname === `/repos/${REPO}/git/trees/main`) {
    const tree = gitOut(work, 'ls-tree', '-r', '-t', 'HEAD')
      .toString('utf8')
      .trim()
      .split('\n')
      .map((line) => {
        const [meta, entryPath] = line.split('\t');
        const [mode, type, sha] = meta!.split(' ');
        return { path: entryPath, mode, type, sha };
      });
    return json({ sha: 'root', tree, truncated: false });
  }
  const blob = new RegExp(`^/repos/${REPO}/git/blobs/([0-9a-f]+)$`).exec(url.pathname);
  if (blob) {
    const content = gitOut(work, 'cat-file', 'blob', blob[1]!).toString('base64');
    return json({ content, encoding: 'base64' });
  }
  return json({ message: 'Not Found' }, 404);
}

async function openSettings(page: Page, tab: 'settings' | 'spaces') {
  // On a narrow screen the sidebar starts closed.
  const menu = page.getByTestId('sidebar-app-menu-trigger');
  if (!(await menu.isVisible())) await page.getByTestId('sidebar-toggle').click();
  await menu.click();
  await page.getByTestId('sidebar-app-menu-settings').click();
  await page.getByTestId(`settings-tab-${tab}`).click();
}

/** Count the git smart-HTTP requests (`info/refs`, `git-upload-pack`) a page makes. */
async function countGitRequests(page: Page, root: string): Promise<{ count: () => number }> {
  let n = 0;
  await page.route(`${PROXY}/**`, (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    // CORS preflights are not syncs; only count the real requests.
    if (
      request.method() !== 'OPTIONS' &&
      (pathname.endsWith('/info/refs') || pathname.endsWith('/git-upload-pack'))
    ) {
      n++;
    }
    return serveGit(route, root, `/github.com/${REPO}`, 'handbook');
  });
  return { count: () => n };
}

test.describe('Sync leader election', () => {
  let root: string;
  let work: string;

  test.beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'cept-e2e-leader-'));
    createRepo(root);
    work = path.join(root, 'work');
  });

  test.afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('only the leader tab syncs automatically, and another tab takes over when it closes', async ({
    context,
    page: tabA,
  }) => {
    await context.route('https://api.github.com/**', (route) => serveApi(route, work));
    const a = await countGitRequests(tabA, root);

    // Tab A: sign in and Open the space, which becomes the active writable space.
    await tabA.goto('/');
    await tabA.getByTestId('start-writing').click();
    await expect(tabA.getByTestId('landing-page')).not.toBeVisible({ timeout: 10000 });
    await openSettings(tabA, 'settings');
    await tabA.getByTestId('github-token-input').fill(TOKEN);
    await tabA.getByTestId('github-sign-in-btn').click();
    await expect(tabA.getByTestId('github-login')).toHaveText('The Octocat (@octocat)');
    await tabA.getByTestId('settings-tab-spaces').click();
    await tabA.getByTestId(`discovered-open-${SPACE_ID}`).click();
    await expect(tabA.getByTestId('breadcrumbs')).toContainText('intro', { timeout: 20000 });
    await expect(tabA.getByTestId('sync-indicator')).not.toHaveAttribute('data-state', 'error');
    // Tab A leads: opening the session ran its immediate sync (a fetch).
    await expect.poll(() => a.count(), { timeout: 20000 }).toBeGreaterThan(0);

    // Tab B: the same context, so the saved token, the spaces manifest and the
    // active space are shared. A plain reload of `/` lands on the same space.
    const tabB = await context.newPage();
    const b = await countGitRequests(tabB, root);
    await tabB.goto('/');
    await expect(tabB.getByTestId('breadcrumbs')).toContainText('intro', { timeout: 20000 });
    await expect(tabB.getByTestId('sync-indicator')).toBeVisible({ timeout: 20000 });
    await expect(tabB.getByTestId('sync-indicator')).not.toHaveAttribute('data-state', 'error');

    // "Only one tab syncs": a session starts its automatic loop with an
    // immediate fetch, then fetches every `intervalMs` (30 s by default), and
    // opening a session from an existing clone makes no request of its own. So
    // a tab that is NOT the leader makes no smart-HTTP request at all while it
    // sits open, whereas a tab that is the leader makes one on starting. This
    // avoids timing a periodic interval (slow, and flaky around the tick). The
    // window below only lets a wrongly started loop in tab B show itself.
    await tabB.waitForTimeout(3000);
    expect(b.count(), 'tab B (follower) must not sync automatically').toBe(0);
    const aBeforeHandover = a.count();
    expect(aBeforeHandover, 'tab A (leader) synced on starting').toBeGreaterThan(0);

    // Handover: closing the leader releases its Web Lock; the browser grants it
    // to tab B, whose session then starts and fetches at once.
    await tabA.close();
    await expect
      .poll(() => b.count(), {
        message: 'tab B should take over as sync leader and fetch',
        timeout: 20000,
      })
      .toBeGreaterThan(0);
  });
});
