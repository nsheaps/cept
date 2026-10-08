/**
 * GitSpaceSession against a real Git server: edits made through a session are
 * committed under the signed-in account, pushed to a bare repository served
 * by `git http-backend`, and reach a second clone; commits pushed elsewhere
 * come back into the session on the next sync.
 */
import { execFileSync, spawn } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { BrowserFsBackend } from '../storage/browser-fs.js';
import type { GitFs, GitHttp } from '../storage/git-backend.js';
import { countUnpushedCommits, remoteCloneDir, syncRemoteClone } from '../storage/git-clone.js';
import { GitSpaceSession } from './git-space-session.js';
import type { GitSpaceSessionOptions } from './git-space-session.js';
import { commitIdentityFor, DEFAULT_SYNC_SETTINGS, SYNC_SETTINGS_PATH } from './sync-policy.js';
import type { SyncSettings } from './sync-policy.js';

let root = '';
/**
 * A GitHttp that runs `git http-backend` for each request, serving the bare
 * repositories under `root`. Pushes are accepted because each bare repository
 * sets `http.receivepack`. (The same server as git-clone.integration.test.ts,
 * without its token checks.)
 */
const http: GitHttp = {
  async request({ url, method = 'GET', headers = {}, body }) {
    const { pathname, search } = new URL(url);
    const chunks: Uint8Array[] = [];
    if (body) for await (const chunk of body) chunks.push(chunk);
    const input = Buffer.concat(chunks);
    const child = spawn('git', ['http-backend'], {
      env: {
        PATH: process.env.PATH ?? '',
        GIT_PROJECT_ROOT: root,
        GIT_HTTP_EXPORT_ALL: '1',
        REQUEST_METHOD: method,
        PATH_INFO: pathname,
        QUERY_STRING: search.replace(/^\?/, ''),
        CONTENT_TYPE: headers['content-type'] ?? headers['Content-Type'] ?? '',
        CONTENT_LENGTH: String(input.length),
      },
    });
    // git http-backend may exit before reading the body (e.g. a missing repository).
    child.stdin.on('error', () => undefined);
    child.stdin.end(input);
    const out: Buffer[] = [];
    for await (const chunk of child.stdout) out.push(chunk as Buffer);
    const raw = Buffer.concat(out);
    const split = raw.indexOf('\r\n\r\n');
    const responseHeaders: Record<string, string> = {};
    for (const line of raw.subarray(0, split).toString('utf8').split('\r\n')) {
      const colon = line.indexOf(':');
      responseHeaders[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim();
    }
    const status = Number((responseHeaders.status ?? '200').split(' ')[0]);
    const payload = new Uint8Array(raw.subarray(split + 4));
    return {
      url,
      method,
      statusCode: status,
      statusMessage: status === 200 ? 'OK' : 'Error',
      headers: responseHeaders,
      body: (async function* () {
        yield payload;
      })(),
    };
  },
};
const identity = commitIdentityFor({ login: 'octo', id: 42, name: 'Octo Cat' });
const encode = (text: string) => new TextEncoder().encode(text);
const decode = (data: Uint8Array | null) => new TextDecoder().decode(data ?? undefined);

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function commitAll(work: string, message: string): void {
  git(work, 'add', '-A');
  git(work, '-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-qm', message);
}

/** A bare `<name>.git` that accepts pushes, and a working copy of it. */
function makeRepo(name: string): { work: string; bare: string } {
  const work = path.join(root, `${name}-work`);
  mkdirSync(path.join(work, 'docs'), { recursive: true });
  writeFileSync(path.join(work, 'README.md'), '# Hello\n');
  writeFileSync(path.join(work, 'docs', 'guide.md'), '# Guide\n');
  git(root, 'init', '-q', '-b', 'main', `${name}-work`);
  commitAll(work, 'first');
  const bare = path.join(root, `${name}.git`);
  git(root, 'clone', '-q', '--bare', `${name}-work`, `${name}.git`);
  git(bare, 'config', 'http.receivepack', 'true');
  git(work, 'remote', 'add', 'origin', bare);
  git(work, 'fetch', '-q', 'origin');
  git(work, 'branch', '-q', '--set-upstream-to=origin/main', 'main');
  return { work, bare };
}

/** A fresh device with a shallow clone of `<name>.git`. */
async function cloneOnNewDevice(name: string) {
  const host = new BrowserFsBackend(`git-session-${crypto.randomUUID()}`);
  const fs = host.getRawFs() as unknown as GitFs;
  const { dir } = await syncRemoteClone({
    host,
    fs,
    dir: remoteCloneDir(`git.test/${name}@main`),
    url: `http://git.test/${name}.git`,
    http,
  });
  return { host, fs, dir };
}

async function openSession(
  name: string,
  settings: Partial<SyncSettings> = {},
  extra: Partial<GitSpaceSessionOptions> = {},
) {
  const device = await cloneOnNewDevice(name);
  const session = await GitSpaceSession.open({
    ...device,
    http,
    identity,
    settings: { ...DEFAULT_SYNC_SETTINGS, ...settings },
    ...extra,
  });
  return { ...device, session };
}

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'cept-git-session-'));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('GitSpaceSession', () => {
  it('commits edits as the signed-in account, pushes them, and a second clone pulls them', async () => {
    const { bare } = makeRepo('edit');
    const { session } = await openSession('edit');

    await session.backend.writeFile('notes/new.md', encode('# New\n'));
    await session.backend.writeFile('README.md', encode('# Hello again\n'));
    await session.backend.deleteFile('docs/guide.md');
    const { status } = await session.syncNow();
    await session.dispose();

    expect(status.state).toBe('synced');
    expect(git(bare, 'log', '-1', '--format=%an <%ae>')).toBe(
      'Octo Cat <42+octo@users.noreply.github.com>',
    );
    expect(git(bare, 'log', '-1', '--format=%B')).toBe(
      'Add new, Update README, Delete guide\n\nM README.md\nD docs/guide.md\nA notes/new.md',
    );
    expect(git(bare, 'ls-tree', '-r', '--name-only', 'main').split('\n')).toEqual([
      'README.md',
      'notes/new.md',
    ]);

    const second = await cloneOnNewDevice('edit');
    expect(decode(await second.host.readFile(`${second.dir}/README.md`))).toBe('# Hello again\n');
    expect(decode(await second.host.readFile(`${second.dir}/notes/new.md`))).toBe('# New\n');
    expect(await second.host.exists(`${second.dir}/docs/guide.md`)).toBe(false);
  });

  it('pulls commits pushed from elsewhere and reports that the files changed', async () => {
    const { work } = makeRepo('pull');
    const { session } = await openSession('pull');

    writeFileSync(path.join(work, 'docs', 'guide.md'), '# Guide\n\nFrom elsewhere.\n');
    commitAll(work, 'elsewhere');
    git(work, 'push', '-q', 'origin', 'main');

    const first = await session.syncNow();
    const second = await session.syncNow();
    await session.dispose();

    expect(first).toMatchObject({ changed: true, status: { state: 'synced' } });
    expect(second.changed).toBe(false);
    expect(decode(await session.backend.readFile('docs/guide.md'))).toBe(
      '# Guide\n\nFrom elsewhere.\n',
    );
  });

  it('merges a local edit with a remote one to a different file', async () => {
    const { work, bare } = makeRepo('merge');
    const { session } = await openSession('merge');

    writeFileSync(path.join(work, 'docs', 'guide.md'), '# Guide\n\nRemote.\n');
    commitAll(work, 'remote');
    git(work, 'push', '-q', 'origin', 'main');
    await session.backend.writeFile('README.md', encode('# Local\n'));

    const { status, changed } = await session.syncNow();
    await session.dispose();

    expect(status.state).toBe('synced');
    expect(changed).toBe(true);
    expect(git(bare, 'show', 'main:README.md')).toBe('# Local');
    expect(git(bare, 'show', 'main:docs/guide.md')).toBe('# Guide\n\nRemote.');
  });

  it('commits by itself after the debounce', async () => {
    makeRepo('debounce');
    const { session } = await openSession('debounce', { debounceMs: 500 });
    const committed = new Promise<string | undefined>((resolve) =>
      session.autoCommit.on((event) => {
        if (event.type === 'commit') resolve(event.commitHash);
      }),
    );

    await session.backend.writeFile('README.md', encode('# Debounced\n'));
    const hash = await committed;
    await session.dispose();

    expect(hash).toBe(await session.git.head());
  });

  it('keeps edits uncommitted when auto-commit is off, until a sync', async () => {
    const { bare } = makeRepo('manual');
    const before = git(bare, 'rev-parse', 'main');
    const { session } = await openSession('manual', { autoCommit: false, debounceMs: 500 });

    await session.backend.writeFile('README.md', encode('# Manual\n'));
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(session.autoCommit.getPendingChanges()).toHaveLength(1);

    await session.syncNow();
    await session.dispose();
    expect(git(bare, 'rev-parse', 'main')).not.toBe(before);
  });

  it('does not push when auto-push is off until asked', async () => {
    const { bare } = makeRepo('nopush');
    const before = git(bare, 'rev-parse', 'main');
    const { session } = await openSession('nopush', { autoPush: false });

    await session.backend.writeFile('README.md', encode('# Held\n'));
    const synced = await session.syncNow();
    expect(synced.status.state).toBe('synced');
    expect(git(bare, 'rev-parse', 'main')).toBe(before);

    await session.pushNow();
    await session.dispose();
    expect(git(bare, 'show', 'main:README.md')).toBe('# Held');
  });

  it('roots a sub-folder space at its folder and never commits its device settings', async () => {
    const { bare } = makeRepo('nested');
    const { session } = await openSession('nested', {}, { subPath: 'docs' });

    await session.backend.writeFile('guide.md', encode('# Guide\n\nNested edit.\n'));
    await session.backend.writeFile(SYNC_SETTINGS_PATH, encode('{"autoPush": true}\n'));
    await session.syncNow();
    // A commit that stages everything still leaves the settings file out.
    await session.git.commit('Stage all');
    await session.pushNow();
    await session.dispose();

    expect(git(bare, 'show', 'main:docs/guide.md')).toBe('# Guide\n\nNested edit.');
    expect(git(bare, 'ls-tree', '-r', '--name-only', 'main')).not.toContain('sync.local.json');
  });

  it('reads per-device settings from the space when none are given', async () => {
    const { bare } = makeRepo('settings');
    const device = await cloneOnNewDevice('settings');
    await device.host.writeFile(
      `${device.dir}/${SYNC_SETTINGS_PATH}`,
      encode('{"autoPush": false, "intervalMs": 60000}\n'),
    );
    const session = await GitSpaceSession.open({ ...device, http, identity });

    expect(session.settings).toMatchObject({ autoPush: false, intervalMs: 60000 });
    await session.backend.writeFile('README.md', encode('# Kept\n'));
    const before = git(bare, 'rev-parse', 'main');
    await session.syncNow();
    await session.dispose();
    expect(git(bare, 'rev-parse', 'main')).toBe(before);
  });

  it('counts commits not pushed yet, in the session and in the clone left behind', async () => {
    makeRepo('ahead');
    const { session, host, fs, dir } = await openSession('ahead', { autoPush: false });

    expect(await session.localChanges()).toEqual({ pending: 0, unpushed: 0 });
    await session.backend.writeFile('README.md', encode('# One\n'));
    expect(await session.localChanges()).toEqual({ pending: 1, unpushed: 0 });
    await session.syncNow();
    await session.backend.writeFile('README.md', encode('# Two\n'));
    await session.syncNow();
    expect(await session.localChanges()).toEqual({ pending: 0, unpushed: 2 });
    await session.dispose();
    expect(await countUnpushedCommits({ host, fs, dir })).toBe(2);

    const pushing = await GitSpaceSession.open({ host, fs, dir, http, identity });
    await pushing.pushNow();
    await pushing.dispose();
    expect(await countUnpushedCommits({ host, fs, dir })).toBe(0);
    expect(await countUnpushedCommits({ host, fs, dir: `${dir}-missing` })).toBe(0);
  });

  it('starts a space in a repository without one by committing its marker', async () => {
    const { bare } = makeRepo('start');
    const { session } = await openSession('start', {}, { subPath: 'docs' });

    await session.backend.writeFile('space.cept.yaml', encode('version: 1\nname: Docs\n'));
    const { status } = await session.pushNow();
    await session.dispose();

    expect(status.state).toBe('synced');
    expect(git(bare, 'show', 'main:docs/space.cept.yaml')).toBe('version: 1\nname: Docs');
  });
});

/** Push a change to `file` (relative to the repository root) from the other working copy. */
function pushFromElsewhere(work: string, file: string, content: string | null): void {
  if (content === null) git(work, 'rm', '-q', file);
  else writeFileSync(path.join(work, file), content);
  commitAll(work, `elsewhere: ${file}`);
  git(work, 'push', '-q', 'origin', 'main');
}

/** Refuse pushes to `main` the way branch protection does; other branches go through. */
function protectMain(bare: string): void {
  const hook = path.join(bare, 'hooks', 'pre-receive');
  writeFileSync(
    hook,
    [
      '#!/bin/sh',
      'while read old new ref; do',
      '  if [ "$ref" = "refs/heads/main" ]; then',
      '    echo "GH006: Protected branch update failed for refs/heads/main." >&2',
      '    exit 1',
      '  fi',
      'done',
      '',
    ].join('\n'),
  );
  chmodSync(hook, 0o755);
}

describe('GitSpaceSession conflicts (REQ-WS-026)', () => {
  const page = (front: string[], body: string) => ['---', ...front, '---', body].join('\n');

  it('merges front matter key by key and the body line by line, with a merge commit', async () => {
    const { work, bare } = makeRepo('fm');
    writeFileSync(path.join(work, 'plan.md'), page(['title: Plan'], 'one\ntwo\nthree\n'));
    commitAll(work, 'plan');
    git(work, 'push', '-q', 'origin', 'main');
    const { session } = await openSession('fm');

    pushFromElsewhere(work, 'plan.md', page(['title: Plan', 'owner: sam'], 'one\ntwo\nTHREE\n'));
    await session.backend.writeFile(
      'plan.md',
      encode(page(['title: Plan', 'status: done'], 'ONE\ntwo\nthree\n')),
    );
    const { status, changed } = await session.syncNow();
    await session.dispose();

    expect(status.state).toBe('synced');
    expect(changed).toBe(true);
    const merged = page(['title: Plan', 'status: done', 'owner: sam'], 'ONE\ntwo\nTHREE\n');
    expect(decode(await session.backend.readFile('plan.md'))).toBe(merged);
    expect(git(bare, 'show', 'main:plan.md')).toBe(merged.trimEnd());
    expect(git(bare, 'log', '-1', '--format=%P', 'main').split(' ')).toHaveLength(2);
  });

  it('holds the push on overlapping edits until they are resolved, keeping both versions', async () => {
    const { work, bare } = makeRepo('overlap');
    const { session } = await openSession('overlap');

    pushFromElsewhere(work, 'README.md', '# Theirs\n');
    const remoteMain = git(bare, 'rev-parse', 'main');
    await session.backend.writeFile('README.md', encode('# Mine\n'));
    const first = await session.syncNow();

    expect(first.status.state).toBe('conflict');
    expect(first.changed).toBe(false);
    expect(session.conflicts()).toEqual([
      {
        path: 'README.md',
        type: 'content',
        ours: '# Mine\n',
        theirs: '# Theirs\n',
        base: '# Hello\n',
        merged: '<<<<<<< mine\n# Mine\n=======\n# Theirs\n>>>>>>> theirs\n',
      },
    ]);
    // Nothing was pushed, and the working tree still holds my version.
    expect(git(bare, 'rev-parse', 'main')).toBe(remoteMain);
    expect(decode(await session.backend.readFile('README.md'))).toBe('# Mine\n');

    // Editing other pages carries on, but nothing is pushed while the conflict remains.
    await session.backend.writeFile('docs/guide.md', encode('# Guide, edited\n'));
    expect((await session.syncNow()).status.state).toBe('conflict');
    expect(git(bare, 'rev-parse', 'main')).toBe(remoteMain);

    const resolved = await session.resolveConflicts([{ path: 'README.md', choice: 'mine' }]);
    await session.dispose();

    expect(resolved.status.state).toBe('synced');
    expect(resolved.changed).toBe(true);
    expect(session.conflicts()).toEqual([]);
    expect(git(bare, 'show', 'main:README.md')).toBe('# Mine');
    expect(git(bare, 'show', 'main:docs/guide.md')).toBe('# Guide, edited');
    const copy = `README (their version ${remoteMain.slice(0, 7)}).md`;
    expect(git(bare, 'show', `main:${copy}`)).toBe('# Theirs');
    expect(decode(await session.backend.readFile(copy))).toBe('# Theirs\n');
  });

  it('commits an edited merge, never one that still holds conflict markers', async () => {
    const { work, bare } = makeRepo('edited');
    const { session } = await openSession('edited');
    pushFromElsewhere(work, 'README.md', '# Theirs\n');
    await session.backend.writeFile('README.md', encode('# Mine\n'));
    await session.syncNow();

    const marked = await session.resolveConflicts([
      { path: 'README.md', choice: 'merged', content: session.conflicts()[0]!.merged! },
    ]);
    expect(marked.status.state).toBe('conflict');

    const resolved = await session.resolveConflicts([
      { path: 'README.md', choice: 'merged', content: '# Mine and theirs\n' },
    ]);
    await session.dispose();
    expect(resolved.status.state).toBe('synced');
    expect(git(bare, 'show', 'main:README.md')).toBe('# Mine and theirs');
    expect(git(bare, 'ls-tree', '-r', '--name-only', 'main')).not.toContain('version');
  });

  it('keeps a file changed here and deleted there until the user decides', async () => {
    const { work, bare } = makeRepo('delmod');
    const { session } = await openSession('delmod');
    pushFromElsewhere(work, 'docs/guide.md', null);
    await session.backend.writeFile('docs/guide.md', encode('# Guide, kept\n'));

    const first = await session.syncNow();
    expect(first.status.state).toBe('conflict');
    expect(session.conflicts()).toMatchObject([
      { path: 'docs/guide.md', type: 'delete-modify', ours: '# Guide, kept\n', theirs: null },
    ]);

    await session.resolveConflicts([{ path: 'docs/guide.md', choice: 'mine' }]);
    await session.dispose();
    expect(git(bare, 'show', 'main:docs/guide.md')).toBe('# Guide, kept');
  });

  it('pushes to a new branch when the tracked one refuses the push, then follows it again', async () => {
    const { bare } = makeRepo('protected');
    protectMain(bare);
    const remoteMain = git(bare, 'rev-parse', 'main');
    const { session } = await openSession('protected');

    await session.backend.writeFile('README.md', encode('# Proposed\n'));
    const refused = await session.syncNow();
    expect(refused.status).toMatchObject({ state: 'error', lastErrorKind: 'rejected' });
    expect(git(bare, 'rev-parse', 'main')).toBe(remoteMain);

    const head = await session.git.head();
    const { branch, sync } = await session.pushToNewBranch(new Date('2026-10-08T12:00:00Z'));
    await session.dispose();

    expect(branch).toBe(`cept/octo/2026-10-08-${head.slice(0, 7)}`);
    expect(git(bare, 'show', `${branch}:README.md`)).toBe('# Proposed');
    expect(git(bare, 'rev-parse', 'main')).toBe(remoteMain);
    // The space follows main again, without the work now on the new branch.
    expect(sync.status.state).toBe('synced');
    expect(await session.git.head()).toBe(remoteMain);
    expect(decode(await session.backend.readFile('README.md'))).toBe('# Hello\n');
  });

  it('pushes unmerged work to a new branch instead of resolving the conflict', async () => {
    const { work, bare } = makeRepo('detour');
    const { session } = await openSession('detour');
    pushFromElsewhere(work, 'README.md', '# Theirs\n');
    await session.backend.writeFile('README.md', encode('# Mine\n'));
    expect((await session.syncNow()).status.state).toBe('conflict');

    const { branch, sync } = await session.pushToNewBranch(new Date('2026-10-08T12:00:00Z'));
    await session.dispose();

    expect(git(bare, 'show', `${branch}:README.md`)).toBe('# Mine');
    expect(git(bare, 'show', 'main:README.md')).toBe('# Theirs');
    expect(sync.status.state).toBe('synced');
    expect(session.conflicts()).toEqual([]);
    expect(decode(await session.backend.readFile('README.md'))).toBe('# Theirs\n');
  });
});
