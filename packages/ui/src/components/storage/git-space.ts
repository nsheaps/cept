/**
 * git-space — Utilities for cloning a remote Git repository into a Cept space.
 *
 * Handles the full flow: clone or fetch → read files → build page tree → save
 * as space. Each remote space keeps its clone (under `/.cept/git-repos/`), so a
 * refresh fetches only what changed. The git work (transport, isomorphic-git)
 * lives in `@cept/core`; this module turns the cloned Markdown into pages.
 */

import { GitAuthRequiredError, remoteCloneDir, syncRemoteClone } from '@cept/core';
import type { GitAuth, GitFs, StorageBackend } from '@cept/core';
import type { PageTreeNode } from '../sidebar/PageTreeItem.js';

/**
 * A backend that can hand isomorphic-git its raw filesystem, which a clone
 * needs (today: the IndexedDB-backed browser backend).
 */
export interface GitCloneHost extends StorageBackend {
  getRawFs(): unknown;
}

/** Whether `backend` can host a Git clone. */
export function canHostGitClone(backend: StorageBackend): backend is GitCloneHost {
  return typeof (backend as Partial<GitCloneHost>).getRawFs === 'function';
}

/** Result of cloning a remote repo into a space */
export interface ClonedSpaceData {
  pages: PageTreeNode[];
  pageContents: Record<string, string>;
  /** `token` when the clone used the GitHub sign-in, which makes the space writable-capable (D-42). */
  access: 'anonymous' | 'token';
}

export interface CloneRemoteOptions {
  /** The space the clone belongs to; its clone is kept and fetched into on refresh. */
  spaceId: string;
  /** Repository URL (e.g., "github.com/user/repo"). */
  url: string;
  /** Branch to track (default: "main"). */
  branch?: string;
  /** Optional sub-path to scope the space to (e.g., "docs/"). */
  subPath?: string;
  /** Optional CORS proxy URL for browser environments. */
  corsProxy?: string;
  /** The GitHub sign-in; sent only to github.com. */
  auth?: GitAuth;
}

/**
 * Normalize a repository URL to a full HTTPS URL.
 * Handles shorthand like "github.com/user/repo" → "https://github.com/user/repo"
 */
export function normalizeRepoUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  // Remove trailing .git if present
  normalized = normalized.replace(/\.git$/, '');
  return normalized;
}

/** Whether `url` (already normalized) is a repository on github.com. */
export function isGitHubUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'github.com';
  } catch {
    return false;
  }
}

/**
 * Clone a remote Git repository, or fetch into the space's kept clone, and
 * extract its Markdown files as Cept pages. The token in `auth` is only sent
 * to github.com. A repository that needs a (different) sign-in rejects with
 * core's `GitAuthRequiredError`; see {@link cloneErrorMessage}.
 *
 * @param backend - A backend that can host the clone (see canHostGitClone)
 */
export async function cloneRemoteRepo(
  backend: GitCloneHost,
  options: CloneRemoteOptions,
): Promise<ClonedSpaceData> {
  const url = normalizeRepoUrl(options.url);
  const auth = options.auth && isGitHubUrl(url) ? options.auth : undefined;
  const prefix = options.subPath ? options.subPath.replace(/^\//, '').replace(/\/$/, '') : '';
  const { dir } = await syncRemoteClone({
    host: backend,
    fs: backend.getRawFs() as GitFs,
    dir: remoteCloneDir(options.spaceId),
    url,
    ref: options.branch ?? 'main',
    corsProxy: options.corsProxy,
    auth,
    // Remote spaces are read-only, so a rewritten branch just replaces the files.
    resetOnDivergence: true,
  });
  const pages: PageTreeNode[] = [];
  const pageContents: Record<string, string> = {};
  const scanDir = prefix ? `${dir}/${prefix}` : dir;
  await walkMarkdownFiles(backend, scanDir, '', pages, pageContents);
  return { pages, pageContents, access: auth ? 'token' : 'anonymous' };
}

/** What to tell the user when cloning or refreshing a remote space failed. */
export function cloneErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof GitAuthRequiredError) {
    return err.status === 401
      ? `GitHub asked for a sign-in to read ${err.url}. Sign in with a personal access token under Settings → GitHub, then try again.`
      : `Your GitHub token cannot read ${err.url}. Sign in with a token that has access under Settings → GitHub, then try again.`;
  }
  return err instanceof Error ? err.message : fallback;
}

/**
 * Recursively walk a directory and collect markdown files as pages.
 */
async function walkMarkdownFiles(
  backend: StorageBackend,
  baseDir: string,
  relativePath: string,
  pages: PageTreeNode[],
  pageContents: Record<string, string>,
): Promise<void> {
  const currentDir = relativePath ? `${baseDir}/${relativePath}` : baseDir;

  let entries;
  try {
    entries = await backend.listDirectory(currentDir);
  } catch {
    return; // Directory doesn't exist or can't be read
  }

  // Sort: directories first, then files alphabetically
  const dirs = entries.filter((e) => e.isDirectory && !e.name.startsWith('.'));
  const files = entries.filter(
    (e) => e.isFile && (e.name.endsWith('.md') || e.name.endsWith('.markdown')),
  );

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  // Process markdown files
  for (const file of files) {
    const filePath = relativePath ? `${relativePath}/${file.name}` : file.name;
    // Page ids are paths in the space, as in folder spaces.
    const pageId = filePath;
    const title = extractTitleFromFilename(file.name);

    // Read the file content
    const fullPath = `${baseDir}/${filePath}`;
    const data = await backend.readFile(fullPath);
    if (data) {
      // Keep the file as it is, front matter included (PR 46 parses it).
      const content = new TextDecoder().decode(data);
      const headingTitle = extractTitleFromContent(content);

      pageContents[pageId] = content;
      pages.push({
        id: pageId,
        title: headingTitle ?? title,
        children: [],
      });
    }
  }

  // Process subdirectories (creating folder-style parent pages)
  for (const dir of dirs) {
    const dirPath = relativePath ? `${relativePath}/${dir.name}` : dir.name;
    const folderId = dirPath;
    const folderTitle = dir.name.charAt(0).toUpperCase() + dir.name.slice(1).replace(/-/g, ' ');

    const children: PageTreeNode[] = [];
    const folderNode: PageTreeNode = {
      id: folderId,
      title: folderTitle,
      isExpanded: false,
      children,
    };

    await walkMarkdownFiles(backend, baseDir, dirPath, children, pageContents);

    // Only add the folder if it has content
    if (children.length > 0) {
      // Generate a simple index page for the folder
      const childLinks = children.map((c) => `- **${c.title}**`).join('\n');
      pageContents[folderId] = `# ${folderTitle}\n\n${childLinks}`;
      pages.push(folderNode);
    }
  }
}

/** Markdown without a leading YAML front matter block, so its `#` comments are not headings. */
function withoutFrontMatter(md: string): string {
  return md.replace(/^\uFEFF/, '').replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, '');
}

/** Extract a human-readable title from a markdown filename */
function extractTitleFromFilename(filename: string): string {
  const name = filename.replace(/\.(md|markdown)$/, '');
  if (name === 'index' || name === 'README') return 'Index';
  return name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Extract title from the first H1 heading in markdown content */
function extractTitleFromContent(content: string): string | undefined {
  const match = withoutFrontMatter(content).match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}
