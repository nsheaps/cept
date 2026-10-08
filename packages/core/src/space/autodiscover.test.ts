import { describe, expect, it } from 'vitest';
import { autodiscoverSpaces, MemoryEtagCache } from './autodiscover.js';
import type { RemoteSpace } from './autodiscover.js';

const API = 'https://api.github.com';

interface MockRepo {
  full_name: string;
  default_branch?: string;
  private?: boolean;
  fork?: boolean;
  archived?: boolean;
  /** Path → file text. Omit for a repo whose tree request fails with `treeStatus`. */
  files?: Record<string, string>;
  treeStatus?: number;
  /** Extra headers on the failed tree response. */
  treeHeaders?: Record<string, string>;
  truncated?: boolean;
}

interface Call {
  url: string;
  ifNoneMatch: string | null;
  authorization: string | null;
}

function b64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

function shaOf(text: string): string {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return `sha${(h >>> 0).toString(16)}`;
}

function json(body: unknown, init: ResponseInit = {}, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** A fake GitHub REST API over `repos`, recording every call. */
function mockGitHub(
  repos: MockRepo[],
  opts: { perPage?: number; rateRemaining?: (n: number) => number } = {},
) {
  const calls: Call[] = [];
  const blobs = new Map<string, string>();
  const perPage = opts.perPage ?? 100;
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const ifNoneMatch = headers.get('If-None-Match');
    calls.push({ url: url.toString(), ifNoneMatch, authorization: headers.get('Authorization') });
    const rate = {
      'X-RateLimit-Remaining': String(opts.rateRemaining?.(calls.length) ?? 4000),
      'X-RateLimit-Reset': '1900000000',
    };
    const etag = `"${url.pathname}${url.search}"`;
    if (ifNoneMatch === etag) return new Response(null, { status: 304, headers: rate });
    const withTag = { ...rate, ETag: etag };

    if (url.pathname === '/user/repos') {
      const page = Number(url.searchParams.get('page') ?? '1');
      const slice = repos.slice((page - 1) * perPage, page * perPage);
      const more = page * perPage < repos.length;
      const link = more
        ? { Link: `<${API}/user/repos?per_page=${perPage}&page=${page + 1}>; rel="next"` }
        : {};
      return json(
        slice.map((r) => ({
          full_name: r.full_name,
          name: r.full_name.split('/')[1],
          html_url: `https://github.com/${r.full_name}`,
          private: r.private ?? false,
          fork: r.fork ?? false,
          archived: r.archived ?? false,
          default_branch: r.default_branch ?? 'main',
        })),
        {},
        { ...withTag, ...link },
      );
    }
    const tree = /^\/repos\/([^/]+\/[^/]+)\/git\/trees\/(.+)$/.exec(url.pathname);
    if (tree) {
      const repo = repos.find((r) => r.full_name === tree[1]);
      if (!repo) return json({ message: 'Not Found' }, { status: 404 }, rate);
      if (repo.treeStatus)
        return json(
          { message: 'nope' },
          { status: repo.treeStatus },
          { ...rate, ...repo.treeHeaders },
        );
      expect(decodeURIComponent(tree[2])).toBe(repo.default_branch ?? 'main');
      expect(url.searchParams.get('recursive')).toBe('1');
      const entries: { path: string; type: string; sha: string }[] = [];
      const dirs = new Set<string>();
      for (const [path, text] of Object.entries(repo.files ?? {})) {
        const sha = shaOf(path + text);
        blobs.set(sha, text);
        entries.push({ path, type: 'blob', sha });
        const parts = path.split('/');
        for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
      }
      for (const d of dirs) entries.push({ path: d, type: 'tree', sha: shaOf(d) });
      return json({ sha: 'root', tree: entries, truncated: repo.truncated ?? false }, {}, withTag);
    }
    const blob = /^\/repos\/[^/]+\/[^/]+\/git\/blobs\/(.+)$/.exec(url.pathname);
    if (blob) {
      const text = blobs.get(blob[1]);
      if (text === undefined) return json({ message: 'Not Found' }, { status: 404 }, rate);
      return json({ content: b64(text), encoding: 'base64' }, {}, withTag);
    }
    return json({ message: 'Not Found' }, { status: 404 }, rate);
  };
  return { fetch: fetchFn as typeof globalThis.fetch, calls };
}

const marker = (name: string, slug: string, extra = '') =>
  `version: '1'\nname: ${name}\nslug: ${slug}\n${extra}`;

function byKey(spaces: RemoteSpace[]) {
  return spaces.map((s) => `${s.repo}:${s.path}`).sort();
}

describe('autodiscoverSpaces (REQ-WS-023)', () => {
  it('finds two spaces in one repository and reports their names and branches', async () => {
    const gh = mockGitHub([
      {
        full_name: 'ann/notes',
        default_branch: 'trunk',
        private: true,
        files: {
          'work/space.cept.yaml': marker('Work', 'work'),
          'work/todo.md': '# Todo',
          'home/space.cept.yml': marker('Home', 'home', 'branch: personal\n'),
          'README.md': '# hi',
        },
      },
    ]);
    const result = await autodiscoverSpaces({ token: 'ghp_x', fetch: gh.fetch });
    expect(result.complete).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(byKey(result.spaces)).toEqual(['ann/notes:home', 'ann/notes:work']);
    const work = result.spaces.find((s) => s.path === 'work');
    expect(work).toMatchObject({
      repo: 'ann/notes',
      url: 'https://github.com/ann/notes',
      marker: 'space.cept.yaml',
      name: 'Work',
      slug: 'work',
      branch: 'trunk',
      defaultBranch: 'trunk',
      private: true,
      errors: [],
    });
    const home = result.spaces.find((s) => s.path === 'home');
    expect(home).toMatchObject({ marker: 'space.cept.yml', name: 'Home', branch: 'personal' });
    expect(gh.calls.every((c) => c.authorization === 'Bearer ghp_x')).toBe(true);
  });

  it('skips forks and archived repositories without reading their trees', async () => {
    const files = { 'space.cept.yaml': marker('S', 's') };
    const gh = mockGitHub([
      { full_name: 'ann/fork', fork: true, files },
      { full_name: 'ann/old', archived: true, files },
      { full_name: 'ann/live', files },
    ]);
    const result = await autodiscoverSpaces({ token: 't', fetch: gh.fetch });
    expect(byKey(result.spaces)).toEqual(['ann/live:']);
    expect(gh.calls.some((c) => c.url.includes('ann/fork'))).toBe(false);
    expect(gh.calls.some((c) => c.url.includes('ann/old'))).toBe(false);
  });

  it('keeps going when one repository answers 403, with a warning', async () => {
    const gh = mockGitHub([
      { full_name: 'org/secret', treeStatus: 403 },
      { full_name: 'org/open', files: { 'docs/space.cept.yaml': marker('Docs', 'docs') } },
    ]);
    const result = await autodiscoverSpaces({ token: 't', fetch: gh.fetch });
    expect(byKey(result.spaces)).toEqual(['org/open:docs']);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ kind: 'access', repo: 'org/secret' });
    expect(result.complete).toBe(true);
  });

  it('keeps the request URL, and any credentials in it, out of http warnings', async () => {
    const gh = mockGitHub([{ full_name: 'org/flaky', treeStatus: 502 }]);
    const result = await autodiscoverSpaces({
      token: 't',
      fetch: gh.fetch,
      apiBase: 'https://user:hunter2@api.github.com',
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ kind: 'http', repo: 'org/flaky' });
    expect(result.warnings[0]?.message).toBe('org/flaky: GitHub answered 502; skipped');
  });

  it('reports a marker inside a space as nested, not as a space (D-3)', async () => {
    const gh = mockGitHub([
      {
        full_name: 'ann/nest',
        files: {
          'space.cept.yaml': marker('Outer', 'outer'),
          'inner/space.cept.yaml': marker('Inner', 'inner'),
          'inner/deeper/space.cept.yml': marker('Deeper', 'deeper'),
        },
      },
    ]);
    const result = await autodiscoverSpaces({ token: 't', fetch: gh.fetch });
    expect(byKey(result.spaces)).toEqual(['ann/nest:']);
    const nested = result.warnings.filter((w) => w.kind === 'nested-marker');
    expect(nested.map((w) => w.path).sort()).toEqual(['inner', 'inner/deeper']);
    // Nested markers are not read.
    expect(gh.calls.filter((c) => c.url.includes('/git/blobs/'))).toHaveLength(1);
  });

  it('ignores markers in dot folders and records bad markers and duplicate slugs as errors', async () => {
    const gh = mockGitHub([
      {
        full_name: 'ann/mixed',
        files: {
          '.github/space.cept.yaml': marker('Hidden', 'hidden'),
          'a/space.cept.yaml': marker('A', 'same'),
          'b/space.cept.yaml': marker('B', 'same'),
          'c/space.cept.yaml': 'name: [unclosed',
        },
      },
    ]);
    const result = await autodiscoverSpaces({ token: 't', fetch: gh.fetch });
    expect(byKey(result.spaces)).toEqual(['ann/mixed:a', 'ann/mixed:b', 'ann/mixed:c']);
    const get = (p: string) => result.spaces.find((s) => s.path === p);
    expect(get('a')?.errors[0]).toContain('duplicate slug "same"');
    expect(get('b')?.errors[0]).toContain('duplicate slug "same"');
    expect(get('c')?.errors.length).toBeGreaterThan(0);
    expect(get('c')).toMatchObject({ name: 'c', slug: null });
  });

  it('warns when both marker extensions are present and uses the .yaml one', async () => {
    const gh = mockGitHub([
      {
        full_name: 'ann/both',
        files: {
          'space.cept.yaml': marker('Yaml', 'yaml'),
          'space.cept.yml': marker('Yml', 'yml'),
        },
      },
    ]);
    const result = await autodiscoverSpaces({ token: 't', fetch: gh.fetch });
    expect(result.spaces).toHaveLength(1);
    expect(result.spaces[0]).toMatchObject({ name: 'Yaml', marker: 'space.cept.yaml' });
    expect(result.spaces[0].warnings.length).toBe(1);
  });

  it('pages through /user/repos and treats an empty repository as having no spaces', async () => {
    const repos: MockRepo[] = [];
    for (let i = 0; i < 5; i++) {
      repos.push({
        full_name: `ann/r${i}`,
        files: { 'space.cept.yaml': marker(`R${i}`, `r${i}`) },
      });
    }
    repos.push({ full_name: 'ann/empty', treeStatus: 409 });
    const gh = mockGitHub(repos, { perPage: 2 });
    const result = await autodiscoverSpaces({ token: 't', fetch: gh.fetch });
    expect(result.spaces).toHaveLength(5);
    expect(result.warnings).toEqual([]);
    expect(gh.calls.filter((c) => c.url.includes('/user/repos')).length).toBe(3);
  });

  it('warns that a truncated tree may be missing spaces', async () => {
    const gh = mockGitHub([
      { full_name: 'ann/huge', truncated: true, files: { 'space.cept.yaml': marker('H', 'h') } },
    ]);
    const result = await autodiscoverSpaces({ token: 't', fetch: gh.fetch });
    expect(result.spaces).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ kind: 'truncated', repo: 'ann/huge' });
  });

  it('sends ETags from the cache and reuses 304 answers', async () => {
    const gh = mockGitHub([
      { full_name: 'ann/notes', files: { 'space.cept.yaml': marker('N', 'n') } },
    ]);
    const cache = new MemoryEtagCache();
    const first = await autodiscoverSpaces({ token: 't', fetch: gh.fetch, cache });
    const firstCalls = gh.calls.length;
    const second = await autodiscoverSpaces({ token: 't', fetch: gh.fetch, cache });
    expect(second.spaces).toEqual(first.spaces);
    const again = gh.calls.slice(firstCalls);
    // The list and the tree are revalidated; the blob is cached by its sha.
    expect(again.map((c) => new URL(c.url).pathname)).toEqual([
      '/user/repos',
      '/repos/ann/notes/git/trees/main',
    ]);
    expect(again.every((c) => c.ifNoneMatch !== null)).toBe(true);
  });

  it('stops early when the rate limit runs out and keeps what it found', async () => {
    const repos: MockRepo[] = [];
    for (let i = 0; i < 6; i++) {
      repos.push({
        full_name: `ann/r${i}`,
        files: { 'space.cept.yaml': marker(`R${i}`, `r${i}`) },
      });
    }
    // Calls: 1 repo list, then tree + blob per repo. Run out after the second repo.
    const gh = mockGitHub(repos, { rateRemaining: (n) => (n >= 5 ? 0 : 100) });
    const result = await autodiscoverSpaces({ token: 't', fetch: gh.fetch, concurrency: 1 });
    expect(result.complete).toBe(false);
    expect(result.spaces.length).toBeGreaterThanOrEqual(2);
    expect(result.spaces.length).toBeLessThan(6);
    expect(result.warnings.some((w) => w.kind === 'rate-limited')).toBe(true);
    expect(result.rateLimit?.remaining).toBe(0);
    expect(result.rateLimit?.resetAt).toBe(1900000000 * 1000);
  });

  it('never runs more than `concurrency` requests at once', async () => {
    const repos: MockRepo[] = [];
    for (let i = 0; i < 10; i++) {
      repos.push({
        full_name: `ann/r${i}`,
        files: { 'space.cept.yaml': marker(`R${i}`, `r${i}`) },
      });
    }
    const gh = mockGitHub(repos);
    let active = 0;
    let peak = 0;
    const slow: typeof globalThis.fetch = async (input, init) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 2));
      try {
        return await gh.fetch(input, init);
      } finally {
        active--;
      }
    };
    const result = await autodiscoverSpaces({ token: 't', fetch: slow, concurrency: 3 });
    expect(result.spaces).toHaveLength(10);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('flags earlier spaces whose repository is no longer readable', async () => {
    const gh = mockGitHub([
      { full_name: 'ann/kept', files: { 'space.cept.yaml': marker('K', 'k') } },
      { full_name: 'ann/locked', treeStatus: 404 },
      { full_name: 'ann/shelved', archived: true, files: { 'space.cept.yaml': marker('S', 's') } },
    ]);
    const first: RemoteSpace = {
      repo: 'ann/gone',
      url: 'https://github.com/ann/gone',
      path: 'notes',
      marker: 'space.cept.yaml',
      name: 'Gone',
      slug: 'gone',
      branch: 'main',
      defaultBranch: 'main',
      private: true,
      errors: [],
      warnings: [],
    };
    const locked = { ...first, repo: 'ann/locked', url: 'https://github.com/ann/locked' };
    const kept = { ...first, repo: 'ann/kept', url: 'https://github.com/ann/kept', path: '' };
    const removed = { ...first, repo: 'ann/kept', url: 'https://github.com/ann/kept', path: 'old' };
    const shelved = {
      ...first,
      repo: 'ann/shelved',
      url: 'https://github.com/ann/shelved',
      path: '',
    };
    const result = await autodiscoverSpaces({
      token: 't',
      fetch: gh.fetch,
      previous: [first, locked, kept, removed, shelved],
    });
    expect(result.lost.map((l) => [l.space.repo, l.space.path, l.reason])).toEqual([
      ['ann/gone', 'notes', 'access'],
      ['ann/locked', 'notes', 'access'],
      ['ann/kept', 'old', 'removed'],
      ['ann/shelved', '', 'excluded'],
    ]);
  });

  it('treats a secondary rate limit (403 with Retry-After) as the rate limit, not as denied access', async () => {
    const files = { 'space.cept.yaml': marker('S', 's') };
    const gh = mockGitHub([
      { full_name: 'ann/a', files },
      { full_name: 'ann/b', treeStatus: 403, treeHeaders: { 'Retry-After': '60' } },
      { full_name: 'ann/c', files },
    ]);
    const result = await autodiscoverSpaces({ token: 't', fetch: gh.fetch, concurrency: 1 });
    expect(result.complete).toBe(false);
    expect(result.warnings.some((w) => w.kind === 'access')).toBe(false);
    expect(result.warnings.some((w) => w.kind === 'rate-limited')).toBe(true);
    expect(byKey(result.spaces)).toEqual(['ann/a:']);
    expect(gh.calls.some((c) => c.url.includes('ann/c'))).toBe(false);
  });

  it('rejects when the signal aborts, without reading further repositories', async () => {
    const repos: MockRepo[] = [];
    for (let i = 0; i < 5; i++) {
      repos.push({
        full_name: `ann/r${i}`,
        files: { 'space.cept.yaml': marker(`R${i}`, `r${i}`) },
      });
    }
    const gh = mockGitHub(repos);
    const controller = new AbortController();
    const aborting: typeof globalThis.fetch = (input, init) => {
      if (String(input).includes('ann/r1/git/trees')) controller.abort(new Error('cancelled'));
      if (init?.signal?.aborted) return Promise.reject(init.signal.reason);
      return gh.fetch(input, init);
    };
    await expect(
      autodiscoverSpaces({
        token: 't',
        fetch: aborting,
        concurrency: 1,
        signal: controller.signal,
      }),
    ).rejects.toThrow('cancelled');
    expect(gh.calls.some((c) => c.url.includes('ann/r2'))).toBe(false);
  });

  it('rejects at once with an already aborted signal', async () => {
    const gh = mockGitHub([]);
    const controller = new AbortController();
    controller.abort(new Error('never mind'));
    await expect(
      autodiscoverSpaces({ token: 't', fetch: gh.fetch, signal: controller.signal }),
    ).rejects.toThrow('never mind');
    expect(gh.calls).toHaveLength(0);
  });

  it('rejects when GitHub refuses the token', async () => {
    const fetchFn = (async () =>
      new Response('{"message":"Bad credentials"}', { status: 401 })) as typeof globalThis.fetch;
    await expect(autodiscoverSpaces({ token: 'ghp_secret', fetch: fetchFn })).rejects.toMatchObject(
      {
        name: 'AutodiscoveryError',
        status: 401,
      },
    );
  });

  it('only reads (GET) and never clones', async () => {
    const methods: string[] = [];
    const gh = mockGitHub([
      { full_name: 'ann/notes', files: { 'space.cept.yaml': marker('N', 'n') } },
    ]);
    const spy: typeof globalThis.fetch = (input, init) => {
      methods.push(init?.method ?? 'GET');
      return gh.fetch(input, init);
    };
    await autodiscoverSpaces({ token: 't', fetch: spy });
    expect(new Set(methods)).toEqual(new Set(['GET']));
    expect(gh.calls.every((c) => new URL(c.url).hostname === 'api.github.com')).toBe(true);
  });
});
