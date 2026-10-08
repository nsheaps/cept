import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitAuthRequiredError, MemoryBackend, remoteCloneDir } from '@cept/core';
import type { RemoteCloneOptions } from '@cept/core';
import {
  cloneErrorMessage,
  cloneRemoteRepo,
  cloneSpaceRoot,
  hasCloneMarker,
  isGitHubUrl,
  isWritableClone,
  isWritableRemote,
  normalizeRepoUrl,
  pageHistoryAccess,
  remoteWebUrl,
} from './git-space.js';
import type { GitCloneHost } from './git-space.js';

const SPACE_ID = 'github.com/u/r@main';
const CLONE_DIR = remoteCloneDir(SPACE_ID);
const syncCalls: RemoteCloneOptions[] = [];
/** Stands in for the host's raw fs, which only the (faked) clone may use. */
const RAW_FS = Object.freeze({ fake: 'raw fs' });

// The clone itself is core's (tested against a real Git server there); this
// fake records the call and leaves the "cloned" files the test laid out.
vi.mock('@cept/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@cept/core')>();
  return {
    ...core,
    syncRemoteClone: async (options: RemoteCloneOptions) => {
      syncCalls.push(options);
      return { dir: options.dir, head: 'abc', action: 'cloned' as const };
    },
  };
});

const encode = (text: string) => new TextEncoder().encode(text);

async function hostWith(files: Record<string, string>): Promise<GitCloneHost> {
  const backend = new MemoryBackend();
  for (const [file, text] of Object.entries(files)) {
    await backend.writeFile(`${CLONE_DIR}/${file}`, encode(text));
  }
  return Object.assign(backend, { getRawFs: () => RAW_FS });
}

const clone = (backend: GitCloneHost, extra: Partial<Parameters<typeof cloneRemoteRepo>[1]> = {}) =>
  cloneRemoteRepo(backend, { spaceId: SPACE_ID, url: 'github.com/u/r', ...extra });

describe('cloneRemoteRepo', () => {
  beforeEach(() => {
    syncCalls.length = 0;
  });

  it("syncs the space's kept clone of the normalized url at the branch", async () => {
    const backend = await hostWith({ 'a.md': '# A\n' });
    const result = await clone(backend, {
      url: 'github.com/u/r.git',
      branch: 'dev',
      corsProxy: 'https://proxy.test',
    });
    expect(syncCalls).toHaveLength(1);
    expect(syncCalls[0]).toMatchObject({
      host: backend,
      fs: RAW_FS,
      dir: CLONE_DIR,
      url: 'https://github.com/u/r',
      ref: 'dev',
      corsProxy: 'https://proxy.test',
      resetOnDivergence: true,
    });
    expect(syncCalls[0]?.auth).toBeUndefined();
    expect(result.access).toBe('anonymous');
  });

  it('sends the GitHub sign-in to github.com', async () => {
    const backend = await hostWith({ 'a.md': '# A\n' });
    const auth = { username: 'x-access-token', password: 'ghp_secret' };
    const result = await clone(backend, { auth });
    expect(syncCalls[0]?.auth).toEqual(auth);
    expect(result.access).toBe('token');
  });

  it('never sends the GitHub token to another host', async () => {
    const backend = await hostWith({ 'a.md': '# A\n' });
    const result = await clone(backend, {
      url: 'https://gitlab.com/u/r',
      auth: { username: 'x-access-token', password: 'ghp_secret' },
    });
    expect(syncCalls[0]?.auth).toBeUndefined();
    expect(result.access).toBe('anonymous');
  });

  it('keeps front matter in page content and takes the title from the first H1 after it', async () => {
    const readme = '---\ntitle: Front\n# yaml comment\n---\n\n# Real Title\n\nBody\n';
    const backend = await hostWith({ 'README.md': readme });
    const { pages, pageContents } = await clone(backend);
    expect(pageContents['README.md']).toBe(readme);
    expect(pages).toEqual([{ id: 'README.md', title: 'Real Title', children: [] }]);
  });

  it('skips front matter after a byte order mark when looking for the title', async () => {
    const backend = await hostWith({ 'bom.md': '\uFEFF---\n# comment\n---\n\n# Heading\n' });
    const { pages } = await clone(backend);
    expect(pages[0]?.title).toBe('Heading');
  });

  it('falls back to the filename when only the front matter has a # line', async () => {
    const backend = await hostWith({ 'my-notes.md': '---\n# comment\n---\nno heading\n' });
    const { pages } = await clone(backend);
    expect(pages[0]?.title).toBe('My Notes');
  });

  it('scopes pages to the sub-path and builds folder pages', async () => {
    const backend = await hostWith({
      'outside.md': '# Outside\n',
      'docs/intro.md': '# Intro\n',
      'docs/guides/setup.md': '# Setup\n',
    });
    const { pages, pageContents } = await clone(backend, { subPath: '/docs/' });
    expect(pages.map((p) => p.id)).toEqual(['intro.md', 'guides']);
    expect(pages[1]?.children.map((p) => p.id)).toEqual(['guides/setup.md']);
    expect(pageContents.guides).toBe('# Guides\n\n- **Setup**');
    expect(pageContents['outside.md']).toBeUndefined();
  });
});

describe('isGitHubUrl', () => {
  it('matches github.com only', () => {
    expect(isGitHubUrl('https://github.com/u/r')).toBe(true);
    expect(isGitHubUrl('https://github.com.evil.test/u/r')).toBe(false);
    expect(isGitHubUrl('https://gitlab.com/u/r')).toBe(false);
    expect(isGitHubUrl('not a url')).toBe(false);
  });
});

describe('cloneErrorMessage', () => {
  it('asks for a sign-in on a 401 and for a token with access on a 403', () => {
    expect(
      cloneErrorMessage(new GitAuthRequiredError(401, 'https://github.com/u/r'), 'x'),
    ).toContain('Sign in with a personal access token under Settings → GitHub');
    expect(
      cloneErrorMessage(new GitAuthRequiredError(403, 'https://github.com/u/r'), 'x'),
    ).toContain('cannot read https://github.com/u/r');
  });

  it('passes other errors through', () => {
    expect(cloneErrorMessage(new Error('offline'), 'x')).toBe('offline');
    expect(cloneErrorMessage('?', 'Clone failed')).toBe('Clone failed');
  });
});

describe('normalizeRepoUrl', () => {
  it('should add https:// to bare domain', () => {
    expect(normalizeRepoUrl('github.com/user/repo')).toBe('https://github.com/user/repo');
  });

  it('should leave https:// URLs unchanged', () => {
    expect(normalizeRepoUrl('https://github.com/user/repo')).toBe('https://github.com/user/repo');
  });

  it('should leave http:// URLs unchanged', () => {
    expect(normalizeRepoUrl('http://github.com/user/repo')).toBe('http://github.com/user/repo');
  });

  it('should strip trailing .git', () => {
    expect(normalizeRepoUrl('https://github.com/user/repo.git')).toBe(
      'https://github.com/user/repo',
    );
  });

  it('should trim whitespace', () => {
    expect(normalizeRepoUrl('  github.com/user/repo  ')).toBe('https://github.com/user/repo');
  });
});

describe('remoteWebUrl', () => {
  const space = { remoteUrl: 'https://github.com/o/r', branch: 'main', subPath: 'docs' };

  it('opens a file page as a blob under the space sub-path', () => {
    expect(remoteWebUrl(space, 'guides/intro.md')).toBe(
      'https://github.com/o/r/blob/main/docs/guides/intro.md',
    );
  });

  it('opens a folder page, or the space itself, as a tree', () => {
    expect(remoteWebUrl(space, 'guides')).toBe('https://github.com/o/r/tree/main/docs/guides');
    expect(remoteWebUrl(space)).toBe('https://github.com/o/r/tree/main/docs');
    expect(remoteWebUrl({ remoteUrl: 'github.com/o/r.git', branch: 'dev' })).toBe(
      'https://github.com/o/r/tree/dev',
    );
  });

  it('encodes each path segment', () => {
    expect(remoteWebUrl({ ...space, subPath: undefined }, 'a b/c#d.md')).toBe(
      'https://github.com/o/r/blob/main/a%20b/c%23d.md',
    );
  });

  it('is null for hosts other than github.com', () => {
    expect(remoteWebUrl({ remoteUrl: 'https://gitlab.com/o/r', branch: 'main' })).toBeNull();
    expect(remoteWebUrl({ remoteUrl: 'https://github.com.evil.test/o/r' }, 'a.md')).toBeNull();
  });
});

describe('writable remote spaces (REQ-WS-027)', () => {
  it('finds a space in its folder of the kept clone', () => {
    expect(cloneSpaceRoot(SPACE_ID)).toBe(CLONE_DIR);
    expect(cloneSpaceRoot(SPACE_ID, '/docs/team/')).toBe(`${CLONE_DIR}/docs/team`);
  });

  it('is writable only when marked so: read-only stays the default', () => {
    expect(isWritableRemote({ remoteUrl: 'https://github.com/u/r', readOnly: false })).toBe(true);
    expect(isWritableRemote({ remoteUrl: 'https://github.com/u/r', readOnly: true })).toBe(false);
    expect(isWritableRemote({ remoteUrl: 'https://github.com/u/r' })).toBe(false);
    expect(isWritableRemote({ readOnly: false })).toBe(false);
  });

  it('needs the sign-in and a space marker in the clone', async () => {
    const host = new MemoryBackend();
    const marker = new TextEncoder().encode('name: R\n');
    await host.writeFile(`${cloneSpaceRoot(SPACE_ID, 'docs')}/space.cept.yaml`, marker);
    expect(await hasCloneMarker(host, SPACE_ID, 'docs')).toBe(true);
    expect(await hasCloneMarker(host, SPACE_ID)).toBe(false);
    expect(await isWritableClone(host, { id: SPACE_ID, subPath: 'docs', access: 'token' })).toBe(
      true,
    );
    expect(
      await isWritableClone(host, { id: SPACE_ID, subPath: 'docs', access: 'anonymous' }),
    ).toBe(false);
    expect(await isWritableClone(host, { id: SPACE_ID, subPath: 'docs' })).toBe(false);
  });
});

describe('pageHistoryAccess (REQ-NTN-016)', () => {
  const remote = { remoteUrl: 'https://github.com/u/r' };

  it('hides history outside remote spaces and on hosts that cannot keep a clone', () => {
    expect(pageHistoryAccess({ space: undefined, hostCanClone: true, editable: true })).toBe(
      'none',
    );
    expect(pageHistoryAccess({ space: {}, hostCanClone: true, editable: true })).toBe('none');
    expect(pageHistoryAccess({ space: remote, hostCanClone: false, editable: true })).toBe('none');
  });

  it('offers restore only when the space is open for editing', () => {
    expect(pageHistoryAccess({ space: remote, hostCanClone: true, editable: false })).toBe('view');
    expect(pageHistoryAccess({ space: remote, hostCanClone: true, editable: true })).toBe(
      'restore',
    );
  });

  it('offers history in a folder space inside a Git repository, on any host (REQ-WS-021)', () => {
    expect(
      pageHistoryAccess({ space: {}, hostCanClone: false, localRepo: true, editable: true }),
    ).toBe('restore');
    expect(
      pageHistoryAccess({ space: {}, hostCanClone: false, localRepo: true, editable: false }),
    ).toBe('view');
    expect(
      pageHistoryAccess({ space: {}, hostCanClone: true, localRepo: false, editable: true }),
    ).toBe('none');
    expect(
      pageHistoryAccess({ space: undefined, hostCanClone: true, localRepo: true, editable: true }),
    ).toBe('none');
  });
});
