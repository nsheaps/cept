/**
 * docs-loader — Load documentation from the remote Git repository with
 * bundled fallback.
 *
 * On first load (no cache), attempts to clone `github.com/nsheaps/cept`
 * scoped to the `docs/content` subdirectory.  Cloned pages and content are
 * cached in the StorageBackend so subsequent loads are instant.
 *
 * When cloning fails (offline, CORS, network issues) the bundled constants
 * from `docs-content.ts` are used as a fallback.
 */

import type { PageTreeNode } from '../sidebar/PageTreeItem.js';
import { BrowserFsBackend } from '@cept/core';
import type { GitHttp } from '@cept/core';
import { cloneRemoteRepo } from '../storage/git-space.js';
import { DOCS_PAGES, DOCS_CONTENT, resolveDocsContent, getDocsSourceUrl } from './docs-content.js';

/** Result of loading docs (from remote or fallback). */
export interface DocsLoadResult {
  pages: PageTreeNode[];
  pageContents: Record<string, string>;
  /** Where the content came from */
  source: 'remote' | 'cache' | 'bundled';
}

const DOCS_REPO_URL = 'github.com/nsheaps/cept';
const DOCS_BRANCH = 'main';
const DOCS_SUB_PATH = 'docs/content';
const CORS_PROXY = 'https://cors.isomorphic-git.org';

/** Storage paths for cached remote docs */
const CACHE_DIR = '.cept/docs-cache';
const CACHE_PAGES_FILE = `${CACHE_DIR}/pages.json`;
const CACHE_CONTENTS_FILE = `${CACHE_DIR}/contents.json`;
const CACHE_META_FILE = `${CACHE_DIR}/meta.json`;

function encode(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decode<T>(data: Uint8Array | null): T | null {
  if (!data) return null;
  try {
    return JSON.parse(new TextDecoder().decode(data)) as T;
  } catch {
    return null;
  }
}

/** Read cached docs from the backend, if they exist. */
async function readCache(backend: BrowserFsBackend): Promise<DocsLoadResult | null> {
  try {
    const [pagesData, contentsData, metaData] = await Promise.all([
      backend.readFile(CACHE_PAGES_FILE),
      backend.readFile(CACHE_CONTENTS_FILE),
      backend.readFile(CACHE_META_FILE),
    ]);
    if (!pagesData || !contentsData || !metaData) return null;
    const pages = decode<PageTreeNode[]>(pagesData);
    const pageContents = decode<Record<string, string>>(contentsData);
    if (!pages || !pageContents) return null;
    return { pages, pageContents, source: 'cache' };
  } catch {
    return null;
  }
}

/** Write cloned docs to the cache. */
async function writeCache(
  backend: BrowserFsBackend,
  pages: PageTreeNode[],
  pageContents: Record<string, string>,
): Promise<void> {
  try {
    // Ensure cache directory exists
    const exists = await backend.exists(CACHE_DIR);
    if (!exists) {
      await backend.writeFile(`${CACHE_DIR}/.gitkeep`, new Uint8Array(0));
    }
    await Promise.all([
      backend.writeFile(CACHE_PAGES_FILE, encode(pages)),
      backend.writeFile(CACHE_CONTENTS_FILE, encode(pageContents)),
      backend.writeFile(CACHE_META_FILE, encode({
        clonedAt: new Date().toISOString(),
        repo: DOCS_REPO_URL,
        branch: DOCS_BRANCH,
        subPath: DOCS_SUB_PATH,
      })),
    ]);
  } catch {
    // Cache write failures are non-fatal
  }
}

/**
 * Resolve `{{base}}` placeholders in all page contents.
 * Remote-cloned docs won't have these, but bundled fallback content does.
 */
function resolveAllContent(contents: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [id, content] of Object.entries(contents)) {
    resolved[id] = resolveDocsContent(content);
  }
  return resolved;
}

/**
 * Load docs: try cache → try remote clone → fall back to bundled.
 *
 * @param backend - The BrowserFsBackend (needed for cache and clone)
 * @param forceRefresh - Skip cache and re-clone from remote
 * @param onStatus - Optional callback for status messages
 */
export async function loadDocs(
  backend: BrowserFsBackend | null,
  forceRefresh: boolean = false,
  onStatus?: (message: string) => void,
): Promise<DocsLoadResult> {
  // If no BrowserFsBackend, go straight to bundled fallback
  if (!backend) {
    return {
      pages: DOCS_PAGES,
      pageContents: resolveAllContent(DOCS_CONTENT),
      source: 'bundled',
    };
  }

  // 1. Try cache (unless force-refreshing)
  if (!forceRefresh) {
    const cached = await readCache(backend);
    if (cached) {
      return cached;
    }
  }

  // 2. Try remote clone
  onStatus?.('Cloning documentation from GitHub...');
  try {
    const httpModule = await import('isomorphic-git/http/web');
    const gitHttp: GitHttp = httpModule.default as GitHttp;

    const { pages, pageContents } = await cloneRemoteRepo(
      backend,
      gitHttp,
      DOCS_REPO_URL,
      DOCS_BRANCH,
      DOCS_SUB_PATH,
      CORS_PROXY,
    );

    // Cache the result for next time
    await writeCache(backend, pages, pageContents);

    onStatus?.('Documentation loaded from GitHub');
    return { pages, pageContents, source: 'remote' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onStatus?.(`Could not load remote docs (${message}), using bundled content`);
  }

  // 3. Fall back to bundled content
  return {
    pages: DOCS_PAGES,
    pageContents: resolveAllContent(DOCS_CONTENT),
    source: 'bundled',
  };
}

/**
 * Build a GitHub source URL for a page loaded from the remote clone.
 *
 * For remote/cached pages the pageId IS the file path relative to docs/content/
 * (e.g. "getting-started/introduction.md").
 *
 * For bundled pages we fall back to the DOCS_SOURCE_PATHS lookup.
 */
export function getRemoteDocsSourceUrl(
  pageId: string,
  source: 'remote' | 'cache' | 'bundled',
  branch: string = DOCS_BRANCH,
): string | undefined {
  if (source === 'bundled') {
    return getDocsSourceUrl(pageId) ?? undefined;
  }
  // Remote/cached: pageId is the relative file path within docs/content/
  return `https://github.com/nsheaps/cept/blob/${branch}/${DOCS_SUB_PATH}/${pageId}`;
}
