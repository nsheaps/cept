/**
 * docs-loader — Bootstrap the built-in "Cept Docs" space as a real remote
 * space in the manifest.
 *
 * On first open the loader attempts to clone `github.com/nsheaps/cept` scoped
 * to `docs/content/` using the same `cloneRemoteRepo` infrastructure that
 * every other remote space uses.  If cloning fails (offline, CORS, etc.) the
 * bundled constants from `docs-content.ts` are written into the space instead
 * so the user always sees documentation.
 *
 * After creation the docs space is a normal remote space — the same sidebar,
 * settings panel, refresh button, and "View on GitHub" links apply.
 */

import type { PageTreeNode } from '../sidebar/PageTreeItem.js';
import { BrowserFsBackend } from '@cept/core';
import type { GitHttp } from '@cept/core';
import { cloneRemoteRepo, normalizeRepoUrl } from '../storage/git-space.js';
import {
  createRemoteSpace as createRemoteSpaceInBackend,
  loadSpaces,
  generateRemoteSpaceId,
} from '../storage/SpaceManager.js';
import { saveSpaceState, writeSpacePageContent } from '../storage/StorageContext.js';
import { DOCS_PAGES, DOCS_CONTENT, resolveDocsContent } from './docs-content.js';

export const DOCS_REPO_URL = 'github.com/nsheaps/cept';
/** Use the PR branch for preview deploys, fall back to 'main' for production. */
export const DOCS_BRANCH = typeof __HEAD_BRANCH__ !== 'undefined' && __HEAD_BRANCH__ ? __HEAD_BRANCH__ : 'main';
export const DOCS_SUB_PATH = 'docs/content';
const CORS_PROXY = 'https://cors.isomorphic-git.org';

/** The deterministic space ID for the docs space. */
export const DOCS_SPACE_ID = generateRemoteSpaceId(
  normalizeRepoUrl(DOCS_REPO_URL),
  DOCS_BRANCH,
  DOCS_SUB_PATH,
);

/** Human-readable display name for the docs space. */
export const DOCS_DISPLAY_NAME = 'Cept Docs';

/**
 * Resolve `{{base}}` placeholders in all bundled content strings.
 */
function resolveAllContent(contents: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [id, content] of Object.entries(contents)) {
    resolved[id] = resolveDocsContent(content);
  }
  return resolved;
}

/**
 * Ensure the docs space exists in the manifest.  If it already exists, returns
 * its space ID immediately.  Otherwise creates it by:
 *   1. Attempting to clone from GitHub (same as any remote space)
 *   2. Falling back to bundled DOCS_PAGES / DOCS_CONTENT if clone fails
 *
 * @returns The space ID of the docs space.
 */
export async function ensureDocsSpace(
  backend: BrowserFsBackend,
  onStatus?: (message: string) => void,
): Promise<string> {
  // Check if the docs space already exists in the manifest
  const manifest = await loadSpaces(backend);
  const existing = manifest.spaces.find((s) => s.id === DOCS_SPACE_ID);
  if (existing) {
    return DOCS_SPACE_ID;
  }

  // Try to clone from remote
  let pages: PageTreeNode[];
  let pageContents: Record<string, string>;

  try {
    onStatus?.('Cloning documentation from GitHub...');
    const httpModule = await import('isomorphic-git/http/web');
    const gitHttp: GitHttp = httpModule.default as GitHttp;

    const cloned = await cloneRemoteRepo(
      backend,
      gitHttp,
      DOCS_REPO_URL,
      DOCS_BRANCH,
      DOCS_SUB_PATH,
      CORS_PROXY,
    );
    pages = cloned.pages;
    pageContents = cloned.pageContents;
    onStatus?.('Documentation loaded from GitHub');
  } catch {
    // Clone failed — use bundled content
    onStatus?.('Using bundled documentation (offline fallback)');
    pages = DOCS_PAGES;
    pageContents = resolveAllContent(DOCS_CONTENT);
  }

  // Create the space in the manifest (same as any other remote space)
  const newSpace = await createRemoteSpaceInBackend(
    backend,
    DOCS_DISPLAY_NAME,
    normalizeRepoUrl(DOCS_REPO_URL),
    DOCS_BRANCH,
    DOCS_SUB_PATH,
  );

  // Persist pages and content into per-space storage
  await saveSpaceState(backend, newSpace.id, {
    pages,
    favorites: [],
    recentPages: [],
    selectedPageId: pages[0]?.id,
    spaceName: DOCS_DISPLAY_NAME,
  });

  for (const [pageId, content] of Object.entries(pageContents)) {
    if (content) {
      await writeSpacePageContent(backend, newSpace.id, pageId, content);
    }
  }

  return newSpace.id;
}
