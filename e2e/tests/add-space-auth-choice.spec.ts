import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PROXY, corsHeaders, git, serveGit } from './git-http.js';

/**
 * REQ-AUTH-020: with two saved GitHub tokens, adding a space from a URL asks
 * which one to use, and the clone is made with the chosen token. GitHub's REST
 * API is mocked; the repository is a local bare repository served by
 * `git http-backend` behind the CORS proxy URL the app clones through.
 */

const TOKEN_A = 'github_pat_e2eChoiceAlice_0123456789';
const TOKEN_B = 'github_pat_e2eChoiceBob_0123456789';
const LOGINS: Record<string, string> = { [TOKEN_A]: 'alice', [TOKEN_B]: 'bob' };

/** A bare repository `notes` with a README, and its work tree. */
function createRepo(root: string): void {
  git(root, 'init', '-q', '--bare', '-b', 'main', 'notes');
  const work = path.join(root, 'work');
  git(root, 'init', '-q', '-b', 'main', 'work');
  writeFileSync(path.join(work, 'README.md'), '# Notes home\n\nThe start.\n');
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'first');
  git(work, 'remote', 'add', 'origin', path.join(root, 'notes'));
  git(work, 'push', '-q', 'origin', 'main');
}

/** Answer GitHub REST requests for whichever of the two tokens signs in. */
async function serveApi(route: Route): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const json = (body: unknown, status = 200) =>
    route.fulfill({ status, json: body, headers: corsHeaders() });
  const token = (request.headers()['authorization'] ?? '').replace(/^Bearer /, '');
  const login = LOGINS[token];
  if (!login) return json({ message: 'Bad credentials' }, 401);
  if (url.pathname === '/user') return json({ login, name: login, avatar_url: '' });
  if (url.pathname === '/user/repos') return json([]);
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

test.describe('Choosing the auth for a new space', () => {
  let root: string;

  test.beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'cept-e2e-auth-choice-'));
    createRepo(root);
  });

  test.afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('clones with the token picked in the add-from-Git form', async ({ page }) => {
    await page.route('https://api.github.com/**', (route) => serveApi(route));
    const credentials: string[] = [];
    await page.route(`${PROXY}/**`, (route) => {
      const header = route.request().headers()['authorization'];
      if (header) credentials.push(Buffer.from(header.replace(/^Basic /, ''), 'base64').toString());
      return serveGit(route, root, '/github.com/e2e/notes', 'notes');
    });

    await page.goto('/');
    await page.getByTestId('start-writing').click();
    await expect(page.getByTestId('landing-page')).not.toBeVisible({ timeout: 10000 });

    await openSettings(page, 'settings');
    for (const token of [TOKEN_A, TOKEN_B]) {
      await page.getByTestId('auth-token-input').fill(token);
      await page.getByTestId('auth-add-btn').click();
      await expect(page.getByTestId('auth-list').getByTestId('auth-label')).toHaveCount(
        token === TOKEN_A ? 1 : 2,
        { timeout: 20000 },
      );
    }

    await page.getByTestId('settings-tab-spaces').click();
    await page.getByTestId('create-space-btn').click();
    await page.getByTestId('wizard-choose-git').click();
    await page.getByTestId('wizard-remote-url-input').fill('github.com/e2e/notes');
    await page.getByTestId('wizard-remote-subpath-input').fill('');

    // Two tokens can read GitHub: the first is suggested, the second is picked.
    const picker = page.getByTestId('wizard-remote-auth');
    await expect(picker.locator('option')).toHaveCount(2);
    await expect(picker.locator('option').first()).toContainText('(Recommended)');
    await picker.selectOption({ index: 1 });
    await page.getByTestId('wizard-add-remote-confirm').click();

    await expect(page.getByTestId('breadcrumbs')).toContainText('Notes home', { timeout: 20000 });
    expect(credentials.length).toBeGreaterThan(0);
    expect(credentials.every((c) => c.endsWith(`:${TOKEN_B}`))).toBe(true);
  });
});
