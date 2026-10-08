/**
 * Git history for a folder opened on this device (REQ-WS-021). When the
 * folder, or a folder above a space in it, holds a `.git` folder, the space's
 * pages have a history: the repository's own commits, read through the
 * folder's backend.
 *
 * Everything here reads only. The repository is the user's own, so Cept does
 * not commit to it, move its branch or touch its index (REQ-WS-019); edits
 * are saved to the working files as in any folder space.
 */
import { findGitRoot } from '../space/discover.js';
import { normalizeFolder, toBackendPath } from '../space/path.js';
import type { FileStat, StorageBackend } from '../storage/backend.js';
import { GitBackend } from '../storage/git-backend.js';
import type { GitFs } from '../storage/git-backend.js';

/** An error with the `code` isomorphic-git looks at, like Node's fs errors. */
function fsError(code: string, path: string): Error & { code: string } {
  return Object.assign(new Error(`${code}: ${path}`), { code });
}

/** The parts of a Node `Stats` isomorphic-git reads. */
function statsOf(stat: FileStat) {
  const mtimeMs = stat.modifiedAt.getTime();
  const ctimeMs = stat.createdAt.getTime();
  return {
    type: stat.isDirectory ? 'dir' : 'file',
    mode: stat.isDirectory ? 0o40000 : 0o100644,
    size: stat.size,
    ino: 0,
    uid: 0,
    gid: 0,
    dev: 0,
    mtimeMs,
    ctimeMs,
    mtime: stat.modifiedAt,
    ctime: stat.createdAt,
    isFile: () => stat.isFile,
    isDirectory: () => stat.isDirectory,
    isSymbolicLink: () => false,
  };
}

function encodingOf(options: unknown): string | undefined {
  if (typeof options === 'string') return options;
  if (options && typeof options === 'object' && 'encoding' in options) {
    const { encoding } = options as { encoding?: unknown };
    return typeof encoding === 'string' ? encoding : undefined;
  }
  return undefined;
}

/**
 * An isomorphic-git file system over `backend` that only reads: every write
 * fails with `EROFS`, so nothing Cept runs can change the repository.
 */
export function readOnlyGitFs(backend: StorageBackend): GitFs {
  const refuse = (path: unknown) => Promise.reject(fsError('EROFS', String(path)));
  const stat = async (path: unknown) => {
    const found = await backend.stat(toBackendPath(String(path)));
    if (!found) throw fsError('ENOENT', String(path));
    return statsOf(found);
  };
  const promises = {
    async readFile(path: unknown, options?: unknown) {
      if (path === undefined) throw fsError('ENOENT', '');
      const data = await backend.readFile(toBackendPath(String(path)));
      if (!data) throw fsError('ENOENT', String(path));
      return encodingOf(options) ? new TextDecoder().decode(data) : data;
    },
    async readdir(path: unknown) {
      const at = toBackendPath(String(path));
      const found = await backend.stat(at);
      if (!found) throw fsError('ENOENT', String(path));
      if (!found.isDirectory) throw fsError('ENOTDIR', String(path));
      return (await backend.listDirectory(at)).map((entry) => entry.name);
    },
    stat,
    lstat: stat,
    readlink: (path: unknown) => Promise.reject(fsError('EINVAL', String(path))),
    writeFile: refuse,
    unlink: refuse,
    mkdir: refuse,
    rmdir: refuse,
    symlink: refuse,
  };
  return { ...promises, promises };
}

/** A repository found around a space in an opened folder. */
export interface LocalRepository {
  /** Reads the repository's history; it refuses every write. */
  git: GitBackend;
  /** The repository's folder, relative to the backend's root (`''` for the root). */
  root: string;
  /** The space's folder relative to the repository's folder (`''` when they are the same). */
  prefix: string;
}

/**
 * The repository holding `space` (a folder of `backend`, `''` for its root),
 * or null when there is none the browser can read: no `.git` at or above the
 * space inside the opened folder, or a `.git` file (a worktree or submodule)
 * pointing elsewhere.
 */
export async function openLocalRepository(
  backend: StorageBackend,
  space = '',
): Promise<LocalRepository | null> {
  const root = await findGitRoot(backend, space);
  if (root === null) return null;
  const gitDir = await backend.stat(toBackendPath(`${root}/.git`)).catch(() => null);
  if (!gitDir?.isDirectory) return null;
  const spaceFolder = normalizeFolder(space);
  const prefix = root === '' ? spaceFolder : spaceFolder.slice(root.length + 1);
  const git = new GitBackend({
    underlying: backend,
    dir: toBackendPath(root),
    fs: readOnlyGitFs(backend),
  });
  return { git, root, prefix };
}
