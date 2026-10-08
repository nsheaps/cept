/**
 * withShallowClone against a real Git server: `git http-backend` (the CGI that
 * serves smart HTTP) behind an in-process GitHttp, over a throwaway repo.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { BrowserFsBackend } from './browser-fs.js';
import type { GitFs, GitHttp } from './git-backend.js';
import { GIT_CLONES_DIR, withShallowClone } from './git-clone.js';

const README = '---\ntitle: Hello\n# a yaml comment\n---\n\n# Hello\n';

let root = '';
let requests = 0;

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

/** A GitHttp that runs `git http-backend` for each request, serving repos under `root`. */
const httpBackend: GitHttp = {
  async request({ url, method = 'GET', headers = {}, body }) {
    requests++;
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
    const head = raw.subarray(0, split).toString('utf8');
    const responseHeaders: Record<string, string> = {};
    for (const line of head.split('\r\n')) {
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

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'cept-git-clone-'));
  const work = path.join(root, 'work');
  mkdirSync(path.join(work, 'docs'), { recursive: true });
  writeFileSync(path.join(work, 'README.md'), README);
  writeFileSync(path.join(work, 'docs', 'guide.md'), '# Guide\n');
  git(root, 'init', '-q', '-b', 'main', 'work');
  git(work, 'add', '.');
  git(work, '-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-qm', 'first');
  git(root, 'clone', '-q', '--bare', 'work', 'repo.git');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function host(): BrowserFsBackend {
  return new BrowserFsBackend(`git-clone-${crypto.randomUUID()}`);
}

describe('withShallowClone', () => {
  it('hands the reader the cloned files, front matter intact, then deletes the clone', async () => {
    const backend = host();
    let cloneDir = '';
    const readme = await withShallowClone(
      {
        host: backend,
        fs: backend.getRawFs() as unknown as GitFs,
        url: 'http://git.test/repo.git',
        http: httpBackend,
      },
      async (dir) => {
        cloneDir = dir;
        expect(await backend.exists(`${dir}/docs/guide.md`)).toBe(true);
        return new TextDecoder().decode((await backend.readFile(`${dir}/README.md`)) ?? undefined);
      },
    );
    expect(requests).toBeGreaterThan(0);
    expect(readme).toBe(README);
    expect(cloneDir.startsWith(`${GIT_CLONES_DIR}/`)).toBe(true);
    expect(await backend.exists(cloneDir)).toBe(false);
  });

  it('deletes the clone when the reader throws', async () => {
    const backend = host();
    let cloneDir = '';
    await expect(
      withShallowClone(
        {
          host: backend,
          fs: backend.getRawFs() as unknown as GitFs,
          url: 'http://git.test/repo.git',
          http: httpBackend,
        },
        async (dir) => {
          cloneDir = dir;
          throw new Error('reader failed');
        },
      ),
    ).rejects.toThrow('reader failed');
    expect(cloneDir).not.toBe('');
    expect(await backend.exists(cloneDir)).toBe(false);
  });

  it('cleans up and rejects when the clone fails, without calling the reader', async () => {
    const backend = host();
    let called = false;
    await expect(
      withShallowClone(
        {
          host: backend,
          fs: backend.getRawFs() as unknown as GitFs,
          url: 'http://git.test/missing.git',
          http: httpBackend,
        },
        async () => {
          called = true;
        },
      ),
    ).rejects.toThrow();
    expect(called).toBe(false);
    expect(await backend.listDirectory(GIT_CLONES_DIR)).toEqual([]);
  });
});
