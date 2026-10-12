/**
 * Relative links and assets in a page (REQ-EDT-027, D-32; phase-1 plan PR 54).
 *
 * Pages hold standard Markdown links and images with paths relative to the
 * file. The editor renders them as plain `<a href>` and `<img src>`, which the
 * browser would resolve against the app's URL, so this hook resolves them
 * against the space instead:
 *
 * - a click on a link to a page (or a folder page, or a heading in the same
 *   page) navigates in the app; in an editable page it needs Ctrl or Cmd, so a
 *   plain click still places the caret;
 * - a link to a page that does not exist is marked `data-broken`;
 * - an image is read through the space's backend and shown from a blob URL,
 *   which is revoked when the editor unmounts.
 */

import { useEffect, useRef, type RefObject } from 'react';
import type { MentionPage } from './extensions/mention.js';
import { baseFileOfPage, headingSlugs, pageIdForPath, resolvePath } from '@cept/core';

/** What the editor needs from the app to resolve a page's relative links. */
export interface PageLinksContext {
  /** The id of the page being shown. */
  pageId: string;
  /** Whether a page with this id exists in the space. */
  hasPage: (id: string) => boolean;
  /**
   * Whether a file that is not a page exists in the space, by path relative to
   * the space root. Omit it when the space's files are not listed: links to
   * files are then left unchecked.
   */
  hasFile?: (path: string) => boolean;
  /** Read a file of the space by its path relative to the space root; null when missing. */
  readFile: (path: string) => Promise<Uint8Array | null>;
  /** The pages an `@` mention can link to (REQ-EDT-004); without it only dates are offered. */
  pages?: readonly MentionPage[];
  /** Show another page of the space, scrolled to `anchor` when given. */
  onNavigate: (pageId: string, anchor?: string) => void;
}

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
};

/** Whether a path names an image the editor can show, by extension. */
export function isImagePath(path: string): boolean {
  return Object.hasOwn(MIME_TYPES, path.split('.').at(-1)?.toLowerCase() ?? '');
}

/** The media type for an image path, by extension. */
export function imageMimeType(path: string): string {
  const ext = path.split('.').at(-1)?.toLowerCase() ?? '';
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

/** Whether a URL is relative to the page (no scheme, not protocol-relative). */
export function isRelativeUrl(url: string): boolean {
  return url !== '' && !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('//');
}

/** Scroll to the heading of `root` whose GitHub slug is `anchor`. Returns whether one was found. */
export function scrollToHeading(root: HTMLElement, anchor: string): boolean {
  const headings = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'));
  const slugs = headingSlugs(headings.map((h) => h.textContent ?? ''));
  const index = slugs.indexOf(anchor.toLowerCase());
  const target = headings[index];
  if (!target) return false;
  target.scrollIntoView?.({ block: 'start' });
  return true;
}

/** The page a relative link points at, or null when it is not a page link. */
function targetOf(
  ctx: PageLinksContext,
  href: string,
): { id: string | null; anchor: string | undefined } | null {
  const base = baseFileOfPage(ctx.pageId);
  const resolved = resolvePath(base, href);
  if (!resolved) return null;
  if (resolved.path === base) return { id: ctx.pageId, anchor: resolved.anchor };
  return { id: pageIdForPath(resolved.path, ctx.hasPage), anchor: resolved.anchor };
}

/** A path with a file extension other than a page's is an asset, not a page. */
function isAssetPath(path: string): boolean {
  const name = path.split('/').at(-1) ?? '';
  return /\.[^.]+$/.test(name) && !/\.(md|markdown)$/i.test(name);
}

export function usePageLinks(
  containerRef: RefObject<HTMLElement | null>,
  ctx: PageLinksContext | undefined,
  editable: boolean,
): void {
  const pageId = ctx?.pageId;
  // The callbacks change identity whenever the app re-renders (every keystroke).
  // The effect owns the blob URLs, so it reads them through a ref and re-runs
  // only when the page or editability changes; a revoked blob would leave the
  // image in the DOM broken.
  const latest = useRef(ctx);
  latest.current = ctx;
  const remark = useRef<(() => void) | null>(null);
  const hasPage = ctx?.hasPage;
  const hasFile = ctx?.hasFile;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || pageId === undefined || !latest.current) return;
    const links: PageLinksContext = {
      pageId,
      hasPage: (id) => latest.current?.hasPage(id) ?? false,
      ...(latest.current.hasFile
        ? { hasFile: (path: string) => latest.current?.hasFile?.(path) ?? true }
        : {}),
      readFile: (path) => latest.current?.readFile(path) ?? Promise.resolve(null),
      onNavigate: (id, anchor) => latest.current?.onNavigate(id, anchor),
    };
    const base = baseFileOfPage(pageId);
    let disposed = false;
    const blobUrls = new Map<string, string>();
    const loading = new Map<string, Promise<string | null>>();

    const blobUrlFor = (path: string): Promise<string | null> => {
      const known = blobUrls.get(path);
      if (known) return Promise.resolve(known);
      const pending = loading.get(path);
      if (pending) return pending;
      const load = links
        .readFile(path)
        .then((bytes) => {
          if (!bytes || disposed) return null;
          const url = URL.createObjectURL(
            new Blob([bytes as BlobPart], { type: imageMimeType(path) }),
          );
          blobUrls.set(path, url);
          return url;
        })
        .catch(() => null)
        .finally(() => loading.delete(path));
      loading.set(path, load);
      return load;
    };

    const resolveImages = (): void => {
      for (const img of Array.from(container.querySelectorAll('img'))) {
        const src = img.getAttribute('src') ?? '';
        if (!isRelativeUrl(src)) continue;
        const resolved = resolvePath(base, src);
        if (!resolved) continue;
        void blobUrlFor(resolved.path).then((url) => {
          if (disposed) return;
          if (url) {
            img.removeAttribute('data-broken');
            if (img.getAttribute('src') !== url) img.setAttribute('src', url);
          } else img.setAttribute('data-broken', 'true');
        });
      }
    };

    const markBrokenLinks = (): void => {
      for (const a of Array.from(container.querySelectorAll('a[href]'))) {
        const href = a.getAttribute('href') ?? '';
        if (!isRelativeUrl(href)) continue;
        const resolved = resolvePath(base, href);
        if (!resolved || resolved.path === base) continue;
        let missing: boolean;
        if (isAssetPath(resolved.path)) {
          // Checked only when the space lists its files.
          if (!links.hasFile) continue;
          missing = !links.hasFile(resolved.path);
        } else missing = pageIdForPath(resolved.path, links.hasPage) === null;
        if (missing) a.setAttribute('data-broken', 'true');
        else a.removeAttribute('data-broken');
      }
    };

    const refresh = (): void => {
      resolveImages();
      markBrokenLinks();
    };
    remark.current = markBrokenLinks;
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['src', 'href'],
    });

    const onClick = (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) return;
      const a = event.target.closest('a[href]');
      if (!a || !container.contains(a)) return;
      const href = a.getAttribute('href') ?? '';
      if (!isRelativeUrl(href)) return;
      // An editable page keeps plain clicks for the caret.
      if (editable && !(event.metaKey || event.ctrlKey)) return;
      // A relative href would otherwise load a URL under the app.
      event.preventDefault();
      const target = targetOf(links, href);
      if (!target || target.id === null) return;
      if (target.id === links.pageId) {
        if (target.anchor) scrollToHeading(container, target.anchor);
        return;
      }
      links.onNavigate(target.id, target.anchor);
    };
    container.addEventListener('click', onClick);

    return () => {
      disposed = true;
      remark.current = null;
      observer.disconnect();
      container.removeEventListener('click', onClick);
      for (const url of blobUrls.values()) URL.revokeObjectURL(url);
      blobUrls.clear();
    };
  }, [containerRef, pageId, editable]);

  // A new page tree can make a broken link good (or the reverse).
  useEffect(() => {
    remark.current?.();
  }, [hasPage, hasFile]);
}
