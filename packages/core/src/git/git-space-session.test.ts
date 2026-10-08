import { describe, expect, it } from 'vitest';
import { MemoryBackend } from '../storage/memory.js';
import { ScopedBackend } from '../storage/scoped.js';
import type { FileChange } from './auto-commit.js';
import { RecordingBackend } from './git-space-session.js';

const encode = (text: string) => new TextEncoder().encode(text);

function setup(subPath: string) {
  const host = new MemoryBackend();
  const changes: [string, FileChange['type']][] = [];
  const root = ['repo', subPath].filter(Boolean).join('/');
  const backend = new RecordingBackend(new ScopedBackend(host, root), subPath, (path, type) =>
    changes.push([path, type]),
  );
  return { host, backend, changes };
}

describe('RecordingBackend', () => {
  it('reports new, changed and deleted files relative to the repository root', async () => {
    const { host, backend, changes } = setup('docs');

    await backend.writeFile('guide.md', encode('# Guide\n'));
    await backend.writeFile('guide.md', encode('# Guide\n\nMore.\n'));
    await backend.deleteFile('guide.md');

    expect(changes).toEqual([
      ['docs/guide.md', 'add'],
      ['docs/guide.md', 'modify'],
      ['docs/guide.md', 'delete'],
    ]);
    expect(await host.exists('repo/docs/guide.md')).toBe(false);
  });

  it('uses space paths as repository paths for a space at the root', async () => {
    const { host, backend, changes } = setup('');

    await backend.writeFile('/notes/a.md', encode('a'));

    expect(changes).toEqual([['notes/a.md', 'add']]);
    expect(await host.exists('repo/notes/a.md')).toBe(true);
  });

  it('does not report deleting a file that is not there', async () => {
    const { backend, changes } = setup('');

    await backend.deleteFile('missing.md').catch(() => undefined);

    expect(changes).toEqual([]);
  });

  it('reads through without reporting', async () => {
    const { backend, changes } = setup('');
    await backend.writeFile('a.md', encode('a'));
    changes.length = 0;

    expect(new TextDecoder().decode((await backend.readFile('a.md')) ?? undefined)).toBe('a');
    expect(await backend.exists('a.md')).toBe(true);
    expect((await backend.listDirectory('')).map((e) => e.name)).toEqual(['a.md']);
    expect(changes).toEqual([]);
  });
});
