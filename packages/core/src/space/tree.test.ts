import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { StorageBackend } from '../storage/backend.js';
import { MemoryBackend } from '../storage/memory.js';
import { BrowserFsBackend } from '../storage/browser-fs.js';
import {
  applyMoves,
  createPage,
  findPage,
  isPageFile,
  movePage,
  pickFolderPage,
  readPageText,
  readSpaceTree,
  writePageText,
  type PageNode,
  type SpaceTree,
} from './tree.js';

const enc = new TextEncoder();

/**
 * A hand-written space. Covers folder pages (index wins over README), a folder
 * with no page, CRLF, a byte-order mark, non-ASCII names, non-page files,
 * dotfiles, an ignore list and a nested space.
 */
const FIXTURE: Record<string, Uint8Array> = {
  'space.cept.yaml': enc.encode('version: "1"\nname: Notes\nslug: notes\n'),
  'README.md': enc.encode('# Notes\n'),
  '.cept.yaml': enc.encode('ignore:\n  - drafts/\n  - "*.tmp.md"\n'),
  '.git/HEAD': enc.encode('ref: refs/heads/main\n'),
  'guides/index.md': enc.encode('# Guides\r\n\r\nWindows line endings.\r\n'),
  'guides/README.md': enc.encode('# Readme loses to index\n'),
  'guides/setup.md': new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode('# Setup with a BOM\n')]),
  'guides/10-advanced.md': enc.encode('ten\n'),
  'guides/2-basics.md': enc.encode('two\n'),
  'guides/img/diagram.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 255]),
  'journal/2026/café.md': enc.encode('# Café ☕\n'),
  'journal/2026/notes.tmp.md': enc.encode('scratch\n'),
  'drafts/secret.md': enc.encode('hidden by ignore\n'),
  'assets/logo.svg': enc.encode('<svg/>\n'),
  'team/space.cept.yaml': enc.encode('version: "1"\nname: Team\nslug: team\n'),
  'team/page.md': enc.encode('belongs to another space\n'),
  'Changelog.markdown': enc.encode('## 1.0\n'),
};

async function seed(backend: StorageBackend, files: Record<string, Uint8Array>, root = '') {
  for (const [path, bytes] of Object.entries(files))
    await backend.writeFile(`/${root ? `${root}/` : ''}${path}`, bytes);
}

/** Every file in the backend, path → bytes. */
async function snapshot(backend: StorageBackend, dir = ''): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  for (const entry of await backend.listDirectory(`/${dir}`)) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory) for (const [k, v] of await snapshot(backend, path)) out.set(k, v);
    else out.set(path, [...((await backend.readFile(`/${path}`)) ?? [])]);
  }
  return out;
}

/** The tree as nested `id (file)` lines, for readable assertions. */
function outline(node: PageNode, depth = 0): string[] {
  const label = `${'  '.repeat(depth)}${node.id || '<root>'}${node.file && node.file !== node.id ? ` (${node.file})` : ''}`;
  return [label, ...node.children.flatMap((c) => outline(c, depth + 1))];
}

function pages(tree: SpaceTree): PageNode[] {
  const out: PageNode[] = [];
  const walk = (n: PageNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  walk(tree.root);
  return out;
}

const backends: [string, () => StorageBackend][] = [
  ['MemoryBackend', () => new MemoryBackend()],
  ['BrowserFsBackend', () => new BrowserFsBackend(`tree-${Math.random()}`)],
];

describe.each(backends)('space folder tree on %s', (_name, make) => {
  let backend: StorageBackend;

  beforeEach(async () => {
    backend = make();
    await seed(backend, FIXTURE);
  });

  it('builds the page tree from folders', async () => {
    const tree = await readSpaceTree(backend);
    expect(outline(tree.root)).toEqual([
      '<root> (README.md)',
      '  Changelog.markdown',
      '  guides (guides/index.md)',
      '    guides/2-basics.md',
      '    guides/10-advanced.md',
      '    guides/README.md',
      '    guides/setup.md',
      '  journal',
      '    journal/2026',
      '      journal/2026/café.md',
    ]);
    expect(findPage(tree, 'journal')?.file).toBeNull();
    expect(findPage(tree, 'guides/setup.md')?.name).toBe('setup');
    expect(tree.warnings).toEqual([
      'team: holds space.cept.yaml, so it is a separate space and is left out',
    ]);
  });

  it('round-trips every page byte for byte and touches no other file', async () => {
    const before = await snapshot(backend);
    const tree = await readSpaceTree(backend);
    for (const page of pages(tree)) {
      const text = await readPageText(backend, '', page);
      if (text !== null) await writePageText(backend, '', page, text);
    }
    expect(await snapshot(backend)).toEqual(before);
  });

  it('reads a space in a sub-folder of the backend', async () => {
    const other = make();
    await seed(other, FIXTURE, 'repo/notes');
    const nested = await readSpaceTree(other, 'repo/notes');
    expect(outline(nested.root)).toEqual(outline((await readSpaceTree(backend)).root));
    const setup = findPage(nested, 'guides/setup.md')!;
    expect(await readPageText(other, 'repo/notes', setup)).toBe('﻿# Setup with a BOM\n');
  });

  it('reports an invalid .cept.yaml and ignores it', async () => {
    await backend.writeFile('/journal/.cept.yaml', enc.encode('ignore: [unclosed\n'));
    const tree = await readSpaceTree(backend);
    expect(tree.warnings.some((w) => w.startsWith('journal/.cept.yaml: ignored'))).toBe(true);
    expect(findPage(tree, 'journal/2026/café.md')).not.toBeNull();
  });

  it('lets a deeper .cept.yaml re-include what an ancestor ignored', async () => {
    await backend.writeFile('/journal/.cept.yaml', enc.encode('ignore:\n  - "!*.tmp.md"\n'));
    expect(findPage(await readSpaceTree(backend), 'journal/2026/notes.tmp.md')).not.toBeNull();
  });

  it('writes a folder page with no file to a new index.md', async () => {
    const tree = await readSpaceTree(backend);
    const written = await writePageText(backend, '', findPage(tree, 'journal')!, '# Journal\n');
    expect(written).toBe('journal/index.md');
    expect(findPage(await readSpaceTree(backend), 'journal')?.file).toBe('journal/index.md');
  });

  it('creates a child page inside a folder page', async () => {
    const before = await snapshot(backend);
    const { id, moved } = await createPage(
      backend,
      '',
      { id: 'guides', kind: 'folder' },
      'faq',
      '# FAQ\n',
    );
    expect(id).toBe('guides/faq.md');
    expect(moved).toEqual([]);
    const after = await snapshot(backend);
    expect(after.get('guides/faq.md')).toEqual([...enc.encode('# FAQ\n')]);
    after.delete('guides/faq.md');
    expect(after).toEqual(before);
  });

  it('turns a file page into a folder page when it gets a child', async () => {
    const { id, moved } = await createPage(
      backend,
      '',
      { id: 'guides/setup.md', kind: 'file' },
      'linux',
      '# Linux\n',
    );
    expect(id).toBe('guides/setup/linux.md');
    expect(moved).toEqual([{ from: 'guides/setup.md', to: 'guides/setup' }]);
    const tree = await readSpaceTree(backend);
    expect(findPage(tree, 'guides/setup.md')).toBeNull();
    const setup = findPage(tree, 'guides/setup')!;
    expect(setup.file).toBe('guides/setup/index.md');
    expect(await readPageText(backend, '', setup)).toBe('﻿# Setup with a BOM\n');
    expect(setup.children.map((c) => c.id)).toEqual(['guides/setup/linux.md']);
  });

  it('rejects index and readme as child names before changing anything', async () => {
    for (const parent of [
      { id: 'guides/setup.md', kind: 'file' as const },
      { id: 'journal', kind: 'folder' as const },
    ]) {
      for (const bad of ['index', 'index.md', 'INDEX', 'readme', 'README.md']) {
        await expect(createPage(backend, '', parent, bad, 'x')).rejects.toThrow('reserved');
      }
    }
    await expect(
      movePage(backend, '', { id: 'guides/2-basics.md', kind: 'file' }, 'journal', 'index'),
    ).rejects.toThrow('reserved');
    expect(await snapshot(backend)).toEqual(await snapshotOf(FIXTURE, make));
  });

  it('turns a .markdown file page into a folder page with index.md', async () => {
    const { id, moved } = await createPage(
      backend,
      '',
      { id: 'Changelog.markdown', kind: 'file' },
      '2.0',
      '## 2.0\n',
    );
    expect(id).toBe('Changelog/2.0.md');
    expect(moved).toEqual([{ from: 'Changelog.markdown', to: 'Changelog' }]);
    const page = findPage(await readSpaceTree(backend), 'Changelog')!;
    expect(page.file).toBe('Changelog/index.md');
    expect(await readPageText(backend, '', page)).toBe('## 1.0\n');
  });

  it('keeps the page extension when a new name has another extension', async () => {
    const { id } = await movePage(
      backend,
      '',
      { id: 'guides/setup.md', kind: 'file' },
      'guides',
      'notes.txt',
    );
    expect(id).toBe('guides/notes.txt.md');
  });

  it('lists each folder once', async () => {
    const listed: string[] = [];
    const counting: StorageBackend = Object.assign(Object.create(backend) as StorageBackend, {
      listDirectory: (path: string) => {
        listed.push(path);
        return backend.listDirectory(path);
      },
    });
    await readSpaceTree(counting);
    expect(listed.length).toBe(new Set(listed).size);
  });

  it('refuses to create a page over an existing one', async () => {
    await expect(
      createPage(backend, '', { id: 'guides', kind: 'folder' }, 'setup', 'x'),
    ).rejects.toThrow('already exists');
    expect([...((await backend.readFile('/guides/setup.md')) ?? [])]).toEqual([
      ...FIXTURE['guides/setup.md']!,
    ]);
  });

  it('rejects page names that are not a single visible name', async () => {
    for (const bad of ['', '..', 'a/b', '.hidden']) {
      await expect(
        createPage(backend, '', { id: 'guides', kind: 'folder' }, bad, 'x'),
      ).rejects.toThrow('Invalid page name');
    }
  });

  it('renames a file page and keeps its extension', async () => {
    const { id } = await movePage(
      backend,
      '',
      { id: 'Changelog.markdown', kind: 'file' },
      '',
      'History',
    );
    expect(id).toBe('History.markdown');
    expect([...((await backend.readFile('/History.markdown')) ?? [])]).toEqual([
      ...FIXTURE['Changelog.markdown']!,
    ]);
    expect(await backend.exists('/Changelog.markdown')).toBe(false);
  });

  it('moves a folder page with everything inside it', async () => {
    const before = await snapshot(backend);
    const { id, moved } = await movePage(
      backend,
      '',
      { id: 'guides', kind: 'folder' },
      'journal',
      'manual',
    );
    expect(id).toBe('journal/manual');
    const after = await snapshot(backend);
    for (const [path, bytes] of before) {
      if (path.startsWith('guides/')) {
        expect(after.get(`journal/manual/${path.slice('guides/'.length)}`)).toEqual(bytes);
        expect(after.has(path)).toBe(false);
      } else {
        expect(after.get(path)).toEqual(bytes);
      }
    }
    expect(applyMoves('guides/setup.md', moved)).toBe('journal/manual/setup.md');
    expect(applyMoves('guidesX.md', moved)).toBe('guidesX.md');
  });

  it('refuses to move onto an existing page, into itself, or the root', async () => {
    await expect(
      movePage(backend, '', { id: 'guides/2-basics.md', kind: 'file' }, 'guides', 'setup'),
    ).rejects.toThrow('already exists');
    await expect(
      movePage(backend, '', { id: 'guides', kind: 'folder' }, 'guides', 'inner'),
    ).rejects.toThrow('into itself');
    await expect(movePage(backend, '', { id: '', kind: 'folder' }, '', 'x')).rejects.toThrow(
      'space root',
    );
    expect(await snapshot(backend)).toEqual(await snapshotOf(FIXTURE, make));
  });
});

async function snapshotOf(files: Record<string, Uint8Array>, make: () => StorageBackend) {
  const b = make();
  await seed(b, files);
  return snapshot(b);
}

describe('page file helpers', () => {
  it('recognises Markdown page files', () => {
    expect(isPageFile('a.md')).toBe(true);
    expect(isPageFile('A.MD')).toBe(true);
    expect(isPageFile('b.markdown')).toBe(true);
    expect(isPageFile('.md')).toBe(false);
    expect(isPageFile('c.mdx')).toBe(false);
    expect(isPageFile('d.png')).toBe(false);
  });

  it('prefers index.md over README.md, case-insensitively', () => {
    expect(pickFolderPage(['README.md', 'index.md'])).toBe('index.md');
    expect(pickFolderPage(['readme.md', 'other.md'])).toBe('readme.md');
    expect(pickFolderPage(['Index.MD'])).toBe('Index.MD');
    expect(pickFolderPage(['readme.markdown'])).toBeNull();
    expect(pickFolderPage([])).toBeNull();
  });

  it('applies chained moves in order', () => {
    const moved = [
      { from: 'a.md', to: 'a' },
      { from: 'a', to: 'b/a' },
    ];
    expect(applyMoves('a.md', moved)).toBe('b/a');
    expect(applyMoves('a/x.md', moved)).toBe('b/a/x.md');
  });
});
