import { test, expect } from '@playwright/test';

const BASE = '/cept/app/';

test.describe('offline start under the production base path', () => {
  test('the built worker carries a base-relative precache list and build id', async ({
    request,
  }) => {
    const res = await request.get(`${BASE}service-worker.js`);
    expect(res.status()).toBe(200);
    const source = await res.text();

    // Registered as a classic script, so it cannot `import` a shared chunk.
    expect(source).not.toMatch(/^\s*import[\s{(]/);
    // The build replaced both placeholders.
    expect(source).not.toContain('__PRECACHE_MANIFEST__');
    expect(source).not.toContain('__BUILD_ID__');
    // A shell, built assets and the manifest, all relative: a root-absolute
    // `/index.html` would 404 under /cept/app/ and fail the install.
    expect(source).toMatch(/`\.\/,[^`]*assets\/[^`]*index\.html[^`]*`/);
    expect(source).not.toMatch(/['"`]\/index\.html['"`]/);
  });

  test('loads once, then reloads and renders with the network off', async ({ page, context }) => {
    await page.goto(BASE);

    // The worker installs, takes control, and the app reloads once; poll until
    // the page is controlled and the static cache is filled, riding out that reload.
    const read = () =>
      page
        .evaluate(async () => {
          if (!navigator.serviceWorker?.controller) return null;
          const names = await caches.keys();
          const staticName = names.find((name) => name.startsWith('cept-static-'));
          if (!staticName) return null;
          const keys = await (await caches.open(staticName)).keys();
          return { names, paths: keys.map((request) => new URL(request.url).pathname) };
        })
        .catch(() => null);
    await expect.poll(read, { timeout: 30_000 }).not.toBeNull();
    const cached = await read();
    expect(cached).not.toBeNull();
    expect(cached!.paths).toContain(BASE);
    expect(cached!.paths).toContain(`${BASE}index.html`);
    expect(cached!.paths.some((path) => path.startsWith(`${BASE}assets/`))).toBe(true);
    // No cache name from another deployment's namespace.
    expect(cached!.names.every((name) => !name.includes('::'))).toBe(true);

    await context.setOffline(true);
    await page.reload();

    await expect(page).toHaveTitle('Cept');
    await expect(page.locator('#root > *').first()).toBeVisible({ timeout: 15_000 });
  });
});

test('?no-sw removes the worker and its caches', async ({ page }) => {
  await page.goto(BASE);
  const controlled = () =>
    page.evaluate(() => !!navigator.serviceWorker?.controller).catch(() => false);
  await expect.poll(controlled, { timeout: 30_000 }).toBe(true);

  await page.goto(`${BASE}?no-sw`);
  const remaining = () =>
    page
      .evaluate(async () => ({
        registrations: (await navigator.serviceWorker.getRegistrations()).length,
        caches: (await caches.keys()).length,
      }))
      .catch(() => null);
  await expect.poll(remaining, { timeout: 15_000 }).toEqual({ registrations: 0, caches: 0 });
});
