/**
 * Writable GitHub spaces end to end (REQ-WS-027), against bare repositories
 * served by `git http-backend` at github.com-like URLs: a clone made with the
 * sign-in whose folder holds `space.cept.yaml` is writable, edits made through
 * its session are committed and pushed, an anonymous clone stays read-only,
 * and a space can be started in a repository that has none.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { BrowserFsBackend, commitIdentityFor } from '@cept/core';
import type { GitAuth, GitHttp } from '@cept/core';
import { SpaceManager, generateRemoteSpaceId } from './SpaceManager.js';
import {
  cloneRemoteRepo,
  isWritableClone,
  openGitSpaceSession,
  startSpaceInRepo,
  unpushedCommitsOf,
} from './git-space.js';

let root = '';
/** Serves the bare repositories under `root`: `https://github.com/octo/x` is `root/octo/x`. */
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

const auth: GitAuth = { username: 'x-access-token', password: 'test-token' };
const identity = commitIdentityFor({ login: 'octo', id: 42, name: 'Octo Cat' });

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/** A bare `octo/<name>` accepting pushes, made from `files`. */
function makeRepo(name: string, files: Record<string, string>): string {
  const work = path.join(root, `${name}-work`);
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
    writeFileSync(path.join(work, file), text);
  }
  git(root, 'init', '-q', '-b', 'main', `${name}-work`);
  git(work, 'add', '-A');
  git(work, '-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-qm', 'first');
  mkdirSync(path.join(root, 'octo'), { recursive: true });
  const bare = path.join(root, 'octo', name);
  git(root, 'clone', '-q', '--bare', `${name}-work`, bare);
  git(bare, 'config', 'http.receivepack', 'true');
  return bare;
}

const newHost = () => new BrowserFsBackend(`git-space-${crypto.randomUUID()}`);

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'cept-ui-git-space-'));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('writable GitHub spaces (REQ-WS-027)', () => {
  it('edits a space cloned with the sign-in and pushes the commit', async () => {
    const bare = makeRepo('notes', {
      'space.cept.yaml': 'name: Notes\n',
      'Hello.md': '# Hello\n',
    });
    const url = 'https://github.com/octo/notes';
    const id = generateRemoteSpaceId(url, 'main');
    const host = newHost();

    const cloned = await cloneRemoteRepo(host, { spaceId: id, url, branch: 'main', auth, http });
    expect(cloned).toMatchObject({ access: 'token', writable: true });

    const spaces = new SpaceManager(host);
    await spaces.createRemote('Notes', url, 'main', undefined, cloned.access, { writable: true });
    expect(await isWritableClone(host, { id, access: 'token' })).toBe(true);
    const { snapshot } = await spaces.open(id, 'Notes');
    expect(snapshot?.pages.map((p) => p.id)).toEqual(['Hello.md']);

    const session = await openGitSpaceSession(host, { spaceId: id, auth, identity, http });
    spaces.bind(id, session.backend);
    await spaces.writePage(id, 'Hello.md', '# Hello\n\nEdited on this device.\n');
    await session.autoCommit.flushNow();
    expect(await unpushedCommitsOf(host, id)).toBe(1);

    const result = await session.pushNow();
    expect(result.status.state).toBe('synced');
    expect(await unpushedCommitsOf(host, id)).toBe(0);
    expect(git(bare, 'show', 'main:Hello.md')).toContain('Edited on this device.');
    expect(git(bare, 'log', '-1', '--format=%an <%ae>', 'main')).toBe(
      'Octo Cat <42+octo@users.noreply.github.com>',
    );
    // The space's state stays in the app's storage, out of the repository.
    expect(git(bare, 'ls-tree', '--name-only', 'main').split('\n')).toEqual([
      'Hello.md',
      'space.cept.yaml',
    ]);

    // Deleting a page is a file delete, committed and pushed.
    await spaces.deletePage(id, 'Hello.md');
    await session.pushNow();
    expect(git(bare, 'ls-tree', '--name-only', 'main').split('\n')).toEqual(['space.cept.yaml']);
    spaces.unbind(id);
    await session.dispose();
  });

  it('keeps an anonymous clone read-only, and a sign-in clone without a marker', async () => {
    makeRepo('plain', { 'README.md': '# Plain\n' });
    makeRepo('public', { 'space.cept.yaml': 'name: Public\n', 'Page.md': '# Page\n' });
    const host = newHost();

    const anonymous = await cloneRemoteRepo(host, {
      spaceId: generateRemoteSpaceId('https://github.com/octo/public', 'main'),
      url: 'https://github.com/octo/public',
      branch: 'main',
      http,
    });
    expect(anonymous).toMatchObject({ access: 'anonymous', writable: false });

    const noMarker = await cloneRemoteRepo(host, {
      spaceId: generateRemoteSpaceId('https://github.com/octo/plain', 'main'),
      url: 'https://github.com/octo/plain',
      branch: 'main',
      auth,
      http,
    });
    expect(noMarker).toMatchObject({ access: 'token', writable: false });
  });

  it('starts a space in a folder of a repository, committed and pushed', async () => {
    const bare = makeRepo('wiki', { 'README.md': '# Wiki\n' });
    const url = 'https://github.com/octo/wiki';
    const id = generateRemoteSpaceId(url, 'main', 'team');
    const host = newHost();
    const request = {
      spaceId: id,
      subPath: 'team',
      url,
      branch: 'main',
      name: 'Team',
      auth,
      identity,
      http,
    };

    await expect(startSpaceInRepo(host, request)).resolves.toEqual({ created: true });
    expect(git(bare, 'show', 'main:team/space.cept.yaml')).toContain('Team');
    expect(await isWritableClone(host, { id, subPath: 'team', access: 'token' })).toBe(true);

    // A folder that is already a space is opened as it is.
    await expect(startSpaceInRepo(host, request)).resolves.toEqual({ created: false });
  });

  it('pushes the commit of a start whose push failed when it is started again', async () => {
    const bare = makeRepo('retry', { 'README.md': '# Retry\n' });
    const url = 'https://github.com/octo/retry';
    const host = newHost();
    const request = {
      spaceId: generateRemoteSpaceId(url, 'main'),
      url,
      branch: 'main',
      name: 'Retry',
      auth,
      identity,
    };
    const offline: GitHttp = {
      request: (r) =>
        r.url.includes('git-receive-pack')
          ? Promise.reject(new Error('network down'))
          : http.request(r),
    };

    await expect(startSpaceInRepo(host, { ...request, http: offline })).rejects.toThrow(
      /could not be pushed/,
    );
    expect(() => git(bare, 'show', 'main:space.cept.yaml')).toThrow();

    await expect(startSpaceInRepo(host, { ...request, http })).resolves.toEqual({
      created: true,
    });
    expect(git(bare, 'show', 'main:space.cept.yaml')).toContain('Retry');
    expect(await unpushedCommitsOf(host, request.spaceId)).toBe(0);
  });

  it('will not start a space without the sign-in', async () => {
    makeRepo('nosignin', { 'README.md': '# x\n' });
    const url = 'https://github.com/octo/nosignin';
    await expect(
      startSpaceInRepo(newHost(), {
        spaceId: generateRemoteSpaceId(url, 'main'),
        url,
        branch: 'main',
        name: 'X',
        identity,
        http,
      }),
    ).rejects.toThrow(/GitHub sign-in/);
  });
});
