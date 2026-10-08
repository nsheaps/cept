/**
 * Shallow, throwaway clones of a remote Git repository.
 *
 * A clone lands in its own directory under `/.cept/git-clones/` on the host
 * backend, is handed to the caller to read, and is deleted afterwards, so
 * repeated clones (a refresh, a background sync) do not pile up in storage.
 */

import { GitBackend, createGitHttp } from './git-backend.js';
import type { GitAuth, GitFs, GitHttp } from './git-backend.js';
import type { StorageBackend } from './backend.js';

/** Where throwaway clones are made on the host backend. */
export const GIT_CLONES_DIR = '/.cept/git-clones';

export interface ShallowCloneOptions {
  /** The backend the clone is written to and read back from. */
  host: StorageBackend;
  /** The same storage as `host`, in the shape isomorphic-git writes through. */
  fs: GitFs;
  url: string;
  /** Branch or tag to clone (default `main`). */
  ref?: string;
  corsProxy?: string;
  auth?: GitAuth;
  /** HTTP client; the browser client from {@link createGitHttp} when omitted. */
  http?: GitHttp;
}

/**
 * Shallow-clone `url` at `ref` (depth 1, one branch), call `read` with the
 * clone's directory on `host`, then delete the clone, whether `read` (or the
 * clone itself) succeeded or not.
 */
export async function withShallowClone<T>(
  options: ShallowCloneOptions,
  read: (dir: string) => Promise<T>,
): Promise<T> {
  const http = options.http ?? (await createGitHttp());
  const dir = await freeCloneDir(options.host);
  const git = new GitBackend({
    underlying: options.host,
    dir,
    fs: options.fs,
    http,
    corsProxy: options.corsProxy,
    auth: options.auth,
  });
  try {
    await git.clone(options.url, { ref: options.ref ?? 'main', depth: 1, singleBranch: true });
    return await read(dir);
  } finally {
    await options.host.deleteFile(dir).catch((err: unknown) => {
      // The clone's own result still stands; a leftover directory is only wasted space.
      console.warn(`withShallowClone: could not delete ${dir}`, err);
    });
  }
}

/** Most directories tried for one clone before giving up. */
const MAX_CLONE_DIR_ATTEMPTS = 1000;

/** A clone directory that does not exist yet, named after the current time. */
async function freeCloneDir(host: StorageBackend): Promise<string> {
  const stamp = Date.now();
  for (let n = 0; n < MAX_CLONE_DIR_ATTEMPTS; n++) {
    const dir = `${GIT_CLONES_DIR}/${n === 0 ? stamp : `${stamp}-${n}`}`;
    if (!(await host.exists(dir))) return dir;
  }
  throw new Error(`withShallowClone: no free directory under ${GIT_CLONES_DIR}/${stamp}`);
}
