/**
 * Screenshot utilities for Playwright E2E tests.
 *
 * Captures screenshots at key UI states for documentation
 * and visual regression testing. Screenshots are saved to
 * docs/screenshots/ for inclusion in documentation.
 */

import { type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../docs/screenshots');

export interface ScreenshotOptions {
  /** Name of the screenshot (without extension) */
  name: string;
  /** Optional subdirectory within screenshots/ */
  category?: string;
  /** Whether to capture full page */
  fullPage?: boolean;
  /** Element selector to capture (instead of full page) */
  selector?: string;
  /** Viewport size to set before capturing */
  viewport?: { width: number; height: number };
}

/**
 * Capture a screenshot and save it to the docs/screenshots directory.
 */
export async function captureScreenshot(
  page: Page,
  options: ScreenshotOptions,
): Promise<string> {
  const dir = options.category
    ? path.join(SCREENSHOTS_DIR, options.category)
    : SCREENSHOTS_DIR;

  const filePath = path.join(dir, `${options.name}.png`);

  if (options.viewport) {
    await page.setViewportSize(options.viewport);
    // Wait for layout to settle
    await page.waitForTimeout(300);
  }

  if (options.selector) {
    const element = page.locator(options.selector).first();
    // Retry up to 3 times — elements can detach during re-renders
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await element.waitFor({ state: 'visible', timeout: 5000 });
        await page.waitForTimeout(300);
        await element.screenshot({ path: filePath });
        break;
      } catch (err) {
        if (attempt === 2) throw err;
        await page.waitForTimeout(500);
      }
    }
  } else {
    await page.screenshot({
      path: filePath,
      fullPage: options.fullPage ?? false,
    });
  }

  return filePath;
}

/**
 * Capture screenshots at multiple viewport sizes.
 */
export async function captureResponsiveScreenshots(
  page: Page,
  name: string,
  category?: string,
): Promise<string[]> {
  const viewports = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 },
  ];

  const paths: string[] = [];
  for (const vp of viewports) {
    const filePath = await captureScreenshot(page, {
      name: `${name}-${vp.name}`,
      category,
      viewport: { width: vp.width, height: vp.height },
    });
    paths.push(filePath);
  }

  return paths;
}

/**
 * Screenshot test configuration for documentation pages.
 */
export const DOC_SCREENSHOTS = [
  { name: 'onboarding', category: 'getting-started', path: '/', waitFor: 'Get Started' },
  { name: 'editor', category: 'guides', path: '/', waitFor: '.cept-editor', action: 'demo-mode' },
  { name: 'sidebar', category: 'guides', path: '/', waitFor: '.cept-sidebar', action: 'demo-mode' },
] as const;
