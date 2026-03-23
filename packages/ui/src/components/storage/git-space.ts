/**
 * git-space — Utilities for cloning a remote Git repository into a Cept space.
 *
 * Handles the full flow: clone → read files → build page tree → save as space.
 * Works in the browser via isomorphic-git + lightning-fs.
 */

import { GitBackend, BrowserFsBackend } from '@cept/core';
import type { GitHttp, GitFs, DirEntry } from '@cept/core';
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

/** Names that serve as folder index/readme files */
const INDEX_NAMES = new Set(['readme', 'index']);

/** Check if a filename is a folder index (README.md, index.md, etc.) */
function isFolderIndex(filename: string): boolean {
  const name = filename.replace(/\.(md|markdown)$/i, '').toLowerCase();
  return INDEX_NAMES.has(name);
}

/**
 * Configuration from a .cept.yaml file.
 * Only configuration settings, not metadata (titles come from frontmatter).
 */
export interface CeptFolderConfig {
  /** Files or directories to hide from the sidebar */
  hide?: string[];
}

/**
 * Try to read and parse a .cept.yaml file from a directory.
 * Returns null if the file doesn't exist or can't be parsed.
 */
async function readCeptYaml(backend: BrowserFsBackend, dirPath: string): Promise<CeptFolderConfig | null> {
  try {
    const data = await backend.readFile(`${dirPath}/.cept.yaml`);
    if (!data) return null;
    const content = new TextDecoder().decode(data);
    // Simple YAML parser for the subset we need (hide: [list])
    return parseCeptYaml(content);
  } catch {
    return null;
  }
}

/**
 * Minimal YAML parser for .cept.yaml files.
 * Supports: `hide:` with a list of strings (either inline `[a, b]` or block `- a`).
 */
export function parseCeptYaml(content: string): CeptFolderConfig {
  const config: CeptFolderConfig = {};
  const lines = content.split('\n');
  let inHideList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Inline array: hide: [specs, tests]
    const inlineMatch = trimmed.match(/^hide:\s*\[(.+)]$/);
    if (inlineMatch) {
      config.hide = inlineMatch[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
      inHideList = false;
      continue;
    }

    // Block list start: hide:
    if (trimmed === 'hide:') {
      config.hide = [];
      inHideList = true;
      continue;
    }

    // Block list item: - specs
    if (inHideList && trimmed.startsWith('- ')) {
      const value = trimmed.substring(2).trim().replace(/^['"]|['"]$/g, '');
      config.hide?.push(value);
      continue;
    }

    // Any non-indented key ends the list
    if (inHideList && trimmed && !trimmed.startsWith('-') && !trimmed.startsWith(' ')) {
      inHideList = false;
    }
  }

  return config;
}

/**
 * Extract YAML front matter from markdown content and return it as key-value pairs.
 * Returns null if no front matter is found.
 */
function extractFrontMatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const kvMatch = line.match(/^(\w+):\s*(.+)$/);
    if (kvMatch) {
      result[kvMatch[1]] = kvMatch[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return result;
}

/**
 * Recursively walk a directory and collect markdown files as pages.
 *
 * - README.md / index.md in a folder becomes the folder's page content
 *   (not a separate page). Frontmatter provides titles.
 * - .cept.yaml in a folder can hide files/folders from the sidebar.
 * - Applies to the folder and its subfolders.
 */
async function walkMarkdownFiles(
  backend: BrowserFsBackend,
  baseDir: string,
  relativePath: string,
  pages: PageTreeNode[],
  pageContents: Record<string, string>,
  parentHidden?: Set<string>,
): Promise<void> {
  const currentDir = relativePath ? `${baseDir}/${relativePath}` : baseDir;

  let entries;
  try {
    entries = await backend.listDirectory(currentDir);
  } catch {
    return; // Directory doesn't exist or can't be read
  }

  // Read .cept.yaml for folder configuration
  const config = await readCeptYaml(backend, currentDir);
  const hiddenSet = new Set<string>(config?.hide ?? []);
  // Merge parent's hidden patterns if applicable
  if (parentHidden) {
    for (const h of parentHidden) hiddenSet.add(h);
  }

  // Sort: directories first, then files alphabetically
  const dirs = entries.filter((e) => e.isDirectory && !e.name.startsWith('.') && !hiddenSet.has(e.name));
  const files = entries.filter((e) => e.isFile && (e.name.endsWith('.md') || e.name.endsWith('.markdown')));

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  // Separate index files (README.md, index.md) from regular files
  const indexFiles = files.filter((f) => isFolderIndex(f.name));
  const regularFiles = files.filter((f) => !isFolderIndex(f.name) && !hiddenSet.has(f.name));

  // Process regular markdown files (not index files)
  for (const file of regularFiles) {
    const filePath = relativePath ? `${relativePath}/${file.name}` : file.name;
    const pageId = filePath;

    const fullPath = `${baseDir}/${filePath}`;
    const data = await backend.readFile(fullPath);
    if (data) {
      const rawContent = new TextDecoder().decode(data);
      const frontMatter = extractFrontMatter(rawContent);
      const strippedContent = stripYamlFrontMatter(rawContent);
      const headingTitle = extractTitleFromContent(strippedContent);
      const fmTitle = frontMatter?.title;

      pageContents[pageId] = strippedContent;
      pages.push({
        id: pageId,
        title: fmTitle ?? headingTitle ?? extractTitleFromFilename(file.name),
        children: [],
      });
    }
  }

  // Process subdirectories (creating folder-style parent pages)
  for (const dir of dirs) {
    const dirPath = relativePath ? `${relativePath}/${dir.name}` : dir.name;
    const folderId = dirPath;
    let folderTitle = dir.name.charAt(0).toUpperCase() + dir.name.slice(1).replace(/-/g, ' ');

    const children: PageTreeNode[] = [];
    const folderNode: PageTreeNode = {
      id: folderId,
      title: folderTitle,
      isExpanded: false,
      children,
    };

    await walkMarkdownFiles(backend, baseDir, dirPath, children, pageContents, hiddenSet);

    // Only add the folder if it has content
    if (children.length > 0 || indexFiles.length > 0) {
      // Check subdirectory for a README/index to use as folder content
      const subDir = `${baseDir}/${dirPath}`;
      let subEntries: DirEntry[];
      try {
        subEntries = await backend.listDirectory(subDir);
      } catch {
        subEntries = [];
      }
      const subIndexFiles = subEntries.filter((e) => e.isFile && isFolderIndex(e.name));

      let folderContent: string | null = null;
      for (const idx of subIndexFiles) {
        const data = await backend.readFile(`${subDir}/${idx.name}`);
        if (data) {
          const rawContent = new TextDecoder().decode(data);
          const frontMatter = extractFrontMatter(rawContent);
          if (frontMatter?.title) {
            folderTitle = frontMatter.title;
            folderNode.title = folderTitle;
          }
          folderContent = stripYamlFrontMatter(rawContent);
          break;
        }
      }

      if (!folderContent) {
        // No README/index — auto-generate index page
        const childLinks = children.map((c) => `- **${c.title}**`).join('\n');
        folderContent = `# ${folderTitle}\n\n${childLinks}`;
      }

      pageContents[folderId] = folderContent;
      pages.push(folderNode);
    }
  }

  // If this is the root level and there are index files, use them for the space root
  // (the index file content is read by the caller for the space's root page)
  if (!relativePath) {
    for (const idx of indexFiles) {
      const fullPath = `${baseDir}/${idx.name}`;
      const data = await backend.readFile(fullPath);
      if (data) {
        const rawContent = new TextDecoder().decode(data);
        const strippedContent = stripYamlFrontMatter(rawContent);
        // Store with the index file path as page ID
        pageContents[idx.name] = strippedContent;
        const frontMatter = extractFrontMatter(rawContent);
        const headingTitle = extractTitleFromContent(strippedContent);
        pages.unshift({
          id: idx.name,
          title: frontMatter?.title ?? headingTitle ?? 'Index',
          children: [],
        });
        break; // Only use the first index file found
      }
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
