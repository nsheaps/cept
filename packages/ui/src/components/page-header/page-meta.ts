import { readFrontMatter, setFrontMatterKey, splitFrontMatter } from '@cept/core';

/** The page header's metadata, stored in the page's front matter (REQ-EDT-026). */
export type PageMetaKey = 'icon' | 'cover';

export interface PageMeta {
  icon?: string;
  cover?: string;
}

/**
 * Set (or, with `undefined`, remove) a page's icon or cover. Only that key's
 * lines change; the rest of the file is kept byte for byte.
 */
export function setPageMeta(text: string, key: PageMetaKey, value: string | undefined): string {
  return setFrontMatterKey(text, key, value);
}

/** The icon and cover a page's front matter declares. */
export function readPageMeta(text: string): PageMeta {
  const { icon, cover } = readFrontMatter(splitFrontMatter(text).yaml);
  return { ...(icon !== undefined ? { icon } : {}), ...(cover !== undefined ? { cover } : {}) };
}

/**
 * The sidebar changes that follow a page's front matter. A key the file now
 * has is set; a key the file had when last synced and no longer has is cleared
 * (`undefined`); a key the file never had is left alone, since an icon can also
 * come from the sidebar's own state.
 */
export function metaSyncPatches(
  synced: PageMeta,
  current: PageMeta,
): Array<[PageMetaKey, string | undefined]> {
  const patches: Array<[PageMetaKey, string | undefined]> = [];
  for (const key of ['icon', 'cover'] as const) {
    if (current[key] !== undefined || synced[key] !== undefined) patches.push([key, current[key]]);
  }
  return patches;
}
