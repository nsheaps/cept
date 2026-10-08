/**
 * syncRemoteClone against a real Git server: `git http-backend` (the CGI that
 * serves smart HTTP) behind an in-process GitHttp, over throwaway repos. The
 * server can require a token, as GitHub does for a private repository.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { BrowserFsBackend } from './browser-fs.js';
import { GitBackend, GitDivergedError } from './git-backend.js';
import type { GitFs, GitHttp } from './git-backend.js';
import { GitAuthRequiredError, remoteCloneDir, syncRemoteClone } from './git-clone.js';
import type { RemoteCloneOptions } from './git-clone.js';

const README = '---\ntitle: Hello\n# a yaml comment\n---\n\n# Hello\n';
const TOKEN = 'ghp_integrationToken123';
/** A token the server knows but that may not read `private.git`. */
const OTHER_TOKEN = 'ghp_otherToken456';

let root = '';
/** Requests the server has answered, newest last. */
const requests: { path: string; status: number }[] = [];

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function commit(work: string, message: string): void {
  git(work, 'add', '-A');
  git(work, '-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-qm', message);
}

/** The token in a Basic `Authorization` header, as user name or password. */
function tokenIn(header: string | undefined): string | undefined {
  if (!header?.startsWith('Basic ')) return undefined;
  const [user, pass] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(':');
  return [user, pass].find((part) => part?.startsWith('ghp_'));
}

/** Smart-HTTP response for a refused request, before `git http-backend` runs. */
function refuse(url: string, method: string, status: 401 | 403) {
  return {
    url,
    method,
    statusCode: status,
    statusMessage: status === 401 ? 'Unauthorized' : 'Forbidden',
    headers: status === 401 ? { 'www-authenticate': 'Basic realm="git"' } : {},
    body: (async function* () {
      yield new TextEncoder().encode('denied\n');
    })(),
  };
}

/**
 * A GitHttp that runs `git http-backend` for each request, serving repos
 * under `root`. `private.git` needs {@link TOKEN}; {@link OTHER_TOKEN} gets a 403.
 */
const httpBackend: GitHttp = {
  async request({ url, method = 'GET', headers = {}, body }) {
    const { pathname, search } = new URL(url);
    if (pathname.startsWith('/private.git')) {
      const token = tokenIn(headers.Authorization ?? headers.authorization);
      if (token !== TOKEN) {
        const status = token === OTHER_TOKEN ? 403 : 401;
        requests.push({ path: pathname, status });
        return refuse(url, method, status);
      }
    }
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
    const head = raw.subarray(0, split).toString('utf8');
    const responseHeaders: Record<string, string> = {};
    for (const line of head.split('\r\n')) {
      const colon = line.indexOf(':');
      responseHeaders[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim();
    }
    const status = Number((responseHeaders.status ?? '200').split(' ')[0]);
    requests.push({ path: pathname, status });
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

/** A working copy pushing to `<name>.git`, with README and a guide committed. */
function makeRepo(name: string): string {
  const work = path.join(root, `${name}-work`);
  mkdirSync(path.join(work, 'docs'), { recursive: true });
  writeFileSync(path.join(work, 'README.md'), README);
  writeFileSync(path.join(work, 'docs', 'guide.md'), '# Guide\n');
  git(root, 'init', '-q', '-b', 'main', `${name}-work`);
  commit(work, 'first');
  writeFileSync(path.join(work, 'docs', 'guide.md'), '# Guide\n\nMore.\n');
  commit(work, 'second');
  git(root, 'clone', '-q', '--bare', `${name}-work`, `${name}.git`);
  git(work, 'remote', 'add', 'origin', path.join(root, `${name}.git`));
  return work;
}

let privateWork = '';
let rewrittenWork = '';

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'cept-git-clone-'));
  makeRepo('public');
  privateWork = makeRepo('private');
  rewrittenWork = makeRepo('rewritten');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  requests.length = 0;
});

const decode = (data: Uint8Array | null) => new TextDecoder().decode(data ?? undefined);

function setup(repo: string, extra: Partial<RemoteCloneOptions> = {}) {
  const host = new BrowserFsBackend(`git-clone-${crypto.randomUUID()}`);
  const fs = host.getRawFs() as unknown as GitFs;
  const options: RemoteCloneOptions = {
    host,
    fs,
    dir: remoteCloneDir(`git.test/${repo}@main`),
    url: `http://git.test/${repo}.git`,
    http: httpBackend,
    ...extra,
  };
  return { host, fs, options };
}

describe('syncRemoteClone', () => {
  it('clones a public repository anonymously into the given directory', async () => {
    const { host, options } = setup('public');
    const result = await syncRemoteClone(options);

    expect(result.action).toBe('cloned');
    expect(result.dir).toBe('/.cept/git-repos/git.test%2Fpublic%40main');
    expect(decode(await host.readFile(`${result.dir}/README.md`))).toBe(README);
    expect(await host.exists(`${result.dir}/docs/guide.md`)).toBe(true);
  });

  it('clones a private repository with a token, then fetches into the same clone', async () => {
    const { host, fs, options } = setup('private', { auth: { token: TOKEN } });
    const first = await syncRemoteClone(options);
    expect(first.action).toBe('cloned');

    const same = await syncRemoteClone(options);
    expect(same).toEqual({ ...first, action: 'unchanged' });

    // A new commit arrives by fetch and fast-forward, not by a new clone.
    writeFileSync(path.join(privateWork, 'new.md'), '# New\n');
    commit(privateWork, 'third');
    git(privateWork, 'push', '-q', 'origin', 'main');
    const marker = `${first.dir}/.git/cept-kept`;
    await host.writeFile(marker, new TextEncoder().encode('still here'));

    const next = await syncRemoteClone(options);
    expect(next.action).toBe('updated');
    expect(next.head).not.toBe(first.head);
    expect(decode(await host.readFile(`${next.dir}/new.md`))).toBe('# New\n');
    expect(await host.exists(marker)).toBe(true);
    const repo = new GitBackend({ underlying: host, dir: next.dir, fs });
    expect((await repo.log()).map((c) => c.message.trim())).toEqual(['third', 'second']);
  });

  it('asks for a sign-in on a 401 without retrying, and leaves no clone behind', async () => {
    const { host, options } = setup('private');
    const error = await syncRemoteClone(options).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(GitAuthRequiredError);
    expect((error as GitAuthRequiredError).status).toBe(401);
    expect(requests).toEqual([{ path: '/private.git/info/refs', status: 401 }]);
    expect(await host.exists(options.dir)).toBe(false);
  });

  it('asks for a sign-in once when the token is rejected', async () => {
    const { options } = setup('private', { auth: { token: 'ghp_revoked' } });
    const error = await syncRemoteClone(options).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(GitAuthRequiredError);
    expect((error as Error).message).not.toContain('ghp_revoked');
    // isomorphic-git asks once without and once with the token; nothing after that.
    expect(requests.length).toBeLessThanOrEqual(2);
  });

  it('reports a 403 when the token cannot read the repository', async () => {
    const { options } = setup('private', { auth: { token: OTHER_TOKEN } });
    const error = await syncRemoteClone(options).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(GitAuthRequiredError);
    expect((error as GitAuthRequiredError).status).toBe(403);
  });

  it('asks for a sign-in when a kept clone loses access', async () => {
    const { options } = setup('private', { auth: { token: TOKEN } });
    await syncRemoteClone(options);
    const error = await syncRemoteClone({ ...options, auth: undefined }).catch(
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(GitAuthRequiredError);
  });

  it('clones only the latest commit unless full history is asked for', async () => {
    const shallow = setup('public');
    const full = setup('public', { fullHistory: true });
    const a = await syncRemoteClone(shallow.options);
    const b = await syncRemoteClone(full.options);
    const log = (s: typeof shallow, dir: string) =>
      new GitBackend({ underlying: s.host, dir, fs: s.fs }).log();

    expect(await log(shallow, a.dir)).toHaveLength(1);
    expect((await log(full, b.dir)).map((c) => c.message.trim())).toEqual(['second', 'first']);
  });

  it('fetches the missing history into a shallow clone when asked', async () => {
    const { host, fs, options } = setup('public');
    const first = await syncRemoteClone(options);
    await syncRemoteClone({ ...options, fullHistory: true });
    const log = await new GitBackend({ underlying: host, dir: first.dir, fs }).log();
    expect(log.length).toBeGreaterThanOrEqual(2);
  });

  it('stops on a rewritten remote branch unless told to take the remote files', async () => {
    const { host, options } = setup('rewritten');
    await syncRemoteClone(options);

    git(rewrittenWork, 'reset', '-q', '--hard', 'HEAD~1');
    writeFileSync(path.join(rewrittenWork, 'README.md'), '# Rewritten\n');
    commit(rewrittenWork, 'rewritten');
    git(rewrittenWork, 'push', '-qf', 'origin', 'main');

    await expect(syncRemoteClone(options)).rejects.toBeInstanceOf(GitDivergedError);
    const reset = await syncRemoteClone({ ...options, resetOnDivergence: true });
    expect(reset.action).toBe('updated');
    expect(decode(await host.readFile(`${reset.dir}/README.md`))).toBe('# Rewritten\n');
  });

  it('starts again over a half-written clone', async () => {
    const { host, options } = setup('public');
    await host.writeFile(`${options.dir}/.git/HEAD`, new TextEncoder().encode('ref: x\n'));
    const result = await syncRemoteClone(options);
    expect(result.action).toBe('cloned');
    expect(decode(await host.readFile(`${result.dir}/README.md`))).toBe(README);
  });

  it("leaves the host's workspace config and pages alone", async () => {
    const { host, options } = setup('public');
    const config = 'name: "Mine"\n';
    await host.writeFile('.cept/config.yaml', new TextEncoder().encode(config));
    await syncRemoteClone(options);
    expect(decode(await host.readFile('.cept/config.yaml'))).toBe(config);
    expect(await host.exists('pages/index.md')).toBe(false);
  });

  it('rejects a missing repository and cleans up', async () => {
    const { host, options } = setup('missing');
    await expect(syncRemoteClone(options)).rejects.toThrow();
    expect(await host.exists(options.dir)).toBe(false);
  });
});
