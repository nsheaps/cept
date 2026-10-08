import { describe, it, expect } from 'vitest';
import { MemoryBackend } from '../storage/memory.js';
import {
  SPACE_MARKER_YAML,
  SPACE_MARKER_YML,
  CEPT_CONFIG_YAML,
  CEPT_CONFIG_YML,
  pickSpaceMarker,
  pickCeptConfigFile,
  findSpaceMarker,
  parseSpaceConfig,
  serializeSpaceConfig,
  parseCeptConfig,
  serializeCeptConfig,
  mergeFolderConfigs,
  createIgnoreMatcher,
  isDefaultHidden,
} from './config.js';

function okSpace(text: string) {
  const r = parseSpaceConfig(text);
  if (!r.ok) throw new Error(`expected ok, got ${r.errors.join('; ')}`);
  return r.config;
}

function okCept(text: string) {
  const r = parseCeptConfig(text);
  if (!r.ok) throw new Error(`expected ok, got ${r.errors.join('; ')}`);
  return r.config;
}

describe('marker precedence (REQ-WS-003)', () => {
  it('picks space.cept.yaml when only .yaml exists', () => {
    const r = pickSpaceMarker(['a.md', SPACE_MARKER_YAML]);
    expect(r).toEqual({ name: SPACE_MARKER_YAML, warnings: [] });
  });

  it('picks space.cept.yml when only .yml exists', () => {
    const r = pickSpaceMarker([SPACE_MARKER_YML]);
    expect(r).toEqual({ name: SPACE_MARKER_YML, warnings: [] });
  });

  it('prefers .yaml over .yml and warns when both exist', () => {
    const r = pickSpaceMarker([SPACE_MARKER_YML, SPACE_MARKER_YAML]);
    expect(r?.name).toBe(SPACE_MARKER_YAML);
    expect(r?.warnings).toHaveLength(1);
    expect(r?.warnings[0]).toContain(SPACE_MARKER_YML);
  });

  it('returns null when there is no marker, and ignores .cept.yaml', () => {
    expect(pickSpaceMarker(['README.md', CEPT_CONFIG_YAML])).toBeNull();
  });

  it('applies the same rule to .cept.yaml / .cept.yml', () => {
    expect(pickCeptConfigFile([CEPT_CONFIG_YML])?.name).toBe(CEPT_CONFIG_YML);
    const both = pickCeptConfigFile([CEPT_CONFIG_YML, CEPT_CONFIG_YAML]);
    expect(both?.name).toBe(CEPT_CONFIG_YAML);
    expect(both?.warnings).toHaveLength(1);
    expect(pickCeptConfigFile([SPACE_MARKER_YAML])).toBeNull();
  });

  it('finds the marker in a directory of a StorageBackend', async () => {
    const backend = new MemoryBackend();
    await backend.writeFile('notes/space.cept.yml', new TextEncoder().encode('x'));
    await backend.writeFile('notes/space.cept.yaml', new TextEncoder().encode('x'));
    const found = await findSpaceMarker(backend, 'notes');
    expect(found?.name).toBe(SPACE_MARKER_YAML);
    expect(found?.warnings).toHaveLength(1);
    expect(await findSpaceMarker(backend, 'other')).toBeNull();
  });

  it('accepts every spelling of the root and of a folder', async () => {
    const backend = new MemoryBackend();
    await backend.writeFile('space.cept.yaml', new TextEncoder().encode('x'));
    await backend.writeFile('notes/space.cept.yml', new TextEncoder().encode('x'));
    for (const root of ['', '/', '.', './']) {
      expect((await findSpaceMarker(backend, root))?.name).toBe(SPACE_MARKER_YAML);
    }
    for (const notes of ['notes', '/notes', 'notes/', './notes', 'notes//']) {
      expect((await findSpaceMarker(backend, notes))?.name).toBe(SPACE_MARKER_YML);
    }
  });
});

describe('parseSpaceConfig (REQ-WS-004)', () => {
  const base = "version: '1'\nname: My Notes\nslug: my-notes\n";

  it('parses the canonical example', () => {
    const c = okSpace(`${base}branch: docs\n`);
    expect(c).toMatchObject({ version: '1', name: 'My Notes', slug: 'my-notes', branch: 'docs' });
  });

  it('branch is optional', () => {
    expect(okSpace(base).branch).toBeUndefined();
  });

  it('rejects an empty branch', () => {
    const r = parseSpaceConfig(`${base}branch: ''\n`);
    expect(r.ok).toBe(false);
  });

  it('normalizes the number 1 to the string "1"', () => {
    expect(okSpace('version: 1\nname: A\nslug: a\n').version).toBe('1');
  });

  it('gives a clear error for an unsupported future version', () => {
    const r = parseSpaceConfig('version: 2\nname: A\nslug: a\n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/unsupported.*version.*2/i);
    const s = parseSpaceConfig("version: '99'\nname: A\nslug: a\n");
    expect(s.ok).toBe(false);
  });

  it('requires version, name and slug', () => {
    for (const text of [
      'name: A\nslug: a\n',
      "version: '1'\nslug: a\n",
      "version: '1'\nname: A\n",
    ]) {
      expect(parseSpaceConfig(text).ok).toBe(false);
    }
    expect(parseSpaceConfig("version: '1'\nname: ''\nslug: a\n").ok).toBe(false);
  });

  it('validates slugs', () => {
    const slugOk = ['a', '1', 'ab', 'a-b', 'a--b', 'engineering-notes', 'a'.repeat(63)];
    const slugBad = ['', '-a', 'a-', 'A', 'a_b', 'a b', 'a.b', 'a'.repeat(64), 'é'];
    for (const slug of slugOk) {
      expect(parseSpaceConfig(`version: '1'\nname: A\nslug: '${slug}'\n`).ok, slug).toBe(true);
    }
    for (const slug of slugBad) {
      expect(parseSpaceConfig(`version: '1'\nname: A\nslug: '${slug}'\n`).ok, slug).toBe(false);
    }
  });

  it('reports invalid YAML, empty documents and non-mappings without throwing', () => {
    expect(parseSpaceConfig('name: [unclosed').ok).toBe(false);
    expect(parseSpaceConfig('').ok).toBe(false);
    expect(parseSpaceConfig('- a\n- b\n').ok).toBe(false);
    expect(parseSpaceConfig('just text').ok).toBe(false);
  });

  it('preserves unknown keys through parse and serialize', () => {
    const c = okSpace(`${base}icon: "🏠"\nextra:\n  nested: [1, 2]\n`);
    expect(c).toMatchObject({ icon: '🏠', extra: { nested: [1, 2] } });
    const again = okSpace(serializeSpaceConfig(c));
    expect(again).toEqual(c);
  });

  it('round-trips names containing :, # and quotes', () => {
    const names = [
      'Plans: 2026 # roadmap',
      `He said "hi" and it's fine`,
      "it's: a 'test' #1",
      '# leading hash',
      'trailing colon:',
      '- dash',
      'yes',
      '123',
    ];
    for (const name of names) {
      const text = serializeSpaceConfig({ version: '1', name, slug: 'x', branch: 'a: b #c' });
      const c = okSpace(text);
      expect(c.name).toBe(name);
      expect(c.branch).toBe('a: b #c');
    }
  });

  it('serializes known keys first, in a stable order', () => {
    const text = serializeSpaceConfig({ zeta: 1, slug: 's', name: 'n', version: '1', branch: 'b' });
    expect(text.split('\n').map((l) => l.split(':')[0])).toEqual([
      'version',
      'name',
      'slug',
      'branch',
      'zeta',
      '',
    ]);
  });
});

describe('parseCeptConfig (.cept.yaml, D-41)', () => {
  it('reads ignore', () => {
    expect(okCept('ignore:\n  - drafts/\n  - "*.tmp"\n').ignore).toEqual(['drafts/', '*.tmp']);
  });

  it('reads hide as an alias of ignore and normalizes to ignore', () => {
    const c = okCept('hide:\n  - private/\n');
    expect(c.ignore).toEqual(['private/']);
    expect('hide' in c).toBe(false);
  });

  it('merges ignore then hide (union, de-duplicated) when both are present', () => {
    const c = okCept('ignore: [a, b]\nhide: [b, c]\n');
    expect(c.ignore).toEqual(['a', 'b', 'c']);
  });

  it('treats an empty file and a null ignore as an empty config', () => {
    expect(okCept('').ignore).toEqual([]);
    expect(okCept('ignore:\n').ignore).toEqual([]);
    expect(okCept('# only a comment\n').ignore).toEqual([]);
  });

  it('rejects wrong types and invalid YAML', () => {
    expect(parseCeptConfig('ignore: 3').ok).toBe(false);
    expect(parseCeptConfig('ignore: [1, 2]').ok).toBe(false);
    expect(parseCeptConfig('hide: nope').ok).toBe(false);
    expect(parseCeptConfig('ignore: [unclosed').ok).toBe(false);
    expect(parseCeptConfig('- a').ok).toBe(false);
  });

  it('preserves unknown keys and round-trips', () => {
    const c = okCept('ignore: ["a: b", "#c"]\ntheme: dark\nnested: {x: 1}\n');
    expect(c).toMatchObject({ theme: 'dark', nested: { x: 1 } });
    expect(okCept(serializeCeptConfig(c))).toEqual(c);
    expect(okCept(serializeCeptConfig(c)).ignore).toEqual(['a: b', '#c']);
  });

  it('omits an empty ignore list when serializing', () => {
    expect(serializeCeptConfig({ ignore: [] })).not.toContain('ignore');
  });
});

describe('mergeFolderConfigs (nearest wins per key)', () => {
  it('lets the nearest folder win for scalar keys, keeping other keys from ancestors', () => {
    const layers = [
      { folder: '', config: okCept('theme: dark\nsort: title\n') },
      { folder: 'team', config: okCept('theme: light\n') },
      { folder: 'team/docs', config: okCept('extra: 1\n') },
    ];
    expect(mergeFolderConfigs(layers).settings).toEqual({
      theme: 'light',
      sort: 'title',
      extra: 1,
    });
  });

  it('accumulates ignore patterns per layer, root to leaf', () => {
    const layers = [
      { folder: '', config: okCept('ignore: [a]\n') },
      { folder: 'team', config: okCept('ignore: [b]\n') },
    ];
    expect(mergeFolderConfigs(layers).ignore).toEqual([
      { folder: '', patterns: ['a'] },
      { folder: 'team', patterns: ['b'] },
    ]);
  });

  it('returns empty results for no layers', () => {
    expect(mergeFolderConfigs([])).toEqual({ settings: {}, ignore: [] });
  });
});

describe('default hidden paths', () => {
  it('hides dotfiles, dotfolders, .git and .cept at any depth', () => {
    for (const p of [
      '.env',
      '.git',
      '.git/config',
      '.cept/config.yaml',
      'a/.hidden/b.md',
      'a/.DS_Store',
      '.cept.yaml',
    ]) {
      expect(isDefaultHidden(p), p).toBe(true);
    }
  });

  it('does not hide ordinary paths', () => {
    for (const p of ['a.md', 'a/b.md', 'space.cept.yaml', 'dir.with.dots/x.md', 'git/x']) {
      expect(isDefaultHidden(p), p).toBe(false);
    }
  });

  it('applies with no config layers', () => {
    const m = createIgnoreMatcher([]);
    expect(m.isHidden('.git/HEAD')).toBe(true);
    expect(m.isHidden('notes/a.md')).toBe(false);
  });

  it('cannot be re-included by a negation pattern', () => {
    const m = createIgnoreMatcher([
      { folder: '', config: okCept('ignore: ["!.git", "!.github"]\n') },
    ]);
    expect(m.isHidden('.git/HEAD')).toBe(true);
    expect(m.isHidden('.github/x.md')).toBe(true);
  });
});

describe('gitignore-style matching', () => {
  const matcher = (yaml: string, folder = '') =>
    createIgnoreMatcher([{ folder, config: okCept(yaml) }]);

  it('matches simple names at any depth', () => {
    const m = matcher('ignore: [drafts]\n');
    expect(m.isHidden('drafts')).toBe(true);
    expect(m.isHidden('a/drafts/x.md')).toBe(true);
    expect(m.isHidden('a/other.md')).toBe(false);
  });

  it('supports globs and **', () => {
    const m = matcher('ignore: ["*.tmp", "a/**/secret.md", "**/build"]\n');
    expect(m.isHidden('x.tmp')).toBe(true);
    expect(m.isHidden('d/x.tmp')).toBe(true);
    expect(m.isHidden('a/b/c/secret.md')).toBe(true);
    expect(m.isHidden('b/a/secret.md')).toBe(false);
    expect(m.isHidden('p/q/build/out.md')).toBe(true);
    expect(m.isHidden('x.md')).toBe(false);
  });

  it('directory-only patterns (foo/) match directories, not files', () => {
    const m = matcher('ignore: ["foo/"]\n');
    expect(m.isHidden('foo', { isDirectory: true })).toBe(true);
    expect(m.isHidden('foo', { isDirectory: false })).toBe(false);
    expect(m.isHidden('foo/page.md')).toBe(true);
    expect(m.isHidden('a/foo/page.md')).toBe(true);
  });

  it('anchored patterns (/foo) only match at the folder holding the config', () => {
    const m = matcher('ignore: ["/foo"]\n');
    expect(m.isHidden('foo/x.md')).toBe(true);
    expect(m.isHidden('a/foo/x.md')).toBe(false);
  });

  it('negation (!) re-includes within the same file, last match wins', () => {
    const m = matcher('ignore: ["*.md", "!keep.md"]\n');
    expect(m.isHidden('a.md')).toBe(true);
    expect(m.isHidden('keep.md')).toBe(false);
    expect(m.isHidden('d/keep.md')).toBe(false);
  });

  it('cannot re-include a file inside an ignored directory', () => {
    const m = matcher('ignore: ["private/", "!private/ok.md"]\n');
    expect(m.isHidden('private/ok.md')).toBe(true);
  });

  it('evaluates patterns relative to the folder holding the config', () => {
    const m = matcher('ignore: ["/drafts", "*.tmp"]\n', 'team');
    expect(m.isHidden('team/drafts/a.md')).toBe(true);
    expect(m.isHidden('drafts/a.md')).toBe(false);
    expect(m.isHidden('team/x/a.tmp')).toBe(true);
    expect(m.isHidden('other/a.tmp')).toBe(false);
    expect(m.isHidden('team2/drafts/a.md')).toBe(false);
  });

  it('applies every ancestor layer to its own subtree', () => {
    const m = createIgnoreMatcher([
      { folder: '', config: okCept('ignore: ["*.tmp"]\n') },
      { folder: 'team', config: okCept('ignore: ["/drafts"]\n') },
      { folder: 'team/docs', config: okCept('ignore: ["!keep.tmp", "old/"]\n') },
    ]);
    expect(m.isHidden('a.tmp')).toBe(true);
    expect(m.isHidden('team/docs/x.tmp')).toBe(true);
    expect(m.isHidden('team/docs/keep.tmp')).toBe(false); // nearer layer re-includes
    expect(m.isHidden('team/keep.tmp')).toBe(true); // docs layer does not apply here
    expect(m.isHidden('team/drafts/x.md')).toBe(true);
    expect(m.isHidden('team/docs/drafts/x.md')).toBe(false);
    expect(m.isHidden('team/docs/old/x.md')).toBe(true);
  });

  it('accepts hide: patterns through the alias', () => {
    const m = matcher('hide: [private/]\n');
    expect(m.isHidden('private/x.md')).toBe(true);
  });

  it('treats paths outside the space as hidden and the root as visible', () => {
    const m = createIgnoreMatcher([]);
    expect(m.isHidden('../x.md')).toBe(true);
    expect(m.isHidden('')).toBe(false);
    expect(m.isHidden('/a/b.md')).toBe(false);
    expect(m.isHidden('a\\b.md')).toBe(false);
  });

  it('treats a backslash as a filename character, not a separator', () => {
    const m = createIgnoreMatcher([{ folder: '', config: okCept('ignore: [a/]') }]);
    expect(m.isHidden('a/b.md')).toBe(true);
    expect(m.isHidden('a\\b.md')).toBe(false);
    expect(isDefaultHidden('x\\.git')).toBe(false);
  });
});
