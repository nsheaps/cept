/**
 * Space Archive — Export and import spaces as ZIP archives.
 *
 * Export: Reads all files from a space (workspace-state, pages, databases,
 *         assets) and bundles them into a ZIP with a manifest.
 * Import: Reads a ZIP, validates the manifest, and writes files into an
 *         existing or new space with configurable conflict resolution.
 *
 * The archive format:
 *   manifest.json          — space metadata + file listing
 *   workspace-state.json   — the space's persisted workspace state
 *   pages/                 — all page .md files
 *   databases/             — .cept/databases/*.yaml files
 *   assets/                — embedded images and attachments
 */

import type { StorageBackend, DirEntry } from '../storage/backend.js';

// ─── Archive Manifest ──────────────────────────────────────────────────────

export interface ArchiveManifest {
  /** Archive format version */
  version: 1;
  /** When this archive was created (ISO 8601) */
  exportedAt: string;
  /** Original space metadata */
  space: {
    id: string;
    name: string;
    icon?: string;
  };
  /** Every file in the archive (relative paths) */
  files: ArchiveFileEntry[];
}

export interface ArchiveFileEntry {
  /** Path relative to archive root */
  path: string;
  /** File size in bytes */
  size: number;
  /** SHA-256 hex digest (lowercase) for integrity checking */
  sha256: string;
}

// ─── Export Types ──────────────────────────────────────────────────────────

export interface SpaceExportOptions {
  /** Include database YAML files. Default: true */
  includeDatabases?: boolean;
  /** Include asset files (images, etc.). Default: true */
  includeAssets?: boolean;
  /** Progress callback */
  onProgress?: ExportProgressCallback;
}

export interface ExportProgress {
  phase: 'scanning' | 'reading' | 'packaging';
  currentFile: string;
  processed: number;
  total: number;
}

export type ExportProgressCallback = (progress: ExportProgress) => void;

export interface SpaceExportResult {
  /** The files to include in the ZIP */
  files: ExportFileData[];
  /** The manifest to include as manifest.json */
  manifest: ArchiveManifest;
  /** Errors encountered during export */
  errors: SpaceArchiveError[];
}

export interface ExportFileData {
  /** Path inside the ZIP archive */
  archivePath: string;
  /** File content */
  data: Uint8Array;
}

// ─── Import Types ──────────────────────────────────────────────────────────

/** How to handle a file that already exists in the target space */
export type ConflictStrategy =
  | 'keep'      // Keep the existing file, skip the incoming one
  | 'replace'   // Overwrite the existing file with the incoming one
  | 'rename'    // Import with a suffix (e.g., "page (imported).md")
  | 'skip';     // Same as 'keep' but tracked separately in results

export interface SpaceImportOptions {
  /** Import into an existing space (by ID) or create a new one */
  targetSpaceId?: string;
  /** Name for the new space (when targetSpaceId is not set). Falls back to archive name. */
  newSpaceName?: string;
  /** Default strategy for all conflicts. Default: 'skip' */
  conflictStrategy?: ConflictStrategy;
  /** Per-file conflict overrides. Key: archive path */
  fileConflictOverrides?: Record<string, ConflictStrategy>;
  /** Whether to import workspace-state.json (page tree). Default: true */
  importWorkspaceState?: boolean;
  /** Whether to merge page tree or replace it (only for existing spaces). Default: false (replace) */
  mergePageTree?: boolean;
  /** Progress callback */
  onProgress?: SpaceImportProgressCallback;
}

export interface SpaceImportProgress {
  phase: 'validating' | 'scanning-conflicts' | 'importing';
  currentFile: string;
  processed: number;
  total: number;
}

export type SpaceImportProgressCallback = (progress: SpaceImportProgress) => void;

export interface ConflictInfo {
  /** Path inside the archive */
  archivePath: string;
  /** Where it would go in the target space */
  targetPath: string;
  /** Size of the incoming file */
  incomingSize: number;
  /** Size of the existing file */
  existingSize: number;
}

export interface SpaceImportResult {
  /** ID of the space files were imported into */
  spaceId: string;
  /** Files that were written */
  imported: string[];
  /** Files that were skipped due to conflict strategy */
  skipped: string[];
  /** Files that were renamed on import */
  renamed: Array<{ original: string; renamed: string }>;
  /** Files that replaced existing ones */
  replaced: string[];
  /** Conflicts detected (useful for preview before import) */
  conflicts: ConflictInfo[];
  /** Errors encountered */
  errors: SpaceArchiveError[];
}

export interface SpaceArchiveError {
  path: string;
  message: string;
}

// ─── ZipWriter / ZipReader abstractions ────────────────────────────────────

/** Platform-agnostic ZIP entry for reading */
export interface ArchiveZipEntry {
  path: string;
  isDirectory: boolean;
  getData(): Promise<Uint8Array>;
}

/** Platform-agnostic ZIP reader */
export interface ArchiveZipReader {
  getEntries(): Promise<ArchiveZipEntry[]>;
  close(): Promise<void>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encode(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value, null, 2));
}

function decode<T>(data: Uint8Array): T {
  return JSON.parse(decoder.decode(data)) as T;
}

/** Compute SHA-256 hex digest of data */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(data));
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback: simple checksum for environments without SubtleCrypto
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Recursively collect all files under a directory via the StorageBackend.
 */
async function collectFiles(
  backend: StorageBackend,
  dir: string,
  results: string[],
): Promise<void> {
  let entries: DirEntry[];
  try {
    entries = await backend.listDirectory(dir);
  } catch {
    return; // Directory doesn't exist or can't be listed
  }

  for (const entry of entries) {
    const fullPath = dir === '' || dir === '/' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      await collectFiles(backend, fullPath, results);
    } else if (entry.isFile) {
      results.push(fullPath);
    }
  }
}

/**
 * Generate a renamed path to avoid conflicts.
 * "pages/note.md" -> "pages/note (imported).md"
 * "pages/note (imported).md" -> "pages/note (imported 2).md"
 */
export function generateRenamedPath(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  const dir = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '';
  const filename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;

  // Find the extension, but don't treat a leading dot as an extension separator
  // e.g., ".gitignore" -> name=".gitignore", ext=""
  //        "file.txt"  -> name="file", ext=".txt"
  const searchFrom = filename.startsWith('.') ? 1 : 0;
  const dotIdx = filename.indexOf('.', searchFrom);
  const hasExt = dotIdx > 0;
  const name = hasExt ? filename.slice(0, dotIdx) : filename;
  const ext = hasExt ? filename.slice(dotIdx) : '';

  // Check if already has a (imported N) suffix
  const match = name.match(/^(.+) \(imported(?: (\d+))?\)$/);
  if (match) {
    const base = match[1];
    const num = match[2] ? parseInt(match[2], 10) + 1 : 2;
    return `${dir}${base} (imported ${num})${ext}`;
  }

  return `${dir}${name} (imported)${ext}`;
}

// ─── Export ────────────────────────────────────────────────────────────────

/**
 * Export a space's files for packaging into a ZIP archive.
 *
 * The caller is responsible for actually creating the ZIP (platform-specific).
 * This function collects all files and produces the manifest.
 */
export async function exportSpace(
  backend: StorageBackend,
  spaceId: string,
  spaceName: string,
  spaceIcon: string | undefined,
  options: SpaceExportOptions = {},
): Promise<SpaceExportResult> {
  const {
    includeDatabases = true,
    includeAssets = true,
    onProgress,
  } = options;

  const errors: SpaceArchiveError[] = [];
  const files: ExportFileData[] = [];
  const manifestFiles: ArchiveFileEntry[] = [];

  // Determine the base directory for this space
  const isDefault = spaceId === 'default';
  const pagesDir = isDefault ? 'pages' : `.cept/spaces/${spaceId}/pages`;
  const workspaceFile = isDefault
    ? '.cept/workspace-state.json'
    : `.cept/spaces/${spaceId}/workspace-state.json`;

  // Phase 1: Scan for files
  onProgress?.({ phase: 'scanning', currentFile: '', processed: 0, total: 0 });

  const filePaths: string[] = [];

  // Always include workspace state
  if (await backend.exists(workspaceFile)) {
    filePaths.push(workspaceFile);
  }

  // Collect pages
  const pageFiles: string[] = [];
  await collectFiles(backend, pagesDir, pageFiles);
  filePaths.push(...pageFiles);

  // Collect databases
  if (includeDatabases) {
    const dbDir = isDefault ? '.cept/databases' : `.cept/spaces/${spaceId}/databases`;
    const dbFiles: string[] = [];
    await collectFiles(backend, dbDir, dbFiles);
    filePaths.push(...dbFiles);
  }

  // Collect assets
  if (includeAssets) {
    const assetsDir = isDefault ? 'assets' : `.cept/spaces/${spaceId}/assets`;
    const assetFiles: string[] = [];
    await collectFiles(backend, assetsDir, assetFiles);
    filePaths.push(...assetFiles);
  }

  // Phase 2: Read files
  const total = filePaths.length;
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    onProgress?.({ phase: 'reading', currentFile: filePath, processed: i, total });

    try {
      const data = await backend.readFile(filePath);
      if (!data) {
        errors.push({ path: filePath, message: 'File read returned null' });
        continue;
      }

      // Map to archive-relative path
      const archivePath = toArchivePath(filePath, spaceId, isDefault);
      const hash = await sha256Hex(data);

      files.push({ archivePath, data });
      manifestFiles.push({ path: archivePath, size: data.length, sha256: hash });
    } catch (e) {
      errors.push({ path: filePath, message: (e as Error).message });
    }
  }

  onProgress?.({ phase: 'packaging', currentFile: '', processed: total, total });

  const manifest: ArchiveManifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    space: { id: spaceId, name: spaceName, icon: spaceIcon },
    files: manifestFiles,
  };

  // Add the manifest itself to the file list
  const manifestData = encode(manifest);
  files.unshift({ archivePath: 'manifest.json', data: manifestData });

  return { files, manifest, errors };
}

/**
 * Convert a storage path to an archive-relative path.
 * This strips the space-specific prefix so archives are portable.
 */
function toArchivePath(storagePath: string, spaceId: string, isDefault: boolean): string {
  if (isDefault) {
    // "pages/foo.md" -> "pages/foo.md"
    // ".cept/workspace-state.json" -> "workspace-state.json"
    // ".cept/databases/db.yaml" -> "databases/db.yaml"
    if (storagePath.startsWith('.cept/workspace-state')) {
      return 'workspace-state.json';
    }
    if (storagePath.startsWith('.cept/databases/')) {
      return storagePath.replace('.cept/', '');
    }
    return storagePath;
  }

  // Non-default space: ".cept/spaces/{id}/pages/foo.md" -> "pages/foo.md"
  const prefix = `.cept/spaces/${spaceId}/`;
  if (storagePath.startsWith(prefix)) {
    return storagePath.slice(prefix.length);
  }
  return storagePath;
}

/**
 * Convert an archive-relative path to a storage path for a target space.
 */
function toStoragePath(archivePath: string, spaceId: string, isDefault: boolean): string {
  if (isDefault) {
    if (archivePath === 'workspace-state.json') {
      return '.cept/workspace-state.json';
    }
    if (archivePath.startsWith('databases/')) {
      return `.cept/${archivePath}`;
    }
    return archivePath;
  }

  const prefix = `.cept/spaces/${spaceId}`;
  if (archivePath === 'workspace-state.json') {
    return `${prefix}/workspace-state.json`;
  }
  return `${prefix}/${archivePath}`;
}

// ─── Import: Conflict Detection ───────────────────────────────────────────

/**
 * Preview what conflicts would occur when importing an archive into a space.
 * Does not modify anything — just scans and reports.
 */
export async function previewImportConflicts(
  backend: StorageBackend,
  zipReader: ArchiveZipReader,
  targetSpaceId: string,
): Promise<{ manifest: ArchiveManifest; conflicts: ConflictInfo[] }> {
  const entries = await zipReader.getEntries();

  // Find and parse manifest
  const manifestEntry = entries.find((e) => e.path === 'manifest.json');
  if (!manifestEntry) {
    throw new Error('Invalid archive: missing manifest.json');
  }
  const manifest = decode<ArchiveManifest>(await manifestEntry.getData());
  if (manifest.version !== 1) {
    throw new Error(`Unsupported archive version: ${manifest.version}`);
  }

  const isDefault = targetSpaceId === 'default';
  const conflicts: ConflictInfo[] = [];

  // Check each file in the archive against the target space
  for (const fileEntry of manifest.files) {
    const targetPath = toStoragePath(fileEntry.path, targetSpaceId, isDefault);
    const exists = await backend.exists(targetPath);
    if (exists) {
      const stat = await backend.stat(targetPath);
      conflicts.push({
        archivePath: fileEntry.path,
        targetPath,
        incomingSize: fileEntry.size,
        existingSize: stat?.size ?? 0,
      });
    }
  }

  return { manifest, conflicts };
}

// ─── Import ────────────────────────────────────────────────────────────────

/**
 * Import a space archive ZIP into an existing or new space.
 */
export async function importSpace(
  backend: StorageBackend,
  zipReader: ArchiveZipReader,
  options: SpaceImportOptions = {},
): Promise<SpaceImportResult> {
  const {
    conflictStrategy = 'skip',
    fileConflictOverrides = {},
    importWorkspaceState = true,
    onProgress,
  } = options;

  const result: SpaceImportResult = {
    spaceId: '',
    imported: [],
    skipped: [],
    renamed: [],
    replaced: [],
    conflicts: [],
    errors: [],
  };

  // Phase 1: Validate archive
  onProgress?.({ phase: 'validating', currentFile: 'manifest.json', processed: 0, total: 0 });

  let entries: ArchiveZipEntry[];
  try {
    entries = await zipReader.getEntries();
  } catch (e) {
    result.errors.push({ path: '', message: `Failed to read ZIP: ${(e as Error).message}` });
    return result;
  }

  const manifestEntry = entries.find((e) => e.path === 'manifest.json');
  if (!manifestEntry) {
    result.errors.push({ path: 'manifest.json', message: 'Invalid archive: missing manifest.json' });
    return result;
  }

  let manifest: ArchiveManifest;
  try {
    manifest = decode<ArchiveManifest>(await manifestEntry.getData());
  } catch (e) {
    result.errors.push({ path: 'manifest.json', message: `Invalid manifest: ${(e as Error).message}` });
    return result;
  }

  if (manifest.version !== 1) {
    result.errors.push({ path: 'manifest.json', message: `Unsupported archive version: ${manifest.version}` });
    return result;
  }

  // Determine target space
  const spaceId = options.targetSpaceId ?? `space-${Date.now()}`;
  result.spaceId = spaceId;
  const isDefault = spaceId === 'default';

  // Build a map of archive entries by path for quick lookup
  const entryMap = new Map<string, ArchiveZipEntry>();
  for (const entry of entries) {
    if (!entry.isDirectory && entry.path !== 'manifest.json') {
      entryMap.set(entry.path, entry);
    }
  }

  // Phase 2: Scan for conflicts
  const fileEntries = manifest.files;
  const total = fileEntries.length;

  for (let i = 0; i < fileEntries.length; i++) {
    const fe = fileEntries[i];
    onProgress?.({ phase: 'scanning-conflicts', currentFile: fe.path, processed: i, total });

    const targetPath = toStoragePath(fe.path, spaceId, isDefault);
    const exists = await backend.exists(targetPath);
    if (exists) {
      const stat = await backend.stat(targetPath);
      result.conflicts.push({
        archivePath: fe.path,
        targetPath,
        incomingSize: fe.size,
        existingSize: stat?.size ?? 0,
      });
    }
  }

  // Phase 3: Import files
  for (let i = 0; i < fileEntries.length; i++) {
    const fe = fileEntries[i];
    onProgress?.({ phase: 'importing', currentFile: fe.path, processed: i, total });

    // Skip workspace-state if not requested
    if (fe.path === 'workspace-state.json' && !importWorkspaceState) {
      result.skipped.push(fe.path);
      continue;
    }

    const zipEntry = entryMap.get(fe.path);
    if (!zipEntry) {
      result.errors.push({ path: fe.path, message: 'File listed in manifest but not found in archive' });
      continue;
    }

    let targetPath = toStoragePath(fe.path, spaceId, isDefault);
    const hasConflict = result.conflicts.some((c) => c.archivePath === fe.path);

    if (hasConflict) {
      const strategy = fileConflictOverrides[fe.path] ?? conflictStrategy;

      switch (strategy) {
        case 'keep':
        case 'skip': {
          result.skipped.push(fe.path);
          continue;
        }
        case 'replace': {
          // Will overwrite below
          result.replaced.push(fe.path);
          break;
        }
        case 'rename': {
          // Generate a non-conflicting name
          let renamed = toStoragePath(generateRenamedPath(fe.path), spaceId, isDefault);
          // Make sure the renamed path also doesn't conflict
          let maxAttempts = 100;
          while (await backend.exists(renamed) && maxAttempts-- > 0) {
            const archiveRenamed = generateRenamedPath(
              toArchivePath(renamed, spaceId, isDefault),
            );
            renamed = toStoragePath(archiveRenamed, spaceId, isDefault);
          }
          result.renamed.push({ original: fe.path, renamed });
          targetPath = renamed;
          break;
        }
      }
    }

    try {
      const data = await zipEntry.getData();
      await backend.writeFile(targetPath, data);
      result.imported.push(fe.path);
    } catch (e) {
      result.errors.push({ path: fe.path, message: (e as Error).message });
    }
  }

  onProgress?.({ phase: 'importing', currentFile: '', processed: total, total });

  try {
    await zipReader.close();
  } catch {
    // Ignore close errors
  }

  return result;
}
