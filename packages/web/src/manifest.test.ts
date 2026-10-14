import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const publicDir = path.resolve(__dirname, '../public');
const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.json'), 'utf-8')) as {
  id: string;
  start_url: string;
  scope: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
};
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string): [number, number] {
  const buf = fs.readFileSync(file);
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

describe('web app manifest (REQ-WEB PWA install)', () => {
  it('is relative to the manifest URL, so it works under any deploy base', () => {
    for (const url of [manifest.id, manifest.start_url, manifest.scope]) {
      expect(url.startsWith('/'), `${url} must not be absolute`).toBe(false);
      expect(url).not.toMatch(/^[a-z]+:/i);
    }
    for (const icon of manifest.icons) expect(icon.src.startsWith('/')).toBe(false);
  });

  it('keeps start_url inside scope', () => {
    expect(manifest.scope).toBe('./');
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);
  });

  it('lists icons that exist and are the size they claim', () => {
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of manifest.icons) {
      const file = path.join(publicDir, icon.src);
      expect(fs.existsSync(file), `${icon.src} is missing`).toBe(true);
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(file)).toEqual([w, h]);
    }
  });

  it('offers 192 and 512 icons for install, and a maskable one', () => {
    const sizes = manifest.icons.filter((i) => i.purpose !== 'maskable').map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });
});

describe('index.html mobile metadata', () => {
  it('extends under the notch and links the iOS home-screen icon', () => {
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="apple-mobile-web-app-capable"');
    expect(fs.existsSync(path.join(publicDir, 'icons/apple-touch-icon.png'))).toBe(true);
    expect(pngSize(path.join(publicDir, 'icons/apple-touch-icon.png'))).toEqual([180, 180]);
  });

  it('links the manifest', () => {
    expect(html).toContain('rel="manifest"');
  });
});
