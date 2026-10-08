/**
 * Tests for opening a folder on this device as a space (REQ-WS-012,
 * REQ-WEB-023): looking for spaces in it, adding it as a folder space,
 * restoring it after a reload, and that none of this writes to the folder
 * (REQ-WS-019).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { FolderHandleStore, StorageBackend } from '@cept/core';
import { MemoryBackend } from './test-helpers.js';
import { SpaceManager } from './SpaceManager.js';
import type { SpaceSnapshot } from './SpaceManager.js';
import { findSavedFolder, inspectFolder, restoreFolderSpaces } from './folder-open.js';
import type { FolderHost } from './folder-host.js';
import { initFolderSpace } from './folder-space.js';

/** Wraps a backend, passing every call through and recording each one that changes it. */
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
    writeFile: (p, d) => {
      writes.push(`writeFile ${p}`);
      return inner.writeFile(p, d);
    },
    deleteFile: (p) => {
      writes.push(`deleteFile ${p}`);
      return inner.deleteFile(p);
    },
    initialize: (c) => {
      writes.push('initialize');
      return inner.initialize(c);
    },
    close: () => inner.close(),
  };
  return { backend, writes };
}

const MARKER = 'version: 1\nname: Notes\nslug: notes\n';

/** A folder that is a space: a marker, a config, pages and a non-page file. */
function spaceFolder(): MemoryBackend {
  const folder = new MemoryBackend();
  folder.seedText('space.cept.yaml', MARKER);
  folder.seedText('.cept.yaml', 'hide:\n  - drafts\n');
  folder.seedText('Welcome.md', '---\ntitle: Welcome\n---\n# Welcome\n\nHello.\n');
  folder.seedText('Guides/Setup.md', '# Setup\n');
  folder.seedText('notes.txt', 'plain text');
  return folder;
}

/** Every file in a backend with its content, to compare before and after. */
async function contents(backend: StorageBackend, dir = ''): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const entry of await backend.listDirectory(dir)) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory) Object.assign(out, await contents(backend, path));
    else out[path] = new TextDecoder().decode((await backend.readFile(path)) ?? new Uint8Array());
  }
  return out;
}

function memoryStore(
  entries: [string, FileSystemDirectoryHandle][] = [],
): FolderHandleStore & { map: Map<string, FileSystemDirectoryHandle> } {
  const map = new Map(entries);
  return {
    map,
    save: async (id, handle) => void map.set(id, handle),
    load: async (id) => map.get(id) ?? null,
    list: async () => [...map].map(([id, handle]) => ({ id, handle })),
    remove: async (id) => void map.delete(id),
  };
}

/** A handle that is the same folder as handles with the same `name`. */
function handle(name: string, permission: PermissionState = 'granted') {
  return {
    kind: 'directory',
    name,
    isSameEntry: async (other: { name: string }) => other.name === name,
    queryPermission: async () => permission,
    requestPermission: async () => permission,
  } as unknown as FileSystemDirectoryHandle;
}

describe('inspectFolder', () => {
  it('finds the folder itself when it is a space, without writing', async () => {
    const { backend, writes } = writeSpy(spaceFolder());
    expect(await inspectFolder(backend, 'notes')).toEqual({
      root: { path: '', name: 'Notes' },
      nested: [],
    });
    expect(writes).toEqual([]);
  });

  it('lists spaces in subfolders when the folder itself is not a space', async () => {
    const folder = new MemoryBackend();
    folder.seedText('readme.md', '# repo');
    folder.seedText('docs/space.cept.yaml', 'version: 1\nname: Docs\nslug: docs\n');
    folder.seedText('wiki/space.cept.yml', 'not: [valid');
    const { backend, writes } = writeSpy(folder);

    const found = await inspectFolder(backend, 'repo');
    expect(found.root).toBeNull();
    expect(found.nested.map((c) => [c.path, c.name, Boolean(c.error)])).toEqual([
      ['docs', 'Docs', false],
      ['wiki', 'wiki', true],
    ]);
    expect(writes).toEqual([]);
  });

  it('finds nothing in a plain folder, and writes nothing', async () => {
    const folder = new MemoryBackend();
    folder.seedText('todo.md', '- [ ] one');
    const { backend, writes } = writeSpy(folder);
    expect(await inspectFolder(backend, 'plain')).toEqual({ root: null, nested: [] });
    expect(writes).toEqual([]);
    expect(folder.hasFile('space.cept.yaml')).toBe(false);
  });
});

describe('opening a folder space (REQ-WS-019)', () => {
  let app: MemoryBackend;
  let spaces: SpaceManager;

  beforeEach(() => {
    app = new MemoryBackend();
    spaces = new SpaceManager(app);
  });

  it('adds, opens and saves an unchanged folder space with zero writes to the folder', async () => {
    const folder = spaceFolder();
    const before = await contents(folder);
    const { backend, writes } = writeSpy(folder);

    const { space, manifest } = await spaces.create('Notes', undefined, {
      kind: 'folder',
      backend,
    });
    expect(space.backend).toBe('folder');
    expect(manifest.activeSpaceId).toBe(space.id);

    const opened = await spaces.open(space.id, 'Notes');
    expect(opened.converted).toBeFalsy();
    expect(opened.snapshot?.pages.map((p) => p.title).sort()).toEqual(['Guides', 'Welcome']);
    // The app saves what it opened (autosave); nothing changed, so nothing is written.
    await spaces.saveState(space.id, opened.snapshot!);

    expect(writes).toEqual([]);
    expect(await contents(folder)).toEqual(before);
    expect(folder.hasFile('pages/index.md')).toBe(false);
    // The space is recorded in the app's own backend instead.
    expect(app.readText('.cept/spaces.json')).toContain(space.id);
  });

  it('keeps view state in the app and writes a page only once the user edits it', async () => {
    const folder = spaceFolder();
    const { backend, writes } = writeSpy(folder);
    const { space } = await spaces.create('Notes', undefined, { kind: 'folder', backend });
    const { snapshot } = await spaces.open(space.id, 'Notes');

    const welcome = snapshot!.pages.find((p) => p.title === 'Welcome')!;
    const changed: SpaceSnapshot = {
      ...snapshot!,
      favorites: [{ id: welcome.id, title: 'Welcome' }],
      selectedPageId: welcome.id,
    };
    const original = folder.readText('Welcome.md')!;
    // A page the user only read is saved back as it was: nothing is written.
    await spaces.saveState(space.id, changed, { [welcome.id]: original });
    expect(writes).toEqual([]);
    // Favourites and the selected page live in the app's backend, not the folder.
    expect(app.readText(`.cept/spaces/${space.id}/workspace-state.json`)).toContain('favorites');
    expect(folder.hasFile('.cept/workspace-state.json')).toBe(false);

    // An edit is written to the page's own file, and nothing else.
    await spaces.saveState(space.id, changed, { [welcome.id]: `${original}More.\n` });
    expect(writes).toEqual(['writeFile /Welcome.md']);
    expect(folder.readText('Welcome.md')).toBe(`${original}More.\n`);
    expect(folder.readText('space.cept.yaml')).toBe(MARKER);
  });

  it('reopens a folder space with the view state kept in the app', async () => {
    const folder = spaceFolder();
    const { space } = await spaces.create('Notes', undefined, { kind: 'folder', backend: folder });
    const { snapshot } = await spaces.open(space.id, 'Notes');
    const welcome = snapshot!.pages.find((p) => p.title === 'Welcome')!;
    await spaces.saveState(space.id, { ...snapshot!, selectedPageId: welcome.id });

    const reloaded = new SpaceManager(app);
    await reloaded.load();
    reloaded.connectFolder(space, folder);
    const reopened = await reloaded.open(space.id, 'Notes');
    expect(reopened.snapshot?.selectedPageId).toBe(welcome.id);
    expect(reopened.selectedContent).toContain('# Welcome');
  });

  it('opens a space in a subfolder through its subPath', async () => {
    const folder = new MemoryBackend();
    folder.seedText('readme.md', '# repo');
    folder.seedText('docs/space.cept.yaml', 'version: 1\nname: Docs\nslug: docs\n');
    folder.seedText('docs/Intro.md', '# Intro\n');
    const { backend, writes } = writeSpy(folder);

    const { space } = await spaces.create('Docs', undefined, {
      kind: 'folder',
      backend,
      subPath: 'docs',
    });
    expect(space.subPath).toBe('docs');
    const { snapshot } = await spaces.open(space.id, 'Docs');
    expect(snapshot?.pages.map((p) => p.title)).toEqual(['Intro']);
    expect(writes).toEqual([]);
  });

  it('keeps a folder space listed after a reload, but cannot open or save it until reconnected', async () => {
    const folder = spaceFolder();
    const { space } = await spaces.create('Notes', undefined, { kind: 'folder', backend: folder });

    const reloaded = new SpaceManager(app);
    const manifest = await reloaded.load();
    expect(manifest.spaces.map((s) => s.id)).toContain(space.id);
    expect(manifest.activeSpaceId).toBe(space.id);
    expect(reloaded.isConnected(space.id)).toBe(false);
    await expect(reloaded.open(space.id, 'Notes')).rejects.toThrow(/not connected/);
    // Saving an unconnected space is skipped rather than written to the app backend.
    await reloaded.saveState(space.id, {
      pages: [],
      favorites: [],
      recentPages: [],
      spaceName: 'Notes',
    });
    expect(app.hasFile(`.cept/spaces/${space.id}/workspace-state.json`)).toBe(false);

    reloaded.connectFolder(space, folder);
    expect(reloaded.isConnected(space.id)).toBe(true);
    const { snapshot } = await reloaded.open(space.id, 'Notes');
    expect(snapshot?.pages.map((p) => p.title).sort()).toEqual(['Guides', 'Welcome']);
  });

  it('writes the marker only through the separate "make it a space" step', async () => {
    const folder = new MemoryBackend();
    folder.seedText('todo.md', '- [ ] one');
    const { backend, writes } = writeSpy(folder);
    expect((await inspectFolder(backend, 'plain')).root).toBeNull();
    expect(writes).toEqual([]);

    await initFolderSpace(backend, 'Plain');
    expect(writes).toEqual(['writeFile /space.cept.yaml']);
    expect(folder.readText('todo.md')).toBe('- [ ] one');
  });
});

describe('findSavedFolder', () => {
  it('finds the folder space that already opens a picked folder', async () => {
    const spaces = new SpaceManager(new MemoryBackend());
    const { manifest, space } = await spaces.create('Notes', undefined, {
      kind: 'folder',
      backend: new MemoryBackend(),
    });
    const store = memoryStore([[space.id, handle('notes')]]);
    expect(await findSavedFolder(manifest, store, handle('notes'))).toBe(space.id);
    expect(await findSavedFolder(manifest, store, handle('other'))).toBeNull();
    // The same folder at another sub-path is another space.
    expect(await findSavedFolder(manifest, store, handle('notes'), 'docs')).toBeNull();
  });

  it('finds nothing when the browser cannot compare handles', async () => {
    const spaces = new SpaceManager(new MemoryBackend());
    const { manifest, space } = await spaces.create('Notes', undefined, {
      kind: 'folder',
      backend: new MemoryBackend(),
    });
    const plain = { kind: 'directory', name: 'notes' } as unknown as FileSystemDirectoryHandle;
    expect(await findSavedFolder(manifest, memoryStore([[space.id, plain]]), plain)).toBeNull();
  });
});

describe('restoreFolderSpaces', () => {
  it('connects folders the browser still allows and returns the others', async () => {
    const app = new MemoryBackend();
    const first = new SpaceManager(app);
    const granted = new MemoryBackend();
    granted.seedText('space.cept.yaml', MARKER);
    const { space: a } = await first.create('A', undefined, { kind: 'folder', backend: granted });
    const { space: b } = await first.create('B', undefined, {
      kind: 'folder',
      backend: new MemoryBackend(),
    });

    const reloaded = new SpaceManager(app);
    const manifest = await reloaded.load();
    const handleA = handle('a', 'granted');
    const handleB = handle('b', 'prompt');
    const opened: FileSystemDirectoryHandle[] = [];
    const host: FolderHost = {
      pick: async () => null,
      open: (h) => {
        opened.push(h);
        return granted;
      },
      handles: memoryStore([
        [a.id, handleA],
        [b.id, handleB],
        ['gone', handle('gone')],
      ]),
    };

    const waiting = await restoreFolderSpaces(reloaded, manifest, host);
    expect(opened).toEqual([handleA]);
    expect(reloaded.isConnected(a.id)).toBe(true);
    expect(reloaded.isConnected(b.id)).toBe(false);
    expect([...waiting]).toEqual([[b.id, handleB]]);
  });
});
