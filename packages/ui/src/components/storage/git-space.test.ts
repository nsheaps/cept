import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryBackend } from '@cept/core';
import type { ShallowCloneOptions } from '@cept/core';
import { cloneRemoteRepo, normalizeRepoUrl } from './git-space.js';
import type { GitCloneHost } from './git-space.js';

const CLONE_DIR = '/.cept/git-clones/1';
const cloneCalls: ShallowCloneOptions[] = [];
/** Stands in for the host's raw fs, which only the (faked) clone may use. */
const RAW_FS = Object.freeze({ fake: 'raw fs' });

// The clone itself is core's (tested against a real Git server there); this
// fake lays the "cloned" files out on the host and hands over the directory.
vi.mock('@cept/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@cept/core')>();
  return {
    ...core,
    withShallowClone: async <T>(
      options: ShallowCloneOptions,
      read: (dir: string) => Promise<T>,
    ): Promise<T> => {
      cloneCalls.push(options);
      return read(CLONE_DIR);
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

describe('cloneRemoteRepo', () => {
  beforeEach(() => {
    cloneCalls.length = 0;
  });

  it('clones the normalized url at the branch through core', async () => {
    const backend = await hostWith({ 'a.md': '# A\n' });
    await cloneRemoteRepo(backend, 'github.com/u/r.git', 'dev', undefined, 'https://proxy.test');
    expect(cloneCalls).toHaveLength(1);
    expect(cloneCalls[0]).toMatchObject({
      host: backend,
      fs: RAW_FS,
      url: 'https://github.com/u/r',
      ref: 'dev',
      corsProxy: 'https://proxy.test',
    });
  });

  it('keeps front matter in page content and takes the title from the first H1 after it', async () => {
    const readme = '---\ntitle: Front\n# yaml comment\n---\n\n# Real Title\n\nBody\n';
    const backend = await hostWith({ 'README.md': readme });
    const { pages, pageContents } = await cloneRemoteRepo(backend, 'github.com/u/r');
    expect(pageContents['README.md']).toBe(readme);
    expect(pages).toEqual([{ id: 'README.md', title: 'Real Title', children: [] }]);
  });

  it('skips front matter after a byte order mark when looking for the title', async () => {
    const backend = await hostWith({ 'bom.md': '\uFEFF---\n# comment\n---\n\n# Heading\n' });
    const { pages } = await cloneRemoteRepo(backend, 'github.com/u/r');
    expect(pages[0]?.title).toBe('Heading');
  });

  it('falls back to the filename when only the front matter has a # line', async () => {
    const backend = await hostWith({ 'my-notes.md': '---\n# comment\n---\nno heading\n' });
    const { pages } = await cloneRemoteRepo(backend, 'github.com/u/r');
    expect(pages[0]?.title).toBe('My Notes');
  });

  it('scopes pages to the sub-path and builds folder pages', async () => {
    const backend = await hostWith({
      'outside.md': '# Outside\n',
      'docs/intro.md': '# Intro\n',
      'docs/guides/setup.md': '# Setup\n',
    });
    const { pages, pageContents } = await cloneRemoteRepo(
      backend,
      'github.com/u/r',
      'main',
      '/docs/',
    );
    expect(pages.map((p) => p.id)).toEqual(['intro.md', 'guides']);
    expect(pages[1]?.children.map((p) => p.id)).toEqual(['guides/setup.md']);
    expect(pageContents.guides).toBe('# Guides\n\n- **Setup**');
    expect(pageContents['outside.md']).toBeUndefined();
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
