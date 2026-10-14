import { describe, it, expect, beforeEach } from 'vitest';
import { formatCommentMarker } from '@cept/core';
import type { PageComment } from '@cept/core';
import { MemoryBackend } from './test-helpers.js';
import {
  addFolderPage,
  deleteFolderPage,
  deleteForeignFile,
  duplicateFolderPage,
  initFolderSpace,
  isFolderSpace,
  moveFolderPageInto,
  moveFolderPageToRoot,
  moveForeignFileInto,
  moveForeignFileToRoot,
  previewMoveForeignInto,
  previewMoveInto,
  previewMoveForeignToRootLinks,
  previewMoveToRootLinks,
  previewRenameForeignLinks,
  previewRenameLinks,
  renameForeignFile,
  pageNameFromTitle,
  readFolderBacklinks,
  readFolderCommentCounts,
  readFolderPage,
  readFolderTree,
  renameFolderPage,
  slugFor,
  toPageTree,
  writeFolderPage,
} from './folder-space.js';

function fixture(): MemoryBackend {
  const backend = new MemoryBackend();
  backend.seedText('space.cept.yaml', 'version: "1"\nname: Notes\nslug: notes\n');
  backend.seedText('README.md', '# Notes');
  backend.seedText('todo.md', '# Todo');
  backend.seedText('guides/index.md', '# Guides');
  backend.seedText('guides/setup.md', '# Setup');
  backend.seedText('guides/logo.png', 'png');
  backend.seedText('empty/notes.txt', 'not a page');
  return backend;
}

describe('folder spaces', () => {
  let backend: MemoryBackend;

  beforeEach(() => {
    backend = fixture();
  });

  it('detects the space marker and writes one for a new space', async () => {
    expect(await isFolderSpace(backend)).toBe(true);
    const fresh = new MemoryBackend();
    expect(await isFolderSpace(fresh)).toBe(false);
    await initFolderSpace(fresh, 'Café Notes!');
    expect(fresh.readText('space.cept.yaml')).toContain('slug: cafe-notes');
    expect(await isFolderSpace(fresh)).toBe(true);
  });

  it('makes slugs from names', () => {
    expect(slugFor('My Space')).toBe('my-space');
    expect(slugFor('***')).toBe('space');
    expect(slugFor('x'.repeat(80))).toHaveLength(63);
  });

  it('turns the folder tree into the sidebar tree, root page first', async () => {
    const pages = toPageTree(await readFolderTree(backend));
    expect(pages).toEqual([
      { id: 'README.md', title: 'README', children: [] },
      {
        id: 'guides',
        title: 'guides',
        children: [
          { id: 'guides/setup.md', title: 'setup', children: [] },
          { id: 'guides/logo.png', title: 'logo.png', foreign: true, children: [] },
        ],
      },
      { id: 'todo.md', title: 'todo', children: [] },
    ]);
  });

  it('sorts the sidebar tree by the order front matter, pages without one after', async () => {
    backend.seedText('todo.md', '---\norder: 1\n---\n# Todo');
    backend.seedText('guides/setup.md', '---\norder: 5\n---\n# Setup');
    backend.seedText('guides/index.md', '---\norder: 0\n---\n# Guides');
    const pages = toPageTree(await readFolderTree(backend));
    // README.md is the root page and stays first; the rest follow their order.
    expect(pages.map((p) => [p.id, p.order])).toEqual([
      ['README.md', undefined],
      ['guides', 0],
      ['todo.md', 1],
    ]);
    expect(pages[1]?.children[0]).toMatchObject({ id: 'guides/setup.md', order: 5 });
  });

  it('lists files that are not pages after the pages of their folder, and not in hidden folders', async () => {
    backend.seedText('chart.png', 'png');
    const pages = toPageTree(await readFolderTree(backend), [], new Set(['guides/logo.png']));
    expect(pages.map((p) => p.id)).toEqual(['README.md', 'guides', 'todo.md', 'chart.png']);
    expect(pages.at(-1)).toEqual({
      id: 'chart.png',
      title: 'chart.png',
      foreign: true,
      children: [],
    });
    expect(pages[1]?.children.map((c) => c.id)).toEqual(['guides/setup.md']);
  });

  it('keeps icons, covers and expanded state by id and leaves hidden pages out', async () => {
    const previous = [
      { id: 'guides', title: 'old', icon: '📘', isExpanded: true, children: [] },
      { id: 'todo.md', title: 'old', cover: 'c.png', children: [] },
    ];
    const pages = toPageTree(await readFolderTree(backend), previous, new Set(['guides/setup.md']));
    expect(pages[1]).toEqual({
      id: 'guides',
      title: 'guides',
      icon: '📘',
      isExpanded: true,
      children: [{ id: 'guides/logo.png', title: 'logo.png', foreign: true, children: [] }],
    });
    expect(pages[2]).toMatchObject({ id: 'todo.md', cover: 'c.png' });
  });

  it('reads and writes file pages and folder pages', async () => {
    expect(await readFolderPage(backend, 'guides')).toBe('# Guides');
    expect(await readFolderPage(backend, 'README.md')).toBe('# Notes');
    await writeFolderPage(backend, 'guides/setup.md', '# Set up');
    expect(backend.readText('guides/setup.md')).toBe('# Set up');
    await writeFolderPage(backend, 'missing.md', 'x');
    expect(backend.hasFile('missing.md')).toBe(false);
  });

  it('gives a folder without a page file an index.md on first write', async () => {
    backend.seedText('plain/a.md', '# A');
    expect(await readFolderPage(backend, 'plain')).toBeNull();
    await writeFolderPage(backend, 'plain', '# Plain');
    expect(backend.readText('plain/index.md')).toBe('# Plain');
  });

  it('adds numbered Untitled pages at the root and under folders', async () => {
    expect(await addFolderPage(backend, undefined)).toEqual({ pageId: 'Untitled.md', moved: [] });
    expect((await addFolderPage(backend, undefined)).pageId).toBe('Untitled 2.md');
    expect((await addFolderPage(backend, 'guides')).pageId).toBe('guides/Untitled.md');
    expect(backend.readText('Untitled 2.md')).toBe('');
  });

  it('turns a file page into a folder page when it gets a child', async () => {
    const change = await addFolderPage(backend, 'todo.md', 'Groceries', '# Milk');
    expect(change).toEqual({
      pageId: 'todo/Groceries.md',
      moved: [{ from: 'todo.md', to: 'todo' }],
    });
    expect(backend.readText('todo/index.md')).toBe('# Todo');
    expect(backend.readText('todo/Groceries.md')).toBe('# Milk');
  });

  it('adds a child of the root page at the root', async () => {
    expect((await addFolderPage(backend, 'README.md')).pageId).toBe('Untitled.md');
    expect(backend.readText('README.md')).toBe('# Notes');
  });

  it('renames pages on disk and reports the move', async () => {
    expect(await renameFolderPage(backend, 'guides/setup.md', 'Install / Setup')).toEqual({
      pageId: 'guides/Install - Setup.md',
      moved: [{ from: 'guides/setup.md', to: 'guides/Install - Setup.md' }],
    });
    const folder = await renameFolderPage(backend, 'guides', 'Manuals');
    expect(folder.pageId).toBe('Manuals');
    expect(backend.readText('Manuals/Install - Setup.md')).toBe('# Setup');
    expect(backend.readText('Manuals/logo.png')).toBe('png');
    expect(await renameFolderPage(backend, 'todo.md', '  ')).toEqual({
      pageId: 'todo.md',
      moved: [],
    });
  });

  it('refuses names reserved for folder pages', async () => {
    await expect(renameFolderPage(backend, 'todo.md', 'README')).rejects.toThrow(/reserved/);
    expect(backend.readText('todo.md')).toBe('# Todo');
  });

  it('moves a page to the root', async () => {
    expect(await moveFolderPageToRoot(backend, 'guides/setup.md')).toEqual({
      pageId: 'setup.md',
      moved: [{ from: 'guides/setup.md', to: 'setup.md' }],
    });
    expect(backend.hasFile('guides/setup.md')).toBe(false);
  });

  describe('moving into another page', () => {
    beforeEach(() => {
      backend.seedText('todo.md', 'Do [setup](guides/setup.md) and ![logo](guides/logo.png).');
      backend.seedText('guides/setup.md', '[back](../todo.md)');
      backend.seedText('guides/logo.png', 'png');
    });

    it('moves a page into a folder page, rewriting links', async () => {
      expect(await moveFolderPageInto(backend, 'todo.md', 'guides')).toEqual({
        pageId: 'guides/todo.md',
        moved: [{ from: 'todo.md', to: 'guides/todo.md' }],
        rewritten: ['guides/setup.md', 'guides/todo.md'],
      });
      expect(backend.hasFile('todo.md')).toBe(false);
      expect(backend.readText('guides/setup.md')).toBe('[back](todo.md)');
      expect(backend.readText('guides/todo.md')).toBe(
        'Do [setup](setup.md) and ![logo](logo.png).',
      );
    });

    it('nests a page under a file page, which becomes a folder page', async () => {
      const change = await moveFolderPageInto(backend, 'todo.md', 'guides/setup.md');
      expect(change.pageId).toBe('guides/setup/todo.md');
      expect(change.moved).toEqual([
        { from: 'guides/setup.md', to: 'guides/setup' },
        { from: 'todo.md', to: 'guides/setup/todo.md' },
      ]);
      expect(backend.hasFile('guides/setup.md')).toBe(false);
      expect(backend.readText('guides/setup/index.md')).toBe('[back](todo.md)');
    });

    it('moves a page to the root with an empty target', async () => {
      expect((await moveFolderPageInto(backend, 'guides/setup.md', '')).pageId).toBe('setup.md');
    });

    it('previews the links a move would update without writing', async () => {
      const preview = await previewMoveInto(backend, 'todo.md', 'guides/setup.md');
      expect(preview.total).toBeGreaterThan(0);
      expect(preview.pages.some((p) => p.file === 'todo.md' && p.moved)).toBe(true);
      expect(backend.hasFile('todo.md')).toBe(true);
      expect(backend.hasFile('guides/setup.md')).toBe(true);
      expect((await previewMoveInto(backend, 'guides/setup.md', 'guides')).total).toBe(0);
    });

    it('refuses to move a page into itself or its own subtree', async () => {
      await expect(moveFolderPageInto(backend, 'guides', 'guides')).rejects.toThrow();
      await expect(moveFolderPageInto(backend, 'guides', 'guides/setup.md')).rejects.toThrow();
      expect(backend.hasFile('guides/setup.md')).toBe(true);
    });

    it('moves a file that is not a page, rewriting links to it', async () => {
      backend.seedText('archive/old.md', '# Old');
      const change = await moveForeignFileInto(backend, 'guides/logo.png', 'archive');
      expect(change.pageId).toBe('archive/logo.png');
      expect(backend.readText('archive/logo.png')).toBe('png');
      expect(backend.readText('todo.md')).toContain('![logo](archive/logo.png)');
      expect((await previewMoveForeignInto(backend, 'archive/logo.png', 'guides')).total).toBe(1);
    });

    it('moves a file into a file page, which becomes a folder page', async () => {
      const change = await moveForeignFileInto(backend, 'guides/logo.png', 'todo.md');
      expect(change.pageId).toBe('todo/logo.png');
      expect(backend.readText('todo/index.md')).toContain('![logo](logo.png)');
    });
  });

  it('duplicates a page’s own content as a numbered copy beside it', async () => {
    expect((await duplicateFolderPage(backend, 'guides')).pageId).toBe('guides (copy).md');
    expect(backend.readText('guides (copy).md')).toBe('# Guides');
    expect((await duplicateFolderPage(backend, 'guides/setup.md')).pageId).toBe(
      'guides/setup (copy).md',
    );
    expect((await duplicateFolderPage(backend, 'guides/setup.md')).pageId).toBe(
      'guides/setup (copy) 2.md',
    );
  });

  it('deletes page files only, keeping attachments', async () => {
    await deleteFolderPage(backend, 'todo.md');
    expect(backend.hasFile('todo.md')).toBe(false);
    await deleteFolderPage(backend, 'guides');
    expect(backend.hasFile('guides/index.md')).toBe(false);
    expect(backend.hasFile('guides/setup.md')).toBe(false);
    expect(backend.readText('guides/logo.png')).toBe('png');
    expect(backend.readText('README.md')).toBe('# Notes');
  });

  it('makes titles safe as file names', () => {
    expect(pageNameFromTitle(' a/b\\c ')).toBe('a-b-c');
    expect(pageNameFromTitle('..hidden')).toBe('hidden');
  });

  describe('files that are not pages', () => {
    beforeEach(() => {
      backend.seedText('guides/setup.md', 'Logo: ![logo](logo.png) and [spec](../spec.pdf).');
      backend.seedText('todo.md', 'See ![logo](guides/logo.png).');
      backend.seedText('spec.pdf', 'pdf');
    });

    it('renames a file, keeping its extension, and rewrites links to it', async () => {
      expect(await renameForeignFile(backend, 'guides/logo.png', 'brand')).toEqual({
        pageId: 'guides/brand.png',
        moved: [{ from: 'guides/logo.png', to: 'guides/brand.png' }],
        rewritten: ['guides/setup.md', 'todo.md'],
      });
      expect(backend.hasFile('guides/logo.png')).toBe(false);
      expect(backend.readText('guides/brand.png')).toBe('png');
      expect(backend.readText('todo.md')).toBe('See ![logo](guides/brand.png).');
      expect(backend.readText('guides/setup.md')).toContain('![logo](brand.png)');
    });

    it('does not turn a file into a page', async () => {
      await expect(renameForeignFile(backend, 'guides/logo.png', 'logo.md')).rejects.toThrow(
        /page/,
      );
      expect(backend.readText('guides/logo.png')).toBe('png');
    });

    it('leaves links alone when asked to', async () => {
      await renameForeignFile(backend, 'guides/logo.png', 'brand', false);
      expect(backend.readText('todo.md')).toBe('See ![logo](guides/logo.png).');
    });

    it('moves a file to the root and rewrites links to it', async () => {
      const change = await moveForeignFileToRoot(backend, 'guides/logo.png');
      expect(change.pageId).toBe('logo.png');
      expect(backend.readText('todo.md')).toBe('See ![logo](logo.png).');
      expect(backend.readText('guides/setup.md')).toContain('![logo](../logo.png)');
    });

    it('previews the pages a rename or move would update', async () => {
      const rename = await previewRenameForeignLinks(backend, 'guides/logo.png', 'brand');
      expect(rename.total).toBe(2);
      expect(rename.pages.map((p) => p.file).sort()).toEqual(['guides/setup.md', 'todo.md']);
      const move = await previewMoveForeignToRootLinks(backend, 'guides/logo.png');
      expect(move.total).toBe(2);
      expect(backend.readText('todo.md')).toBe('See ![logo](guides/logo.png).');
    });

    it('deletes only the file', async () => {
      await deleteForeignFile(backend, 'spec.pdf');
      expect(backend.hasFile('spec.pdf')).toBe(false);
      await deleteForeignFile(backend, 'todo.md');
      expect(backend.hasFile('todo.md')).toBe(true);
      await deleteForeignFile(backend, 'missing.bin');
    });
  });

  describe('links when pages move', () => {
    beforeEach(() => {
      backend.seedText('todo.md', 'Do [setup](guides/setup.md#install).');
      backend.seedText('guides/index.md', '[again](setup.md) and [home](../README.md)');
      backend.seedText('guides/setup.md', '[back](../todo.md) ![logo](logo.png)');
    });

    it('previews the pages and links a rename would update', async () => {
      const preview = await previewRenameLinks(backend, 'guides/setup.md', 'Install');
      expect(preview.total).toBe(2);
      expect(preview.pages).toHaveLength(2);
      expect(preview.pages).toEqual(
        expect.arrayContaining([
          { file: 'todo.md', count: 1, moved: false },
          { file: 'guides/index.md', count: 1, moved: false },
        ]),
      );
      expect(backend.readText('todo.md')).toContain('guides/setup.md');
    });

    it('marks the page being moved in a preview of its own relative links', async () => {
      const preview = await previewMoveToRootLinks(backend, 'guides/setup.md');
      expect(preview.pages).toEqual(
        expect.arrayContaining([expect.objectContaining({ file: 'guides/setup.md', moved: true })]),
      );
    });

    it('rewrites inbound links on rename', async () => {
      await renameFolderPage(backend, 'guides/setup.md', 'Install');
      expect(backend.readText('todo.md')).toBe('Do [setup](guides/Install.md#install).');
      expect(backend.readText('guides/index.md')).toBe(
        '[again](Install.md) and [home](../README.md)',
      );
      expect(backend.hasFile('guides/setup.md')).toBe(false);
    });

    it('rewrites a moved page’s own relative links and images', async () => {
      await moveFolderPageToRoot(backend, 'guides/setup.md');
      expect(backend.readText('setup.md')).toBe('[back](todo.md) ![logo](guides/logo.png)');
      expect(backend.readText('guides/index.md')).toBe(
        '[again](../setup.md) and [home](../README.md)',
      );
      expect((await previewMoveToRootLinks(backend, 'todo.md')).total).toBe(0);
    });

    it('leaves links alone when asked to', async () => {
      await renameFolderPage(backend, 'guides/setup.md', 'Install', false);
      expect(backend.readText('todo.md')).toContain('guides/setup.md#install');
    });

    it('updates links to a file page that becomes a folder page', async () => {
      await addFolderPage(backend, 'todo.md', 'Sub');
      expect(backend.readText('todo/index.md')).toBe('Do [setup](../guides/setup.md#install).');
    });

    it('puts every page back when the move fails', async () => {
      backend.seedText('guides/Install.md', 'taken');
      await expect(renameFolderPage(backend, 'guides/setup.md', 'Install')).rejects.toThrow(
        /already exists/,
      );
      expect(backend.readText('todo.md')).toBe('Do [setup](guides/setup.md#install).');
      expect(backend.readText('guides/index.md')).toBe(
        '[again](setup.md) and [home](../README.md)',
      );
      expect(backend.readText('guides/setup.md')).toBe('[back](../todo.md) ![logo](logo.png)');
    });

    it('puts earlier pages back when a rewrite write fails', async () => {
      const write = backend.writeFile.bind(backend);
      let writes = 0;
      backend.writeFile = async (path: string, data: Uint8Array) => {
        if (path === '/guides/index.md' && ++writes === 1) throw new Error('disk full');
        return write(path, data);
      };
      await expect(renameFolderPage(backend, 'guides/setup.md', 'Install')).rejects.toThrow(
        /disk full/,
      );
      expect(backend.readText('todo.md')).toBe('Do [setup](guides/setup.md#install).');
      expect(backend.hasFile('guides/Install.md')).toBe(false);
    });

    it('reports the original error when putting a page back also fails', async () => {
      backend.seedText('guides/Install.md', 'taken');
      const write = backend.writeFile.bind(backend);
      let rewrites = 0;
      backend.writeFile = async (path: string, data: Uint8Array) => {
        // The rewrite of todo.md succeeds; putting it back afterwards does not.
        if (path === '/todo.md' && ++rewrites === 2) throw new Error('rollback failed');
        return write(path, data);
      };
      await expect(renameFolderPage(backend, 'guides/setup.md', 'Install')).rejects.toThrow(
        /already exists/,
      );
    });
  });
});

describe('backlinks', () => {
  it('lists, for each page, the pages that link to it with the link text', async () => {
    const backend = fixture();
    backend.seedText(
      'README.md',
      '# Notes\n\nStart with [the setup guide](guides/setup.md#install).\n',
    );
    backend.seedText('todo.md', '# Todo\n\nSee [setup](guides/setup.md) and [home](README.md).\n');
    backend.seedText(
      'guides/setup.md',
      '# Setup\n\nBack to [notes](../README.md). [self](setup.md)\n',
    );

    const backlinks = await readFolderBacklinks(backend);

    expect(backlinks.get('guides/setup.md')).toEqual([
      { source: 'README.md', title: 'Notes', snippets: ['the setup guide'] },
      { source: 'todo.md', title: 'Todo', snippets: ['setup'] },
    ]);
    // The root page is addressed by its file, like the sidebar does.
    expect(backlinks.get('README.md')?.map((b) => b.source)).toEqual([
      'guides/setup.md',
      'todo.md',
    ]);
    expect(backlinks.get('todo.md')).toBeUndefined();
  });

  it('ignores links to files that are not pages and dead links', async () => {
    const backend = fixture();
    backend.seedText('todo.md', '# Todo\n\n![logo](guides/logo.png) [gone](missing.md)\n');
    const backlinks = await readFolderBacklinks(backend);
    expect([...backlinks.keys()]).toEqual([]);
  });
});

describe('readFolderCommentCounts', () => {
  const sam = { id: 'github:sam', name: 'Sam' };
  const marker = (id: string, extra: Partial<PageComment> = {}) =>
    formatCommentMarker({ id, author: sam, created: '2026-10-01T10:00:00Z', body: id, ...extra });

  it('counts the open comments of each page, by the id the sidebar uses', async () => {
    const backend = fixture();
    backend.seedText('README.md', `# Notes\n\n${marker('c-aaaaaaaaaa')}\n`);
    backend.seedText(
      'guides/setup.md',
      `# Setup\n\n${marker('c-bbbbbbbbbb')}\n\n${marker('c-cccccccccc')}\n`,
    );
    const counts = await readFolderCommentCounts(backend);
    expect(counts.get('README.md')).toBe(1);
    expect(counts.get('guides/setup.md')).toBe(2);
    expect(counts.has('todo.md')).toBe(false);
  });

  it('leaves out a resolved thread and the replies to it', async () => {
    const backend = fixture();
    backend.seedText(
      'todo.md',
      [
        '# Todo',
        marker('c-aaaaaaaaaa', { status: 'resolved' }),
        marker('c-bbbbbbbbbb', { replyTo: 'c-aaaaaaaaaa' }),
        marker('c-cccccccccc', { status: 'open' }),
        '',
      ].join('\n\n'),
    );
    expect((await readFolderCommentCounts(backend)).get('todo.md')).toBe(1);
  });

  it('leaves out a reply to a reply under a resolved thread', async () => {
    const backend = fixture();
    backend.seedText(
      'todo.md',
      [
        '# Todo',
        marker('c-aaaaaaaaaa', { status: 'resolved' }),
        marker('c-bbbbbbbbbb', { replyTo: 'c-aaaaaaaaaa' }),
        marker('c-cccccccccc', { replyTo: 'c-bbbbbbbbbb' }),
        '',
      ].join('\n\n'),
    );
    expect((await readFolderCommentCounts(backend)).has('todo.md')).toBe(false);
  });

  it('does not count marker lookalikes in code, and skips unreadable markers', async () => {
    const backend = fixture();
    backend.seedText(
      'todo.md',
      `# Todo\n\n\`\`\`\n${marker('c-aaaaaaaaaa')}\n\`\`\`\n\n<!-- cept:comment {not json} -->\n`,
    );
    expect((await readFolderCommentCounts(backend)).has('todo.md')).toBe(false);
  });
});
