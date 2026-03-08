// Stub file — replaced at build time for preview deploys with docs content
// from the main branch. When populated, this provides a "Docs (Live)" space
// so reviewers can compare production docs against the PR's version.
//
// See scripts/generate-live-docs.sh for the build-time generator.

import type { PageTreeNode } from '../sidebar/PageTreeItem.js';

/** Whether live docs were populated at build time. */
export const LIVE_DOCS_AVAILABLE = false;

/** Page tree for live docs (null when unavailable). */
export const LIVE_DOCS_PAGES: PageTreeNode[] | null = null;

/** Content map for live docs (null when unavailable). */
export const LIVE_DOCS_CONTENT: Record<string, string> | null = null;

/** Space info for live docs (null when unavailable). */
export const LIVE_DOCS_SPACE_INFO: {
  id: string;
  name: string;
  source: string;
  pageCount: number;
  contentSize: number;
} | null = null;

/** Get GitHub source URL for a live docs page (no-op when unavailable). */
export function getLiveDocsSourceUrl(_pageId: string): string | undefined {
  return undefined;
}

/** Resolve {{base}} placeholders in live docs content. */
export function resolveLiveDocsContent(content: string): string {
  return content;
}
