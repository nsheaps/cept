import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryBackend } from './test-helpers.js';
import {
  addFolderPage,
  deleteFolderPage,
  duplicateFolderPage,
  initFolderSpace,
  isFolderSpace,
  moveFolderPageToRoot,
  pageNameFromTitle,
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
        children: [{ id: 'guides/setup.md', title: 'setup', children: [] }],
      },
      { id: 'todo.md', title: 'todo', children: [] },
    ]);
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
      children: [],
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
});
