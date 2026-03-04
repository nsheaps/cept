/**
 * NotionImporter — Imports Notion export ZIP files into Cept.
 *
 * Notion exports produce a ZIP containing:
 * - Markdown (.md) files for pages
 * - CSV files for database views
 * - Nested directory structure matching the page tree
 * - Embedded images and attachments
 *
 * This importer converts the Notion export format into Cept's
 * page tree structure, preserving hierarchy, links, and metadata.
 */

export interface NotionImportOptions {
  /** Root path to import into. Default: '/' */
  targetPath?: string;
  /** Whether to convert Notion-style links to Cept wiki-links. Default: true */
  convertLinks?: boolean;
  /** Whether to import database CSV files. Default: true */
  importDatabases?: boolean;
  /** Whether to import embedded images. Default: true */
  importImages?: boolean;
  /** Maximum file size in bytes to import. Default: 50MB */
  maxFileSize?: number;
}

export interface ImportedPage {
  /** Original path in the ZIP */
  sourcePath: string;
  /** Target path in Cept */
  targetPath: string;
  /** Page title extracted from filename or first heading */
  title: string;
  /** Converted Markdown content */
  content: string;
  /** Whether this is a database page */
  isDatabase: boolean;
  /** Child page paths */
  children: string[];
}

export interface ImportedAsset {
  /** Original path in the ZIP */
  sourcePath: string;
  /** Target path in Cept */
  targetPath: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Binary data */
  data: Uint8Array;
}

export interface NotionImportResult {
  /** Successfully imported pages */
  pages: ImportedPage[];
  /** Imported assets (images, attachments) */
  assets: ImportedAsset[];
  /** Errors encountered during import */
  errors: ImportError[];
  /** Total files processed */
  totalFiles: number;
  /** Files skipped */
  skippedFiles: number;
}

export interface ImportError {
  path: string;
  message: string;
}

export interface ImportProgress {
  /** Current file being processed */
  currentFile: string;
  /** Number of files processed so far */
  processed: number;
  /** Total files to process */
  total: number;
  /** Progress percentage (0-100) */
  percent: number;
}

export type ProgressCallback = (progress: ImportProgress) => void;

/** Represents a file entry in a ZIP archive */
export interface ZipEntry {
  path: string;
  isDirectory: boolean;
  getData(): Promise<Uint8Array>;
}

/** Abstraction for ZIP file reading (platform-specific implementations) */
export interface ZipReader {
  getEntries(): Promise<ZipEntry[]>;
  close(): Promise<void>;
}

const DEFAULT_OPTIONS: Required<NotionImportOptions> = {
  targetPath: '/',
  convertLinks: true,
  importDatabases: true,
  importImages: true,
  maxFileSize: 50 * 1024 * 1024,
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp']);
const ASSET_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, '.pdf', '.mp3', '.mp4', '.zip']);

/**
 * Clean a Notion-exported filename by removing the UUID suffix.
 * Notion appends a 32-char hex ID: "Page Name abc123def456.md"
 */
export function cleanNotionFilename(filename: string): string {
  // Remove extension first
  const ext = getExtension(filename);
  const base = ext ? filename.slice(0, -ext.length) : filename;

  // Notion appends a space + 32-char hex ID
  const cleaned = base.replace(/\s+[0-9a-f]{32}$/i, '');
  return cleaned.trim() + ext;
}

/**
 * Convert Notion-style internal links to Cept wiki-links.
 * Notion exports links like: [Page Name](Page%20Name%20abc123.md)
 */
export function convertNotionLinks(
  content: string,
  pathMap: Map<string, string>,
): string {
  // Match markdown links: [text](url)
  return content.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (match, text: string, href: string) => {
      // Skip external links
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return match;
      }

      // Decode URL encoding
      const decodedHref = decodeURIComponent(href);

      // Look up the target path
      const targetPath = pathMap.get(decodedHref);
      if (targetPath) {
        return `[[${targetPath}|${text}]]`;
      }

      // Try matching by cleaned filename
      for (const [source, target] of pathMap) {
        if (cleanNotionFilename(source) === cleanNotionFilename(decodedHref)) {
          return `[[${target}|${text}]]`;
        }
      }

      return match;
    },
  );
}

/**
 * Extract title from a Notion-exported page.
 * Uses the first H1 heading if present, otherwise the filename.
 */
export function extractTitle(content: string, filename: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }
  // Fall back to cleaned filename without extension
  const ext = getExtension(filename);
  const base = ext ? filename.slice(0, -ext.length) : filename;
  return cleanNotionFilename(base + ext).replace(/\.[^.]+$/, '');
}

/**
 * Determine MIME type from file extension.
 */
export function getMimeType(filename: string): string {
  const ext = getExtension(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.pdf': 'application/pdf',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.zip': 'application/zip',
    '.csv': 'text/csv',
  };
  return mimeMap[ext] ?? 'application/octet-stream';
}

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
  const ext = getExtension(path).toLowerCase();
  return ext === '.md' || ext === '.markdown';
}

function isCsv(path: string): boolean {
  return getExtension(path).toLowerCase() === '.csv';
}

function isAsset(path: string): boolean {
  return ASSET_EXTENSIONS.has(getExtension(path).toLowerCase());
}

/**
 * Import a Notion export ZIP file.
 */
export async function importNotionZip(
  zipReader: ZipReader,
  options?: NotionImportOptions,
  onProgress?: ProgressCallback,
): Promise<NotionImportResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const result: NotionImportResult = {
    pages: [],
    assets: [],
    errors: [],
    totalFiles: 0,
    skippedFiles: 0,
  };

  let entries: ZipEntry[];
  try {
    entries = await zipReader.getEntries();
  } catch (e) {
    result.errors.push({ path: '', message: `Failed to read ZIP: ${(e as Error).message}` });
    return result;
  }

  // Filter out directories
  const fileEntries = entries.filter((e) => !e.isDirectory);
  result.totalFiles = fileEntries.length;

  // Build a path map for link conversion: source path -> target path
  const pathMap = new Map<string, string>();
  for (const entry of fileEntries) {
    if (isMarkdown(entry.path)) {
      const cleanPath = cleanNotionFilename(entry.path);
      const targetPath = joinPath(opts.targetPath, cleanPath);
      pathMap.set(entry.path, targetPath);
    }
  }

  // Process each file
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
        const title = extractTitle(textContent, normalizedPath);

        let content = textContent;
        if (opts.convertLinks) {
          content = convertNotionLinks(content, pathMap);
        }

        const targetPath = pathMap.get(entry.path) ?? joinPath(opts.targetPath, normalizedPath);

        // Determine children by looking for pages in subdirectories
        const dir = normalizedPath.replace(/\/[^/]+$/, '');
        const children = fileEntries
          .filter((e) => {
            const p = normalizePath(e.path);
            return p !== normalizedPath && p.startsWith(dir + '/') && isMarkdown(p) &&
              p.replace(dir + '/', '').split('/').length <= 2;
          })
          .map((e) => pathMap.get(e.path) ?? normalizePath(e.path));

        result.pages.push({
          sourcePath: normalizedPath,
          targetPath,
          title,
          content,
          isDatabase: false,
          children,
        });
      } else if (isCsv(normalizedPath) && opts.importDatabases) {
        const data = await entry.getData();
        const textContent = new TextDecoder().decode(data);
        const title = extractTitle('', normalizedPath);
        const targetPath = joinPath(opts.targetPath, cleanNotionFilename(normalizedPath));

        result.pages.push({
          sourcePath: normalizedPath,
          targetPath,
          title,
          content: textContent,
          isDatabase: true,
          children: [],
        });
      } else if (isAsset(normalizedPath) && opts.importImages) {
        const data = await entry.getData();
        if (data.length > opts.maxFileSize) {
          result.skippedFiles++;
          result.errors.push({ path: normalizedPath, message: 'Asset exceeds maximum size' });
          continue;
        }

        result.assets.push({
          sourcePath: normalizedPath,
          targetPath: joinPath(opts.targetPath, cleanNotionFilename(normalizedPath)),
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

  await zipReader.close();
  return result;
}
