import { test, expect } from '@playwright/test';

const BASE = '/cept/app/';

test.describe('installable PWA at the production base path', () => {
  test('the manifest is linked and every icon in it returns 200', async ({ page, request }) => {
    await page.goto(BASE);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifestUrl = new URL(href!, page.url());
    expect(manifestUrl.pathname.startsWith(BASE)).toBe(true);

    const res = await request.get(manifestUrl.href);
    expect(res.status()).toBe(200);
    const manifest = (await res.json()) as {
      start_url: string;
      scope: string;
      id: string;
      icons: Array<{ src: string; sizes: string; type: string }>;
    };

    // start_url and scope resolve under the base, so installing from a
    // sub-path deploy does not open the host root.
    const start = new URL(manifest.start_url, manifestUrl);
    const scope = new URL(manifest.scope, manifestUrl);
    expect(start.pathname.startsWith(BASE)).toBe(true);
    expect(scope.pathname).toBe(BASE);
    expect(start.pathname.startsWith(scope.pathname)).toBe(true);
    expect(new URL(manifest.id, manifestUrl).pathname.startsWith(BASE)).toBe(true);

    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of manifest.icons) {
      const iconRes = await request.get(new URL(icon.src, manifestUrl).href);
      expect(iconRes.status(), icon.src).toBe(200);
      expect(iconRes.headers()['content-type'], icon.src).toContain(icon.type);
    }
  });

  test('the iOS home-screen icon and favicon resolve under the base', async ({ page, request }) => {
    await page.goto(BASE);
    for (const rel of ['apple-touch-icon', 'icon']) {
      const href = await page.locator(`link[rel="${rel}"]`).getAttribute('href');
      expect(href, rel).toBeTruthy();
      const url = new URL(href!, page.url());
      expect(url.pathname.startsWith(BASE), `${rel} ${url.pathname}`).toBe(true);
      expect((await request.get(url.href)).status(), rel).toBe(200);
    }
  });

  test('the page extends under the notch and declares iOS standalone', async ({ page }) => {
    await page.goto(BASE);
    expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain(
      'viewport-fit=cover',
    );
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
      'content',
      'yes',
    );
  });
});
