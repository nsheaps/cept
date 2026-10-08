/**
 * StorageBackend conformance suite.
 *
 * One behavioural specification for every StorageBackend implementation.
 * Each backend's test file (see conformance.test.ts) calls
 * `describeStorageBackendConformance(name, factory, options)`.
 *
 * Specified behaviour (paths are workspace-relative; a leading "/" is optional):
 * - readFile of a missing path resolves to null.
 * - writeFile then readFile round-trips the bytes exactly; a second write overwrites.
 * - writeFile creates missing parent directories implicitly.
 * - listDirectory returns direct children only, with correct isFile/isDirectory,
 *   and [] for a directory that does not exist.
 * - exists is true for files and directories, false for missing paths.
 * - stat returns size/isFile/isDirectory for files and directories, null if missing.
 * - deleteFile removes a file; deleting a missing path is a no-op.
 * - deleteFile on a directory removes everything under it (recursive delete).
 * - watch(path, cb) delivers create/modify/delete events for writes and deletes
 *   under the watched path, and stops after unsubscribe (when `options.watch`).
 *
 * Not specified (backends differ): whether an emptied parent directory still
 * exists after its last file is deleted (implicit-directory backends drop it,
 * filesystem-backed ones keep it), event ordering, and timestamps.
 *
 * Imports vitest, so this file is excluded from the package build (tsconfig).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StorageBackend, FsEvent } from './backend.js';

export interface ConformanceFixture {
  backend: StorageBackend;
  /** Release resources (close backend, remove temp dirs). */
  cleanup?: () => Promise<void>;
}

export interface ConformanceOptions {
  /**
   * Whether watch() is expected to deliver events for writes/deletes made
   * through the same backend instance. Defaults to false. Backends that
   * cannot watch (WebFsBackend: the File System Access API has no watch) leave
   * it false and instead get a check that watch() returns an unsubscribe
   * function. MemoryBackend and BrowserFsBackend report their own in-process
   * changes even though `capabilities.watchForExternalChanges` is false.
   */
  watch?: boolean;
}

const enc = (text: string) => new TextEncoder().encode(text);
const dec = (data: Uint8Array | null) => (data ? new TextDecoder().decode(data) : null);
const names = (entries: { name: string }[]) => entries.map((e) => e.name).sort();
const stripSlash = (p: string) => p.replace(/^\/+/, '');

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

export function describeStorageBackendConformance(
  name: string,
  createFixture: () => Promise<ConformanceFixture> | ConformanceFixture,
  options: ConformanceOptions = {},
): void {
  describe(`StorageBackend conformance: ${name}`, () => {
    let fixture: ConformanceFixture;
    let backend: StorageBackend;

    beforeEach(async () => {
      fixture = await createFixture();
      backend = fixture.backend;
    });

    afterEach(async () => {
      if (fixture.cleanup) await fixture.cleanup();
      else await backend.close();
    });

    describe('readFile / writeFile', () => {
      it('returns null for a missing file', async () => {
        expect(await backend.readFile('missing.txt')).toBeNull();
        expect(await backend.readFile('no/such/dir/file.txt')).toBeNull();
      });

      it('round-trips bytes exactly', async () => {
        const bytes = new Uint8Array([0, 1, 2, 127, 128, 255]);
        await backend.writeFile('bin.dat', bytes);
        expect(Array.from((await backend.readFile('bin.dat'))!)).toEqual(Array.from(bytes));
      });

      it('round-trips an empty file', async () => {
        await backend.writeFile('empty.txt', new Uint8Array());
        const read = await backend.readFile('empty.txt');
        expect(read).not.toBeNull();
        expect(read!.byteLength).toBe(0);
      });

      it('overwrites an existing file', async () => {
        await backend.writeFile('a.txt', enc('first value'));
        await backend.writeFile('a.txt', enc('2nd'));
        expect(dec(await backend.readFile('a.txt'))).toBe('2nd');
      });

      it('creates parent directories implicitly', async () => {
        await backend.writeFile('a/b/c/file.txt', enc('deep'));
        expect(dec(await backend.readFile('a/b/c/file.txt'))).toBe('deep');
        expect(await backend.exists('a')).toBe(true);
        expect(await backend.exists('a/b')).toBe(true);
        expect(await backend.exists('a/b/c')).toBe(true);
      });

      it('treats a leading slash as optional', async () => {
        await backend.writeFile('/lead.txt', enc('x'));
        expect(dec(await backend.readFile('lead.txt'))).toBe('x');
        expect(dec(await backend.readFile('/lead.txt'))).toBe('x');
      });
    });

    describe('listDirectory', () => {
      it('lists direct children of the root only', async () => {
        await backend.writeFile('top.txt', enc('1'));
        await backend.writeFile('dir/inner.txt', enc('2'));
        await backend.writeFile('dir/sub/deep.txt', enc('3'));

        const root = await backend.listDirectory('/');
        expect(names(root)).toEqual(['dir', 'top.txt']);
        expect(root.find((e) => e.name === 'top.txt')).toMatchObject({
          isFile: true,
          isDirectory: false,
        });
        expect(root.find((e) => e.name === 'dir')).toMatchObject({
          isFile: false,
          isDirectory: true,
        });
      });

      it('lists direct children of a nested directory only', async () => {
        await backend.writeFile('dir/inner.txt', enc('2'));
        await backend.writeFile('dir/sub/deep.txt', enc('3'));
        await backend.writeFile('other/x.txt', enc('4'));

        const entries = await backend.listDirectory('dir');
        expect(names(entries)).toEqual(['inner.txt', 'sub']);
        expect(entries.find((e) => e.name === 'inner.txt')).toMatchObject({
          isFile: true,
          isDirectory: false,
        });
        expect(entries.find((e) => e.name === 'sub')).toMatchObject({
          isFile: false,
          isDirectory: true,
        });
        expect(names(await backend.listDirectory('dir/sub'))).toEqual(['deep.txt']);
      });

      it('accepts a leading slash on the directory path', async () => {
        await backend.writeFile('dir/a.txt', enc('a'));
        expect(names(await backend.listDirectory('/dir'))).toEqual(['a.txt']);
      });

      it('returns [] for a directory that does not exist', async () => {
        expect(await backend.listDirectory('nope')).toEqual([]);
        expect(await backend.listDirectory('nope/deeper')).toEqual([]);
      });

      it('returns [] for the root of an empty backend, not an error', async () => {
        expect(await backend.listDirectory('/')).toEqual([]);
      });
    });

    describe('exists', () => {
      it('is true for files and directories, false for missing paths', async () => {
        await backend.writeFile('dir/file.txt', enc('x'));
        expect(await backend.exists('dir/file.txt')).toBe(true);
        expect(await backend.exists('dir')).toBe(true);
        expect(await backend.exists('missing.txt')).toBe(false);
        expect(await backend.exists('dir/missing.txt')).toBe(false);
        expect(await backend.exists('missing/dir/file.txt')).toBe(false);
      });
    });

    describe('stat', () => {
      it('reports size and kind for a file', async () => {
        await backend.writeFile('dir/file.txt', enc('hello'));
        const s = await backend.stat('dir/file.txt');
        expect(s).not.toBeNull();
        expect(s!.size).toBe(5);
        expect(s!.isFile).toBe(true);
        expect(s!.isDirectory).toBe(false);
        expect(s!.modifiedAt).toBeInstanceOf(Date);
        expect(s!.createdAt).toBeInstanceOf(Date);
      });

      it('reports kind for a directory', async () => {
        await backend.writeFile('dir/file.txt', enc('x'));
        const s = await backend.stat('dir');
        expect(s).not.toBeNull();
        expect(s!.isDirectory).toBe(true);
        expect(s!.isFile).toBe(false);
      });

      it('returns null for a missing path', async () => {
        expect(await backend.stat('missing.txt')).toBeNull();
        expect(await backend.stat('missing/dir')).toBeNull();
      });
    });

    describe('deleteFile', () => {
      it('removes a file and leaves its siblings', async () => {
        await backend.writeFile('dir/a.txt', enc('a'));
        await backend.writeFile('dir/b.txt', enc('b'));
        await backend.deleteFile('dir/a.txt');
        expect(await backend.readFile('dir/a.txt')).toBeNull();
        expect(await backend.exists('dir/a.txt')).toBe(false);
        expect(dec(await backend.readFile('dir/b.txt'))).toBe('b');
      });

      it('is a no-op for a missing path', async () => {
        await expect(backend.deleteFile('missing.txt')).resolves.toBeUndefined();
        await expect(backend.deleteFile('missing/dir/x.txt')).resolves.toBeUndefined();
      });

      it('deleting a directory removes everything under it (recursive)', async () => {
        await backend.writeFile('tree/a.txt', enc('a'));
        await backend.writeFile('tree/sub/b.txt', enc('b'));
        await backend.writeFile('tree/sub/deeper/c.txt', enc('c'));
        await backend.writeFile('tree-sibling/keep.txt', enc('keep'));
        await backend.writeFile('keep.txt', enc('keep'));

        await backend.deleteFile('tree');

        expect(await backend.exists('tree')).toBe(false);
        expect(await backend.exists('tree/sub')).toBe(false);
        expect(await backend.readFile('tree/a.txt')).toBeNull();
        expect(await backend.readFile('tree/sub/b.txt')).toBeNull();
        expect(await backend.readFile('tree/sub/deeper/c.txt')).toBeNull();
        expect(await backend.listDirectory('tree')).toEqual([]);
        expect(names(await backend.listDirectory('/'))).toEqual(['keep.txt', 'tree-sibling']);
        expect(dec(await backend.readFile('tree-sibling/keep.txt'))).toBe('keep');
      });
    });

    describe('initialize / close', () => {
      it('initialize creates the workspace config and root page', async () => {
        await backend.initialize({ name: 'Conformance' });
        expect(dec(await backend.readFile('.cept/config.yaml'))).toContain('name: "Conformance"');
        expect(await backend.exists('pages/index.md')).toBe(true);
      });

      it('initialize does not overwrite an existing root page', async () => {
        await backend.writeFile('pages/index.md', enc('mine'));
        await backend.initialize({ name: 'Conformance' });
        expect(dec(await backend.readFile('pages/index.md'))).toBe('mine');
      });

      it('close resolves', async () => {
        await expect(backend.close()).resolves.toBeUndefined();
      });
    });

    describe.skipIf(options.watch === true)('watch (unsupported)', () => {
      it('returns a callable unsubscribe and never throws', () => {
        const unsubscribe = backend.watch('watched', () => {});
        expect(typeof unsubscribe).toBe('function');
        unsubscribe();
      });
    });

    describe.runIf(options.watch === true)('watch', () => {
      it('emits create/modify for writes and delete for deletes under the watched path', async () => {
        const events: FsEvent[] = [];
        const unsubscribe = backend.watch('watched', (e) => events.push(e));
        const seen = (type: string) =>
          events.some((e) => stripSlash(e.path).endsWith('file.txt') && e.type === type);

        await backend.writeFile('watched/file.txt', enc('x'));
        await waitFor(() => events.some((e) => e.type === 'create' || e.type === 'modify'));
        expect(seen('create') || seen('modify')).toBe(true);

        await backend.deleteFile('watched/file.txt');
        await waitFor(() => events.some((e) => e.type === 'delete'));
        expect(events.some((e) => e.type === 'delete')).toBe(true);

        unsubscribe();
      });

      it('emits for nested paths under the watched path', async () => {
        const events: FsEvent[] = [];
        const unsubscribe = backend.watch('watched', (e) => events.push(e));
        await backend.writeFile('watched/a/b/deep.txt', enc('x'));
        await waitFor(() => events.some((e) => stripSlash(e.path).endsWith('deep.txt')));
        expect(events.some((e) => stripSlash(e.path).endsWith('deep.txt'))).toBe(true);
        unsubscribe();
      });

      it('does not emit for paths outside the watched path', async () => {
        const events: FsEvent[] = [];
        const unsubscribe = backend.watch('watched', (e) => events.push(e));
        await backend.writeFile('elsewhere/file.txt', enc('x'));
        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(events).toEqual([]);
        unsubscribe();
      });

      it('stops emitting after unsubscribe', async () => {
        const events: FsEvent[] = [];
        const unsubscribe = backend.watch('watched', (e) => events.push(e));
        await backend.writeFile('watched/first.txt', enc('1'));
        await waitFor(() => events.some((e) => stripSlash(e.path).endsWith('first.txt')));
        unsubscribe();
        await backend.writeFile('watched/second.txt', enc('2'));
        await new Promise((resolve) => setTimeout(resolve, 150));
        // Late events for first.txt may still trickle in; only second.txt proves a leak.
        expect(events.some((e) => stripSlash(e.path).endsWith('second.txt'))).toBe(false);
      });
    });
  });
}
