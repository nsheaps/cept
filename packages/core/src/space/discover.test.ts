import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { StorageBackend } from '../storage/backend.js';
import { MemoryBackend } from '../storage/memory.js';
import { BrowserFsBackend } from '../storage/browser-fs.js';
import { discoverSpaces, walkSpaces, findGitRoot } from './discover.js';

const enc = (s: string) => new TextEncoder().encode(s);

function marker(name: string, slug: string, extra = ''): Uint8Array {
  return enc(`version: '1'\nname: ${name}\nslug: ${slug}\n${extra}`);
}

/**
 * Fixture tree (paths relative to the backend root):
 *
 *   .git/HEAD                      repo root is the backend root
 *   README.md                      not a space
 *   docs/space.cept.yaml           space "docs"
 *   docs/guide/intro.md
 *   docs/team/space.cept.yml       nested marker inside "docs": reported, not a space
 *   projects/alpha/space.cept.yml  space "alpha"
 *   projects/alpha/notes.md
 *   projects/beta/readme.md        plain folder, no marker
 *   .hidden/space.cept.yaml        inside a dot folder: never walked
 */
async function writeFixture(backend: StorageBackend): Promise<void> {
  await backend.writeFile('.git/HEAD', enc('ref: refs/heads/main\n'));
  await backend.writeFile('README.md', enc('# repo'));
  await backend.writeFile('docs/space.cept.yaml', marker('Docs', 'docs'));
  await backend.writeFile('docs/guide/intro.md', enc('# intro'));
  await backend.writeFile('docs/team/space.cept.yml', marker('Team', 'team'));
  await backend.writeFile(
    'projects/alpha/space.cept.yml',
    marker('Alpha', 'alpha', 'branch: pages\n'),
  );
  await backend.writeFile('projects/alpha/notes.md', enc('# notes'));
  await backend.writeFile('projects/beta/readme.md', enc('# beta'));
  await backend.writeFile('.hidden/space.cept.yaml', marker('Hidden', 'hidden'));
}

/** Wraps a backend and records every call that would change it. */
function writeSpy(inner: StorageBackend): { backend: StorageBackend; writes: string[] } {
  const writes: string[] = [];
  const backend: StorageBackend = {
    type: inner.type,
    capabilities: inner.capabilities,
    readFile: (p) => inner.readFile(p),
    listDirectory: (p) => inner.listDirectory(p),
    exists: (p) => inner.exists(p),
    stat: (p) => inner.stat(p),
    watch: (p, cb) => inner.watch(p, cb),
    writeFile: async (p) => {
      writes.push(`writeFile ${p}`);
    },
    deleteFile: async (p) => {
      writes.push(`deleteFile ${p}`);
    },
    initialize: async () => {
      writes.push('initialize');
    },
    close: () => inner.close(),
  };
  return { backend, writes };
}

const factories: [string, () => StorageBackend][] = [
  ['MemoryBackend', () => new MemoryBackend()],
  ['BrowserFsBackend', () => new BrowserFsBackend(`discover-${Date.now()}-${Math.random()}`)],
];

describe.each(factories)('discoverSpaces on %s', (_name, make) => {
  let inner: StorageBackend;

  beforeEach(async () => {
    inner = make();
    await writeFixture(inner);
  });

  afterEach(async () => {
    await inner.close();
  });

  it('finds every space, stops at space roots and skips dot folders', async () => {
    const result = await discoverSpaces(inner);
    expect(result.spaces.map((s) => s.path)).toEqual(['docs', 'projects/alpha']);
    expect(result.nested).toEqual([]);

    const [docs, alpha] = result.spaces;
    expect(docs?.marker).toBe('space.cept.yaml');
    expect(docs?.config).toMatchObject({ name: 'Docs', slug: 'docs', version: '1' });
    expect(docs?.errors).toEqual([]);
    expect(alpha?.marker).toBe('space.cept.yml');
    expect(alpha?.config).toMatchObject({ name: 'Alpha', slug: 'alpha', branch: 'pages' });
  });

  it('reports a marker inside a space as nested, not as a space, when asked', async () => {
    const result = await discoverSpaces(inner, { reportNested: true });
    expect(result.spaces.map((s) => s.path)).toEqual(['docs', 'projects/alpha']);
    expect(result.nested).toEqual([{ path: 'docs/team', marker: 'space.cept.yml', space: 'docs' }]);
    expect(result.warnings.some((w) => w.includes('docs/team'))).toBe(true);
  });

  it('detects .git by walking up from each space to the repo root', async () => {
    const result = await discoverSpaces(inner);
    expect(result.spaces.map((s) => s.gitRoot)).toEqual(['', '']);
    expect(await findGitRoot(inner, 'projects/alpha')).toBe('');
    expect(await findGitRoot(inner, '')).toBe('');
  });

  it('starts below the backend root and still finds a .git above it', async () => {
    const result = await discoverSpaces(inner, { root: 'projects' });
    expect(result.spaces.map((s) => s.path)).toEqual(['projects/alpha']);
    expect(result.spaces[0]?.gitRoot).toBe('');
  });

  it('never writes to the backend', async () => {
    const { backend, writes } = writeSpy(inner);
    await discoverSpaces(backend, { reportNested: true });
    await findGitRoot(backend, 'projects/alpha');
    expect(writes).toEqual([]);
  });
});

describe('discoverSpaces edge cases', () => {
  it('returns the root itself when it is a space, without descending', async () => {
    const backend = new MemoryBackend();
    await backend.writeFile('space.cept.yaml', marker('Root', 'root'));
    await backend.writeFile('sub/space.cept.yaml', marker('Sub', 'sub'));
    const result = await discoverSpaces(backend);
    expect(result.spaces.map((s) => s.path)).toEqual(['']);
    expect(result.spaces[0]?.gitRoot).toBeNull();
    const nested = await discoverSpaces(backend, { reportNested: true });
    expect(nested.nested).toEqual([{ path: 'sub', marker: 'space.cept.yaml', space: '' }]);
  });

  it('finds the nearest .git when repos are nested, and a .git file counts', async () => {
    const backend = new MemoryBackend();
    await backend.writeFile('.git/HEAD', enc('x'));
    await backend.writeFile('vendor/lib/.git', enc('gitdir: ../../.git/modules/lib\n'));
    await backend.writeFile('vendor/lib/docs/space.cept.yaml', marker('Lib', 'lib'));
    const result = await discoverSpaces(backend);
    expect(result.spaces.map((s) => [s.path, s.gitRoot])).toEqual([
      ['vendor/lib/docs', 'vendor/lib'],
    ]);
  });

  it('keeps a space with an invalid marker and reports its errors', async () => {
    const backend = new MemoryBackend();
    await backend.writeFile('bad/space.cept.yaml', enc("version: '2'\nname: Bad\nslug: bad\n"));
    const result = await discoverSpaces(backend);
    expect(result.spaces).toHaveLength(1);
    expect(result.spaces[0]?.config).toBeNull();
    expect(result.spaces[0]?.errors.join(' ')).toMatch(/version/i);
  });

  it('carries the .yaml-over-.yml warning onto the space', async () => {
    const backend = new MemoryBackend();
    await backend.writeFile('a/space.cept.yaml', marker('A', 'a'));
    await backend.writeFile('a/space.cept.yml', marker('A old', 'a-old'));
    const result = await discoverSpaces(backend);
    expect(result.spaces[0]?.marker).toBe('space.cept.yaml');
    expect(result.spaces[0]?.config?.slug).toBe('a');
    expect(result.spaces[0]?.warnings).toHaveLength(1);
  });

  it('marks every space that shares a slug within one discovery as an error', async () => {
    const backend = new MemoryBackend();
    await backend.writeFile('one/space.cept.yaml', marker('One', 'notes'));
    await backend.writeFile('two/space.cept.yaml', marker('Two', 'notes'));
    await backend.writeFile('three/space.cept.yaml', marker('Three', 'three'));
    const result = await discoverSpaces(backend);
    const errors = Object.fromEntries(result.spaces.map((s) => [s.path, s.errors]));
    expect(errors['one']?.join(' ')).toMatch(/duplicate slug "notes".*two/);
    expect(errors['two']?.join(' ')).toMatch(/duplicate slug "notes".*one/);
    expect(errors['three']).toEqual([]);
  });

  it('honours maxDepth', async () => {
    const backend = new MemoryBackend();
    await backend.writeFile('a/b/c/space.cept.yaml', marker('Deep', 'deep'));
    const shallow = await discoverSpaces(backend, { maxDepth: 2 });
    expect(shallow.spaces).toEqual([]);
    expect(shallow.warnings).toEqual([expect.stringContaining('"a/b"')]);
    expect((await discoverSpaces(backend, { maxDepth: 3 })).spaces).toHaveLength(1);
  });

  it('returns nothing for an empty or missing root', async () => {
    const backend = new MemoryBackend();
    expect((await discoverSpaces(backend)).spaces).toEqual([]);
    expect((await discoverSpaces(backend, { root: 'missing' })).spaces).toEqual([]);
    expect(await findGitRoot(backend, 'missing')).toBeNull();
  });

  it('walks lazily: stopping after the first space lists no further folders', async () => {
    const backend = new MemoryBackend();
    await backend.writeFile('a/space.cept.yaml', marker('A', 'a'));
    await backend.writeFile('b/c/d/e.md', enc('x'));
    const listed: string[] = [];
    const spy: StorageBackend = Object.create(backend) as StorageBackend;
    spy.listDirectory = (p: string) => {
      listed.push(p);
      return backend.listDirectory(p);
    };
    for await (const event of walkSpaces(spy)) {
      expect(event).toMatchObject({ kind: 'space', space: { path: 'a' } });
      break;
    }
    expect(listed).not.toContain('/b/c');
  });
});
