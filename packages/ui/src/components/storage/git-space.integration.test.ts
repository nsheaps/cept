/**
 * Writable GitHub spaces end to end (REQ-WS-027), against bare repositories
 * served by `git http-backend` at github.com-like URLs: a clone made with the
 * sign-in whose folder holds `space.cept.yaml` is writable, edits made through
 * its session are committed and pushed, an anonymous clone stays read-only,
 * a space can be started in a repository that has none, and a local space can
 * be published to a new repository.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  BrowserFsBackend,
  commitIdentityFor,
  listPageHistory,
  MemoryBackend,
  pageVersionContent,
} from '@cept/core';
import type { GitAuth, GitHttp } from '@cept/core';
import { SpaceManager, generateRemoteSpaceId } from './SpaceManager.js';
import {
  cloneRemoteRepo,
  isWritableClone,
  openGitSpaceSession,
  pageHistorySource,
  publishableFiles,
  publishSpaceToRepo,
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

describe('publishing a local space (REQ-WS-020)', () => {
  const enc = new TextEncoder();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255, 1, 2]);

  async function localSpace(files: Record<string, string | Uint8Array>): Promise<MemoryBackend> {
    const source = new MemoryBackend();
    for (const [file, data] of Object.entries(files)) {
      await source.writeFile(file, typeof data === 'string' ? enc.encode(data) : data);
    }
    return source;
  }

  const request = (name: string) => {
    const url = `https://github.com/octo/${name}`;
    return { spaceId: generateRemoteSpaceId(url, 'main'), url, branch: 'main', auth, identity };
  };

  it("pushes every file but dot folders, replacing GitHub's README, and reads nothing back in", async () => {
    const bare = makeRepo('published', { 'README.md': '# published\n' });
    const source = await localSpace({
      'space.cept.yaml': 'version: 1\nname: Notes\nslug: notes\n',
      'Home.md': '# Home\n',
      'notes/Day.md': '---\ntags: [a]\n---\n# Day\n',
      'assets/pic.png': png,
      '.cept/workspace-state.json': '{}',
    });
    const before = await publishableFiles(source);
    const host = newHost();

    await expect(
      publishSpaceToRepo(host, source, { ...request('published'), http }),
    ).resolves.toEqual({ files: 4 });

    expect(git(bare, 'ls-tree', '-r', '--name-only', 'main').split('\n')).toEqual([
      'Home.md',
      'assets/pic.png',
      'notes/Day.md',
      'space.cept.yaml',
    ]);
    expect(git(bare, 'show', 'main:notes/Day.md')).toBe('---\ntags: [a]\n---\n# Day');
    expect(execFileSync('git', ['show', 'main:assets/pic.png'], { cwd: bare })).toEqual(
      Buffer.from(png),
    );
    expect(await isWritableClone(host, { id: request('published').spaceId, access: 'token' })).toBe(
      true,
    );
    // The local space is only read.
    expect(await publishableFiles(source)).toEqual(before);
    expect(await source.exists('.cept/workspace-state.json')).toBe(true);
  });

  it("keeps the space's own README", async () => {
    const bare = makeRepo('own-readme', { 'README.md': '# own-readme\n' });
    const source = await localSpace({
      'space.cept.yaml': 'version: 1\nname: R\nslug: r\n',
      'README.md': '# Mine\n',
    });
    await publishSpaceToRepo(newHost(), source, { ...request('own-readme'), http });
    expect(git(bare, 'show', 'main:README.md')).toBe('# Mine');
  });

  it('pushes the commit of a publish whose push failed when published again', async () => {
    const bare = makeRepo('pub-retry', { 'README.md': '# x\n' });
    const source = await localSpace({
      'space.cept.yaml': 'version: 1\nname: R\nslug: r\n',
      'Page.md': 'text',
    });
    const host = newHost();
    const offline: GitHttp = {
      request: (r) =>
        r.url.includes('git-receive-pack')
          ? Promise.reject(new Error('network down'))
          : http.request(r),
    };

    await expect(
      publishSpaceToRepo(host, source, { ...request('pub-retry'), http: offline }),
    ).rejects.toThrow(/could not be pushed/);
    expect(() => git(bare, 'show', 'main:Page.md')).toThrow();

    await publishSpaceToRepo(host, source, { ...request('pub-retry'), http });
    expect(git(bare, 'show', 'main:Page.md')).toBe('text');
    expect(await unpushedCommitsOf(host, request('pub-retry').spaceId)).toBe(0);
  });

  it('pushes nothing when a file does not copy byte for byte', async () => {
    const bare = makeRepo('pub-corrupt', { 'README.md': '# x\n' });
    const source = await localSpace({
      'space.cept.yaml': 'version: 1\nname: C\nslug: c\n',
      'Page.md': 'text',
    });
    const host = newHost();
    const write = host.writeFile.bind(host);
    // A misbehaving store that changes what it is given for one file.
    host.writeFile = (file, data) =>
      write(file, file.endsWith('Page.md') ? enc.encode('changed') : data);

    await expect(
      publishSpaceToRepo(host, source, { ...request('pub-corrupt'), http }),
    ).rejects.toThrow(/"Page\.md" did not copy correctly; nothing was pushed/);
    expect(git(bare, 'ls-tree', '--name-only', 'main')).toBe('README.md');
  });

  it('refuses a space without a marker, or without the sign-in', async () => {
    makeRepo('pub-refused', { 'README.md': '# x\n' });
    const flat = await localSpace({ '.cept/workspace-state.json': '{}' });
    await expect(
      publishSpaceToRepo(newHost(), flat, { ...request('pub-refused'), http }),
    ).rejects.toThrow(/space\.cept\.yaml/);
    const marked = await localSpace({ 'space.cept.yaml': 'version: 1\nname: X\nslug: x\n' });
    await expect(
      publishSpaceToRepo(newHost(), marked, { ...request('pub-refused'), auth: undefined, http }),
    ).rejects.toThrow(/GitHub sign-in/);
  });
});

describe('page history (REQ-NTN-016)', () => {
  /** Change `file` in `octo/<name>` with a new commit pushed to the bare repository. */
  function pushChange(name: string, file: string, text: string, message: string): void {
    const work = path.join(root, `${name}-work`);
    writeFileSync(path.join(work, file), text);
    git(work, 'add', '-A');
    git(work, '-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-qm', message);
    git(work, 'push', '-q', path.join(root, 'octo', name), 'main');
  }

  it("reads a folder page's history from a read-only clone, older versions on request", async () => {
    makeRepo('handbook', { 'docs/Team/index.md': '# Team\n', 'docs/Other.md': '# Other\n' });
    pushChange('handbook', 'docs/Team/index.md', '# Team\n\nUpdated.\n', 'update team');
    const url = 'https://github.com/octo/handbook';
    const id = generateRemoteSpaceId(url, 'main', 'docs');
    const host = newHost();
    await cloneRemoteRepo(host, { spaceId: id, url, branch: 'main', subPath: 'docs', http });

    const space = { id, remoteUrl: url, subPath: 'docs', branch: 'main' };
    const source = await pageHistorySource(host, space, 'Team', { http });
    expect(source?.path).toBe('docs/Team/index.md');
    const shallow = await listPageHistory(source!.git, source!.path);
    expect(shallow).toMatchObject({ truncated: true });
    expect(shallow.commits.map((c) => c.message)).toEqual(['update team']);

    await source!.git.fetchFullHistory(source!.ref);
    const full = await listPageHistory(source!.git, source!.path);
    expect(full.commits.map((c) => c.message)).toEqual(['update team', 'first']);
    expect(await pageVersionContent(source!.git, source!.path, full.commits[1]!.hash)).toBe(
      '# Team\n',
    );
    // A folder page without a file of its own has no history.
    expect(await pageHistorySource(host, space, 'Missing', { http })).toBeNull();
  });

  it('restores an older version in a writable space as a new pushed commit', async () => {
    const bare = makeRepo('journal', { 'space.cept.yaml': 'name: Journal\n', 'Day.md': 'one\n' });
    pushChange('journal', 'Day.md', 'two\n', 'second');
    const url = 'https://github.com/octo/journal';
    const id = generateRemoteSpaceId(url, 'main');
    const host = newHost();
    const cloned = await cloneRemoteRepo(host, { spaceId: id, url, branch: 'main', auth, http });
    const spaces = new SpaceManager(host);
    await spaces.createRemote('Journal', url, 'main', undefined, cloned.access, { writable: true });
    await spaces.open(id, 'Journal');
    const session = await openGitSpaceSession(host, { spaceId: id, auth, identity, http });
    spaces.bind(id, session.backend);

    const source = await pageHistorySource(host, { id, remoteUrl: url }, 'Day.md', {
      sessionGit: session.git,
    });
    expect(source?.git).toBe(session.git);
    await source!.git.fetchFullHistory(source!.ref);
    const [, first] = (await listPageHistory(source!.git, source!.path)).commits;
    const old = await pageVersionContent(source!.git, source!.path, first!.hash);
    await spaces.writePage(id, 'Day.md', old!);
    await session.autoCommit.flushNow();
    const result = await session.pushNow();
    await session.dispose();

    expect(result.status.state).toBe('synced');
    expect(git(bare, 'show', 'main:Day.md')).toBe('one');
    expect(git(bare, 'log', '--format=%s', 'main').split('\n')).toHaveLength(3);
  });
});
