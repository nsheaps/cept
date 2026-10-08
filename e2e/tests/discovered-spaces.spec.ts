import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PROXY, corsHeaders, git, serveGit } from './git-http.js';

/**
 * REQ-WS-023, REQ-AUTH-014: after signing in with a token, Settings > Spaces
 * lists the spaces in the account's repositories without cloning them; Pin
 * clones one and adds it, Open clones one and switches to it. GitHub's REST API
 * is mocked from a local repository, which `git http-backend` also serves
 * behind the CORS proxy URL the app clones through.
 */

const TOKEN = 'github_pat_e2eDiscovery_0123456789';
const REPO = 'e2e/handbook';

/** A bare repository `handbook` with two spaces, and its work tree. */
function createRepo(root: string): string {
  git(root, 'init', '-q', '--bare', '-b', 'main', 'handbook');
  const work = path.join(root, 'work');
  for (const [dir, name] of [
    ['docs', 'Docs'],
    ['team', 'Team'],
  ]) {
    mkdirSync(path.join(work, dir), { recursive: true });
    writeFileSync(
      path.join(work, dir, 'space.cept.yaml'),
      `version: '1'\nname: ${name}\nslug: ${dir}\n`,
    );
  }
  writeFileSync(path.join(work, 'docs', 'intro.md'), '# The intro\n\nHello.\n');
  writeFileSync(path.join(work, 'team', 'plan.md'), '# The plan\n\nShip it.\n');
  git(root, 'init', '-q', '-b', 'main', 'work');
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'first');
  git(work, 'remote', 'add', 'origin', path.join(root, 'handbook'));
  git(work, 'push', '-q', 'origin', 'main');
  return work;
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

test.describe('Discovered spaces', () => {
  let root: string;
  let work: string;

  test.beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'cept-e2e-discovered-'));
    work = createRepo(root);
  });

  test.afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('lists spaces without cloning, then pins one and opens another', async ({ page }) => {
    await page.route('https://api.github.com/**', (route) => serveApi(route, work));
    const clones: string[] = [];
    await page.route(`${PROXY}/**`, (route) => {
      clones.push(route.request().url());
      return serveGit(route, root, `/github.com/${REPO}`, 'handbook');
    });

    await page.goto('/');
    await page.getByTestId('start-writing').click();
    await expect(page.getByTestId('landing-page')).not.toBeVisible({ timeout: 10000 });

    await openSettings(page, 'settings');
    await page.getByTestId('github-token-input').fill(TOKEN);
    await page.getByTestId('github-sign-in-btn').click();
    await expect(page.getByTestId('github-login')).toHaveText('The Octocat (@octocat)');

    // Both spaces are listed, and nothing has been cloned.
    await page.getByTestId('settings-tab-spaces').click();
    const docsId = `github.com/${REPO}@main/docs`;
    const teamId = `github.com/${REPO}@main/team`;
    await expect(page.getByTestId(`discovered-space-${docsId}`)).toContainText('Docs', {
      timeout: 20000,
    });
    await expect(page.getByTestId(`discovered-space-${teamId}`)).toContainText('Team');
    expect(clones).toEqual([]);

    // Pin adds the space without switching to it.
    await page.getByTestId(`discovered-pin-${docsId}`).click();
    await expect(page.getByTestId(`space-item-${docsId}`)).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId(`discovered-space-${docsId}`)).toHaveCount(0);
    await expect(
      page.getByTestId(`space-item-${docsId}`).getByTestId('active-space-badge'),
    ).toHaveCount(0);
    expect(clones.length).toBeGreaterThan(0);

    // Open clones the other space and switches to it. A writable space is read
    // like a folder space: its first page is shown, titled by its file name.
    await page.getByTestId(`discovered-open-${teamId}`).click();
    await expect(page.getByTestId('breadcrumbs')).toContainText('plan', { timeout: 20000 });
    await expect(page.locator('.cept-editor-content')).toContainText('The plan');
    await expect(page.getByTestId('sync-indicator')).not.toHaveAttribute('data-state', 'error');
  });
});
