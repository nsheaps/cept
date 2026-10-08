/**
 * git-space — Utilities for cloning a remote Git repository into a Cept space.
 *
 * Handles the full flow: clone → read files → build page tree → save as space.
 * The clone itself (transport, isomorphic-git, a throwaway clone directory)
 * lives in `@cept/core`; this module turns the cloned Markdown into pages.
 */

import { withShallowClone } from '@cept/core';
import type { GitFs, StorageBackend } from '@cept/core';
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

/**
 * Clone a remote Git repository and extract markdown files as Cept pages.
 * The clone is shallow and is deleted once its pages are read.
 *
 * @param backend - A backend that can host the clone (see canHostGitClone)
 * @param url - Repository URL (e.g., "github.com/user/repo")
 * @param branch - Branch to clone (default: "main")
 * @param subPath - Optional sub-path to scope the space to (e.g., "docs/")
 * @param corsProxy - Optional CORS proxy URL for browser environments
 */
export async function cloneRemoteRepo(
  backend: GitCloneHost,
  url: string,
  branch: string = 'main',
  subPath?: string,
  corsProxy?: string,
): Promise<ClonedSpaceData> {
  const prefix = subPath ? subPath.replace(/^\//, '').replace(/\/$/, '') : '';
  return withShallowClone(
    {
      host: backend,
      fs: backend.getRawFs() as GitFs,
      url: normalizeRepoUrl(url),
      ref: branch,
      corsProxy,
    },
    async (cloneDir) => {
      const pages: PageTreeNode[] = [];
      const pageContents: Record<string, string> = {};
      const scanDir = prefix ? `${cloneDir}/${prefix}` : cloneDir;
      await walkMarkdownFiles(backend, scanDir, '', pages, pageContents);
      return { pages, pageContents };
    },
  );
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
