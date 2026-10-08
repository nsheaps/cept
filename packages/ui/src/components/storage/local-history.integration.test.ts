/**
 * Page history of a folder space whose folder is a Git repository
 * (REQ-WS-021, REQ-NTN-016): a real repository made with the `git` CLI,
 * opened as a folder, read through the folder the space was connected from.
 */
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listPageHistory, MemoryBackend, pageVersionContent } from '@cept/core';
import type { StorageBackend } from '@cept/core';
import { SpaceManager } from './SpaceManager.js';
import type { SpaceMeta } from './SpaceManager.js';
import { hasLocalRepository, localPageHistorySource } from './git-space.js';

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Octo',
      GIT_AUTHOR_EMAIL: 'octo@example.com',
      GIT_COMMITTER_NAME: 'Octo',
      GIT_COMMITTER_EMAIL: 'octo@example.com',
    },
  }).trim();
}

/** The folder `dir` as an opened folder, counting the writes made to it. */
async function openFolder(dir: string): Promise<{ folder: StorageBackend; writes: () => number }> {
  const backend = new MemoryBackend();
  const copy = async (from: string, to: string): Promise<void> => {
    for (const name of readdirSync(from)) {
      const at = path.join(from, name);
      if (statSync(at).isDirectory()) await copy(at, `${to}/${name}`);
      else await backend.writeFile(`${to}/${name}`, new Uint8Array(readFileSync(at)));
    }
  };
  await copy(dir, '');
  let writes = 0;
  const folder = new Proxy(backend, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== 'function') return value;
      const fn = (value as (...a: unknown[]) => unknown).bind(target);
      if (prop !== 'writeFile' && prop !== 'deleteFile') return fn;
      return (...args: unknown[]) => {
        writes++;
        return fn(...args);
      };
    },
  });
  return { folder, writes: () => writes };
}

function space(subPath?: string): SpaceMeta {
  return { id: 'folder-space', name: 'Docs', createdAt: new Date(0).toISOString(), subPath };
}

describe('history of a folder space in a Git repository (REQ-WS-021)', () => {
  let work: string;

  beforeEach(() => {
    work = mkdtempSync(path.join(tmpdir(), 'cept-local-history-'));
    git(work, 'init', '-q', '-b', 'trunk');
  });

  afterEach(() => {
    rmSync(work, { recursive: true, force: true });
  });

  function commit(file: string, text: string, message: string): string {
    mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
    writeFileSync(path.join(work, file), text);
    git(work, 'add', file);
    git(work, 'commit', '-q', '-m', message);
    return git(work, 'rev-parse', 'HEAD');
  }

  it('reads the history of a page in a space below the repository root, writing nothing', async () => {
    commit('README.md', '# Repo\n', 'readme');
    commit('docs/space.cept.yaml', 'name: Docs\n', 'add docs space');
    const first = commit('docs/Team/index.md', '# Team\n', 'team page');
    commit('docs/Team/index.md', '# Team\n\nPeople.\n', 'team people');
    const { folder, writes } = await openFolder(work);

    const spaces = new SpaceManager(new MemoryBackend());
    spaces.connectFolder(space('docs'), folder);
    const root = spaces.folderRoot('folder-space')!;
    expect(root).toBe(folder);
    expect(await hasLocalRepository(root, space('docs'))).toBe(true);

    const source = await localPageHistorySource(root, space('docs'), 'Team');
    expect(source).toMatchObject({
      path: 'docs/Team/index.md',
      ref: 'trunk',
      canFetchOlder: false,
    });
    const history = await listPageHistory(source!.git, source!.path);
    expect(history.commits.map((c) => c.message)).toEqual(['team people', 'team page']);
    expect(await pageVersionContent(source!.git, source!.path, first)).toBe('# Team\n');
    expect(writes()).toBe(0);

    expect(await localPageHistorySource(root, space('docs'), 'Missing')).toBeNull();
  });

  it('finds no history for a folder without a repository, or once the folder is disconnected', async () => {
    const { folder } = await openFolder(work);
    rmSync(path.join(work, '.git'), { recursive: true, force: true });
    const { folder: plain } = await openFolder(work);
    expect(await hasLocalRepository(plain, space())).toBe(false);
    expect(await localPageHistorySource(plain, space(), 'Guide.md')).toBeNull();

    const spaces = new SpaceManager(new MemoryBackend());
    spaces.connectFolder(space(), folder);
    expect(spaces.folderRoot('folder-space')).toBe(folder);
    spaces.unbind('folder-space');
    expect(spaces.folderRoot('folder-space')).toBeUndefined();
  });
});
