/**
 * ObsidianImporter — Imports Obsidian vault directories into Cept.
 *
 * Obsidian vaults contain:
 * - Markdown (.md) files with wiki-link syntax [[Page Name]]
 * - YAML front matter for metadata
 * - `.obsidian/` config directory (ignored)
 * - Attachments in configurable folders
 * - Tags via #tag syntax and front matter
 *
 * This importer converts the vault structure into Cept's page tree,
 * preserving wiki-links, tags, and front matter metadata.
 */

import type { ImportedPage, ImportedAsset, ImportError, ProgressCallback } from './notion-importer.js';
import { getMimeType } from './notion-importer.js';

export interface ObsidianImportOptions {
  /** Root path to import into. Default: '/' */
  targetPath?: string;
  /** Whether to convert Obsidian wiki-links to Cept format. Default: true */
  convertLinks?: boolean;
  /** Whether to import attachments. Default: true */
  importAttachments?: boolean;
  /** Paths to ignore (glob-like patterns). Default: ['.obsidian', '.trash'] */
  ignorePaths?: string[];
  /** Maximum file size in bytes. Default: 50MB */
  maxFileSize?: number;
}

export interface ObsidianImportResult {
  /** Successfully imported pages */
  pages: ImportedPage[];
  /** Imported assets */
  assets: ImportedAsset[];
  /** Errors encountered */
  errors: ImportError[];
  /** Total files processed */
  totalFiles: number;
  /** Files skipped */
  skippedFiles: number;
  /** Tags found across all pages */
  tags: string[];
}

/** Represents a file in the vault (abstraction for platform-specific file reading) */
export interface VaultFile {
  /** Relative path from vault root */
  path: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Read file contents as bytes */
  getData(): Promise<Uint8Array>;
}

/** Abstraction for reading a vault directory */
export interface VaultReader {
  /** List all files recursively */
  listFiles(): Promise<VaultFile[]>;
}

const DEFAULT_OPTIONS: Required<ObsidianImportOptions> = {
  targetPath: '/',
  convertLinks: true,
  importAttachments: true,
  ignorePaths: ['.obsidian', '.trash'],
  maxFileSize: 50 * 1024 * 1024,
};

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const ATTACHMENT_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp',
  '.pdf', '.mp3', '.mp4', '.wav', '.ogg',
]);

function getExtension(path: string): string {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return '';
  const slash = path.lastIndexOf('/');
  if (dot < slash) return '';
  return path.slice(dot);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

function joinPath(base: string, child: string): string {
  const b = base.endsWith('/') ? base : base + '/';
  const c = child.startsWith('/') ? child.slice(1) : child;
  return normalizePath(b + c);
}

function isMarkdown(path: string): boolean {
  return MARKDOWN_EXTENSIONS.has(getExtension(path).toLowerCase());
}

function isAttachment(path: string): boolean {
  return ATTACHMENT_EXTENSIONS.has(getExtension(path).toLowerCase());
}

function shouldIgnore(path: string, ignorePaths: string[]): boolean {
  const normalized = normalizePath(path);
  return ignorePaths.some((pattern) => {
    const normalizedPattern = normalizePath(pattern);
    return normalized === normalizedPattern ||
      normalized.startsWith(normalizedPattern + '/') ||
      normalized.split('/').includes(normalizedPattern);
  });
}

/**
 * Extract tags from Obsidian markdown content.
 * Matches both inline #tags and front matter tags.
 */
export function extractTags(content: string): string[] {
  const tags = new Set<string>();

  // Extract front matter tags
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fmContent = fmMatch[1];
    const tagLine = fmContent.match(/^tags:\s*\[([^\]]*)\]/m);
    if (tagLine) {
      tagLine[1].split(',').forEach((t) => {
        const trimmed = t.trim().replace(/^["']|["']$/g, '');
        if (trimmed) tags.add(trimmed);
      });
    }
    // YAML list format
    const tagListMatch = fmContent.match(/^tags:\s*\n((?:\s*-\s+.+\n?)*)/m);
    if (tagListMatch) {
      tagListMatch[1].split('\n').forEach((line) => {
        const m = line.match(/^\s*-\s+(.+)/);
        if (m) tags.add(m[1].trim().replace(/^["']|["']$/g, ''));
      });
    }
  }

  // Extract inline #tags (not inside code blocks or links)
  const withoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  const inlineTags = withoutCode.matchAll(/(?:^|\s)#([a-zA-Z][\w/-]*)/g);
  for (const match of inlineTags) {
    tags.add(match[1]);
  }

  return [...tags];
}

/**
 * Convert Obsidian wiki-links to Cept format.
 * Obsidian: [[Page Name]] or [[Page Name|Display Text]] or [[Page Name#Heading]]
 * Cept:     [[/target/Page Name]] or [[/target/Page Name|Display Text]]
 */
export function convertObsidianLinks(
  content: string,
  pageMap: Map<string, string>,
): string {
  return content.replace(
    /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g,
    (_match, pageName: string, heading: string | undefined, displayText: string | undefined) => {
      const targetPath = pageMap.get(pageName.trim());
      const display = displayText ?? pageName.trim();
      if (targetPath) {
        const fragment = heading ? `#${heading}` : '';
        return `[[${targetPath}${fragment}|${display}]]`;
      }
      // Try case-insensitive match
      for (const [name, path] of pageMap) {
        if (name.toLowerCase() === pageName.trim().toLowerCase()) {
          const fragment = heading ? `#${heading}` : '';
          return `[[${path}${fragment}|${display}]]`;
        }
      }
      // Return as-is if not resolvable
      return `[[${pageName.trim()}${heading ? '#' + heading : ''}${displayText ? '|' + displayText : ''}]]`;
    },
  );
}

/**
 * Extract title from Obsidian page content.
 * Checks front matter `title:`, then first H1, then filename.
 */
export function extractObsidianTitle(content: string, filename: string): string {
  // Check front matter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const titleMatch = fmMatch[1].match(/^title:\s*(.+)$/m);
    if (titleMatch) return titleMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  // Check first H1
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();

  // Fall back to filename without extension
  const ext = getExtension(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
}

/**
 * Import an Obsidian vault.
 */
export async function importObsidianVault(
  vaultReader: VaultReader,
  options?: ObsidianImportOptions,
  onProgress?: ProgressCallback,
): Promise<ObsidianImportResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const result: ObsidianImportResult = {
    pages: [],
    assets: [],
    errors: [],
    totalFiles: 0,
    skippedFiles: 0,
    tags: [],
  };

  let files: VaultFile[];
  try {
    files = await vaultReader.listFiles();
  } catch (e) {
    result.errors.push({ path: '', message: `Failed to read vault: ${(e as Error).message}` });
    return result;
  }

  // Filter out directories and ignored paths
  const fileEntries = files.filter(
    (f) => !f.isDirectory && !shouldIgnore(f.path, opts.ignorePaths),
  );
  result.totalFiles = fileEntries.length;

  // Build page name -> target path map for link resolution
  const pageMap = new Map<string, string>();
  for (const entry of fileEntries) {
    if (isMarkdown(entry.path)) {
      const name = normalizePath(entry.path).replace(/\.md$/, '');
      const basename = name.split('/').pop() ?? name;
      const targetPath = joinPath(opts.targetPath, entry.path);
      pageMap.set(basename, targetPath);
    }
  }

  const allTags = new Set<string>();

  for (let i = 0; i < fileEntries.length; i++) {
    const entry = fileEntries[i];
    const normalizedPath = normalizePath(entry.path);

    if (onProgress) {
      onProgress({
        currentFile: normalizedPath,
        processed: i,
        total: fileEntries.length,
        percent: Math.round((i / fileEntries.length) * 100),
      });
    }

    try {
      if (isMarkdown(normalizedPath)) {
        const data = await entry.getData();
        if (data.length > opts.maxFileSize) {
          result.skippedFiles++;
          result.errors.push({ path: normalizedPath, message: 'File exceeds maximum size' });
          continue;
        }

        const textContent = new TextDecoder().decode(data);
        const title = extractObsidianTitle(textContent, normalizedPath);
        const tags = extractTags(textContent);
        tags.forEach((t) => allTags.add(t));

        let content = textContent;
        if (opts.convertLinks) {
          content = convertObsidianLinks(content, pageMap);
        }

        const targetPath = joinPath(opts.targetPath, normalizedPath);

        result.pages.push({
          sourcePath: normalizedPath,
          targetPath,
          title,
          content,
          isDatabase: false,
          children: [],
        });
      } else if (isAttachment(normalizedPath) && opts.importAttachments) {
        const data = await entry.getData();
        if (data.length > opts.maxFileSize) {
          result.skippedFiles++;
          result.errors.push({ path: normalizedPath, message: 'Asset exceeds maximum size' });
          continue;
        }

        result.assets.push({
          sourcePath: normalizedPath,
          targetPath: joinPath(opts.targetPath, normalizedPath),
          mimeType: getMimeType(normalizedPath),
          size: data.length,
          data,
        });
      } else {
        result.skippedFiles++;
      }
    } catch (e) {
      result.errors.push({
        path: normalizedPath,
        message: `Failed to process: ${(e as Error).message}`,
      });
    }
  }

  if (onProgress) {
    onProgress({
      currentFile: '',
      processed: fileEntries.length,
      total: fileEntries.length,
      percent: 100,
    });
  }

  result.tags = [...allTags].sort();
  return result;
}
