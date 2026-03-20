/**
 * git-space — Utilities for cloning a remote Git repository into a Cept space.
 *
 * Handles the full flow: clone → read files → build page tree → save as space.
 * Works in the browser via isomorphic-git + lightning-fs.
 */

import { GitBackend, BrowserFsBackend } from '@cept/core';
import type { GitHttp, GitFs } from '@cept/core';
import type { PageTreeNode } from '../sidebar/PageTreeItem.js';

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
 *
 * @param backend - The BrowserFsBackend to use for storage
 * @param http - The HTTP client (isomorphic-git/http/web for browsers)
 * @param url - Repository URL (e.g., "github.com/user/repo")
 * @param branch - Branch to clone (default: "main")
 * @param subPath - Optional sub-path to scope the space to (e.g., "docs/")
 * @param corsProxy - Optional CORS proxy URL for browser environments
 */
export async function cloneRemoteRepo(
  backend: BrowserFsBackend,
  http: GitHttp,
  url: string,
  branch: string = 'main',
  subPath?: string,
  corsProxy?: string,
): Promise<ClonedSpaceData> {
  const normalizedUrl = normalizeRepoUrl(url);

  // Use a dedicated directory for the git clone within lightning-fs
  const cloneDir = `/.cept/git-clones/${Date.now()}`;

  // Create a GitBackend wrapping the same BrowserFsBackend
  const gitBackend = new GitBackend({
    underlying: backend,
    dir: cloneDir,
    fs: backend.getRawFs() as unknown as GitFs,
    http,
    corsProxy,
  });

  // Shallow clone for speed — we only need the latest snapshot
  await gitBackend.clone(normalizedUrl, {
    ref: branch,
    depth: 1,
    singleBranch: true,
  });

  // Read markdown files from the cloned repo
  const prefix = subPath ? subPath.replace(/^\//, '').replace(/\/$/, '') : '';
  const scanDir = prefix ? `${cloneDir}/${prefix}` : cloneDir;
  const pages: PageTreeNode[] = [];
  const pageContents: Record<string, string> = {};

  await walkMarkdownFiles(backend, scanDir, '', pages, pageContents);

  // Clean up the clone directory (we've extracted the content)
  // Leave it for now — could be used for future fetch/sync operations
  // TODO: Consider keeping the clone for incremental updates

  return { pages, pageContents };
}

/**
 * Recursively walk a directory and collect markdown files as pages.
 */
async function walkMarkdownFiles(
  backend: BrowserFsBackend,
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
  const files = entries.filter((e) => e.isFile && (e.name.endsWith('.md') || e.name.endsWith('.markdown')));

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  // Process markdown files
  for (const file of files) {
    const filePath = relativePath ? `${relativePath}/${file.name}` : file.name;
    const pageId = `git-${filePath.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
    const title = extractTitleFromFilename(file.name);

    // Read the file content
    const fullPath = `${baseDir}/${filePath}`;
    const data = await backend.readFile(fullPath);
    if (data) {
      const content = new TextDecoder().decode(data);
      const strippedContent = stripYamlFrontMatter(content);

      // Try to extract title from first heading
      const headingTitle = extractTitleFromContent(strippedContent);

      pageContents[pageId] = strippedContent;
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
    const folderId = `git-${dirPath.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
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

/** Strip YAML front matter from markdown content */
function stripYamlFrontMatter(md: string): string {
  return md.replace(/^---[\s\S]*?---\n*/m, '');
}

/** Extract a human-readable title from a markdown filename */
function extractTitleFromFilename(filename: string): string {
  const name = filename.replace(/\.(md|markdown)$/, '');
  if (name === 'index' || name === 'README') return 'Index';
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Extract title from the first H1 heading in markdown content */
function extractTitleFromContent(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}
