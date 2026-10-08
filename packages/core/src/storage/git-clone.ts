/**
 * Kept clones of a remote Git repository, one per remote space.
 *
 * The first sync clones the repository (shallow by default) into a directory
 * the caller owns on the host backend; every later sync fetches into the same
 * clone and fast-forwards it, so only new objects come over the wire and
 * nothing in the clone is thrown away and fetched again.
 */

import { GitBackend, createGitHttp } from './git-backend.js';
import type { GitAuth, GitFs, GitHttp } from './git-backend.js';
import type { StorageBackend } from './backend.js';

/** Where the app keeps remote spaces' clones on the host backend. */
export const GIT_REPOS_DIR = '/.cept/git-repos';

/** The clone directory for `key` (a remote space id) under {@link GIT_REPOS_DIR}. */
export function remoteCloneDir(key: string): string {
  return `${GIT_REPOS_DIR}/${encodeURIComponent(key)}`;
}

/**
 * The remote refused the request (HTTP 401 or 403): the repository needs a
 * token, or a different one. Raised once, with no retry, so the caller can ask
 * the user to sign in again.
 */
export class GitAuthRequiredError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly url: string,
  ) {
    super(
      status === 401
        ? `${url} needs a GitHub sign-in, or the saved token was rejected.`
        : `The saved token cannot read ${url}.`,
    );
    this.name = 'GitAuthRequiredError';
  }
}

export interface RemoteCloneOptions {
  /** The backend the clone is written to and read back from. */
  host: StorageBackend;
  /** The same storage as `host`, in the shape isomorphic-git writes through. */
  fs: GitFs;
  /** The clone's directory on `host`, kept between syncs (see {@link remoteCloneDir}). */
  dir: string;
  url: string;
  /** Branch to track (default `main`). */
  ref?: string;
  corsProxy?: string;
  /** Credentials; without them the clone is anonymous. */
  auth?: GitAuth;
  /** HTTP client; the browser client from {@link createGitHttp} when omitted. */
  http?: GitHttp;
  /** Fetch every commit instead of only the latest (for history). */
  fullHistory?: boolean;
  /** When the remote branch was rewritten, take the remote's files instead of failing. */
  resetOnDivergence?: boolean;
}

export interface RemoteCloneResult {
  dir: string;
  /** The commit the clone now has checked out. */
  head: string;
  /** `cloned` on the first sync, then `updated` or `unchanged`. */
  action: 'cloned' | 'updated' | 'unchanged';
}

/**
 * Bring the clone at `dir` up to date with `url` at `ref`: clone it if it is
 * not there yet, otherwise fetch and fast-forward. A 401 or 403 rejects with
 * {@link GitAuthRequiredError}.
 */
export async function syncRemoteClone(options: RemoteCloneOptions): Promise<RemoteCloneResult> {
  const ref = options.ref ?? 'main';
  const git = new GitBackend({
    underlying: options.host,
    dir: options.dir,
    fs: options.fs,
    http: options.http ?? (await createGitHttp()),
    corsProxy: options.corsProxy,
    auth: options.auth,
  });
  try {
    if (await isClone(options.host, options.dir)) {
      const action = await git.updateFromRemote(ref, {
        fullHistory: options.fullHistory,
        resetOnDivergence: options.resetOnDivergence,
      });
      return { dir: options.dir, head: await git.head(), action };
    }
    // A half-written clone (an interrupted first sync) is started again.
    await options.host.deleteFile(options.dir).catch(() => undefined);
    try {
      await git.clone(options.url, {
        ref,
        depth: options.fullHistory ? undefined : 1,
        singleBranch: true,
      });
    } catch (err) {
      await options.host.deleteFile(options.dir).catch(() => undefined);
      throw err;
    }
    return { dir: options.dir, head: await git.head(), action: 'cloned' };
  } catch (err) {
    const status = httpStatus(err);
    if (status === 401 || status === 403) throw new GitAuthRequiredError(status, options.url);
    throw err;
  }
}

/** Whether `dir` holds a finished clone: the index is written by the checkout that ends a clone. */
async function isClone(host: StorageBackend, dir: string): Promise<boolean> {
  return (await host.exists(`${dir}/.git/HEAD`)) && (await host.exists(`${dir}/.git/index`));
}

/** The HTTP status of an isomorphic-git `HttpError`, if `err` is one. */
function httpStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const { code, data } = err as { code?: unknown; data?: { statusCode?: unknown } };
  return code === 'HttpError' && typeof data?.statusCode === 'number' ? data.statusCode : undefined;
}
