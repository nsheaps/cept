/**
 * History of a folder opened on this device that is (or sits in) a Git
 * repository (REQ-WS-021): a real repository made with the `git` CLI, copied
 * into an in-memory backend as a folder would be read, then read through
 * `openLocalRepository`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryBackend } from '../storage/memory.js';
import type { StorageBackend } from '../storage/backend.js';
import { openLocalRepository, readOnlyGitFs } from './local-repository.js';
import { listPageHistory, pageVersionContent, pageVersionDiff } from './page-history.js';

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

/** Copy the folder `dir` into a fresh memory backend, as an opened folder. */
async function openFolder(dir: string): Promise<MemoryBackend> {
  const backend = new MemoryBackend();
  const copy = async (from: string, to: string): Promise<void> => {
    for (const name of readdirSync(from)) {
      const path = join(from, name);
      if (statSync(path).isDirectory()) await copy(path, `${to}/${name}`);
      else await backend.writeFile(`${to}/${name}`, new Uint8Array(readFileSync(path)));
    }
  };
  await copy(dir, '');
  return backend;
}

/** Counts the writes made through a backend. */
function countingWrites(backend: StorageBackend): {
  backend: StorageBackend;
  writes: () => number;
} {
  let writes = 0;
  const spy = new Proxy(backend, {
    get(target, prop, receiver) {
      if (prop === 'writeFile' || prop === 'deleteFile') {
        return (...args: unknown[]) => {
          writes++;
          return (Reflect.get(target, prop, receiver) as (...a: unknown[]) => unknown).apply(
            target,
            args,
          );
        };
      }
      const value = Reflect.get(target, prop, receiver) as unknown;
      return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
    },
  });
  return { backend: spy, writes: () => writes };
}

describe('local repository history (REQ-WS-021)', () => {
  let work: string;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'cept-local-repo-'));
    git(work, 'init', '-q', '-b', 'main');
  });

  afterEach(() => {
    rmSync(work, { recursive: true, force: true });
  });

  function commitFile(path: string, text: string, message: string): string {
    execFileSync('mkdir', ['-p', join(work, path, '..')]);
    execFileSync('sh', ['-c', 'printf "%s" "$1" > "$2"', 'sh', text, join(work, path)]);
    git(work, 'add', path);
    git(work, 'commit', '-q', '-m', message);
    return git(work, 'rev-parse', 'HEAD');
  }

  it('lists, diffs and reads the versions of a page in a folder that is a repository', async () => {
    commitFile('space.cept.yaml', 'name: Notes\n', 'add marker');
    const first = commitFile('Guide.md', '# Guide\n', 'write guide');
    commitFile('Other.md', 'x\n', 'other page');
    commitFile('Guide.md', '# Guide\n\nMore.\n', 'extend guide');
    const { backend, writes } = countingWrites(await openFolder(work));

    const repo = await openLocalRepository(backend);
    expect(repo).toMatchObject({ root: '', prefix: '' });
    const history = await listPageHistory(repo!.git, 'Guide.md');
    expect(history.commits.map((c) => c.message)).toEqual(['extend guide', 'write guide']);
    expect(history).toMatchObject({ more: false, truncated: false });

    const change = await pageVersionDiff(repo!.git, 'Guide.md', history.commits[0]!);
    expect(change?.files[0]?.hunks[0]).toContain('+More.');
    expect(await pageVersionContent(repo!.git, 'Guide.md', first)).toBe('# Guide\n');
    expect(writes()).toBe(0);
  });

  it('finds the repository above a space in a subfolder, also when its objects are packed', async () => {
    commitFile('README.md', '# Repo\n', 'readme');
    commitFile('docs/space.cept.yaml', 'name: Docs\n', 'add docs space');
    commitFile('docs/Team/index.md', '# Team\n', 'team page');
    commitFile('docs/Team/index.md', '# Team\n\nPeople.\n', 'team people');
    git(work, 'gc', '-q');
    const backend = await openFolder(work);

    const repo = await openLocalRepository(backend, 'docs');
    expect(repo).toMatchObject({ root: '', prefix: 'docs' });
    const history = await listPageHistory(repo!.git, 'docs/Team/index.md');
    expect(history.commits.map((c) => c.message)).toEqual(['team people', 'team page']);
  });

  it('gives the space path relative to a repository in a subfolder of the opened folder', async () => {
    const backend = await openFolder(work);
    await backend.writeFile('/notes/.git/HEAD', new TextEncoder().encode('ref: refs/heads/main\n'));

    expect(await openLocalRepository(backend, 'notes/space')).toMatchObject({
      root: 'notes',
      prefix: 'space',
    });
  });

  it('finds nothing without a .git folder, or with a .git file', async () => {
    const plain = new MemoryBackend();
    await plain.writeFile('/space.cept.yaml', new TextEncoder().encode('name: Plain\n'));
    expect(await openLocalRepository(plain)).toBeNull();

    await plain.writeFile('/.git', new TextEncoder().encode('gitdir: ../elsewhere\n'));
    expect(await openLocalRepository(plain)).toBeNull();
  });

  it('refuses every write to the repository', async () => {
    const fs = readOnlyGitFs(new MemoryBackend());
    await expect(fs.promises!.writeFile('/.git/HEAD', 'x')).rejects.toMatchObject({
      code: 'EROFS',
    });
    await expect(fs.promises!.readFile('/missing')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
