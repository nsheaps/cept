import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * REQ-AUTH-005, REQ-AUTH-012: sign in to GitHub with a personal access token,
 * keep it (encrypted) across a reload, and sign out. GitHub's API is mocked.
 */

const GOOD = 'github_pat_e2eGoodToken_0123456789';

async function mockGitHub(page: Page) {
  // Signing in looks for spaces in the account's repositories; this account has none.
  await page.route('https://api.github.com/user/repos**', (route) =>
    route.fulfill({ status: 200, json: [], headers: { 'Access-Control-Allow-Origin': '*' } }),
  );
  await page.route('https://api.github.com/user', async (route) => {
    const auth = route.request().headers()['authorization'];
    if (auth !== `Bearer ${GOOD}`) {
      await route.fulfill({ status: 401, json: { message: 'Bad credentials' } });
      return;
    }
    await route.fulfill({
      status: 200,
      json: { login: 'octocat', name: 'The Octocat', avatar_url: '' },
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
}

async function openSettings(page: Page) {
  // On a narrow screen the sidebar starts closed.
  const menu = page.getByTestId('sidebar-app-menu-trigger');
  if (!(await menu.isVisible())) await page.getByTestId('sidebar-toggle').click();
  await menu.click();
  await page.getByTestId('sidebar-app-menu-settings').click();
  await page.getByTestId('settings-tab-settings').click();
}

test.describe('GitHub sign-in', () => {
  test('adds a token, keeps it across a reload and removes it', async ({ page }) => {
    await mockGitHub(page);
    await page.goto('/');
    await page.getByTestId('start-writing').click();
    await expect(page.getByTestId('landing-page')).not.toBeVisible({ timeout: 10000 });

    // A wrong token is rejected.
    await openSettings(page);
    await expect(page.getByTestId('auth-proxy-notice')).toBeVisible();
    await page.getByTestId('auth-token-input').fill('ghp_wrong');
    await page.getByTestId('auth-add-btn').click();
    await expect(page.getByTestId('auth-error')).toContainText('rejected the token');

    // The right one signs in.
    await page.getByTestId('auth-token-input').fill(GOOD);
    await page.getByTestId('auth-add-btn').click();
    await expect(page.getByTestId('auth-detail')).toHaveText(
      'github.com · The Octocat (@octocat) · Fine-grained token',
    );

    // After a reload the saved token is restored.
    await page.reload();
    await openSettings(page);
    await expect(page.getByTestId('auth-detail')).toContainText('The Octocat (@octocat)');

    // Remove it, and stay signed out after a reload.
    await page.getByTestId('auth-remove').click();
    await expect(page.getByTestId('auth-empty')).toBeVisible();
    await page.reload();
    await openSettings(page);
    await expect(page.getByTestId('auth-empty')).toBeVisible();
  });
});
