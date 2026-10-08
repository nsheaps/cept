/**
 * Writable GitHub spaces in the space manager (REQ-WS-027): a space synced
 * with the sign-in whose folder holds `space.cept.yaml` is read from its kept
 * clone, written only through its editing session, and keeps its state in
 * the app's backend.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryBackend, ScopedBackend } from '@cept/core';
import { GIT_SPACE_LOCKED, SpaceManager, generateRemoteSpaceId } from './SpaceManager.js';
import { cloneSpaceRoot } from './git-space.js';
import { spaceWorkspaceFile } from './space-paths.js';

const URL = 'https://github.com/me/notes';
const ID = generateRemoteSpaceId(URL, 'main');

describe('SpaceManager GitHub spaces (REQ-WS-027)', () => {
  let app: MemoryBackend;
  let spaces: SpaceManager;
  /** The space's folder in its kept clone. */
  let clone: ScopedBackend;

  beforeEach(async () => {
    app = new MemoryBackend();
    spaces = new SpaceManager(app);
    clone = new ScopedBackend(app, cloneSpaceRoot(ID));
    await clone.writeFile('space.cept.yaml', new TextEncoder().encode('name: Notes\n'));
    await clone.writeFile('Hello.md', new TextEncoder().encode('# Hello\n\nfrom GitHub\n'));
  });

  it('creates a space cloned with the sign-in as writable when asked', async () => {
    const { space } = await spaces.createRemote('Notes', URL, 'main', undefined, 'token', {
      writable: true,
    });
    expect(space.readOnly).toBe(false);
    expect(spaces.isGitSpace(ID)).toBe(true);
  });

  it('keeps anonymous clones read-only, even when asked for writable', async () => {
    const { space } = await spaces.createRemote('Notes', URL, 'main', undefined, 'anonymous', {
      writable: true,
    });
    expect(space.readOnly).toBe(true);
    expect(spaces.isGitSpace(ID)).toBe(false);
  });

  it('keeps remote spaces read-only by default', async () => {
    const { space } = await spaces.createRemote('Notes', URL, 'main', undefined, 'token');
    expect(space.readOnly).toBe(true);
  });

  it('reads the pages of a writable space from its clone', async () => {
    await spaces.createRemote('Notes', URL, 'main', undefined, 'token', { writable: true });
    const opened = await spaces.open(ID, 'Notes');
    expect(opened.snapshot?.pages.map((p) => p.id)).toEqual(['Hello.md']);
    expect(await spaces.readPage(ID, 'Hello.md')).toContain('from GitHub');
  });

  it('refuses writes to a writable space with no editing session', async () => {
    await spaces.createRemote('Notes', URL, 'main', undefined, 'token', { writable: true });
    await spaces.open(ID, 'Notes');
    await expect(spaces.writePage(ID, 'Hello.md', 'changed')).rejects.toThrow(GIT_SPACE_LOCKED);
    await expect(spaces.deletePage(ID, 'Hello.md')).rejects.toThrow(GIT_SPACE_LOCKED);
    expect(await spaces.readPage(ID, 'Hello.md')).toContain('from GitHub');
  });

  it('writes and deletes pages through the bound session backend, then stops on unbind', async () => {
    await spaces.createRemote('Notes', URL, 'main', undefined, 'token', { writable: true });
    await spaces.open(ID, 'Notes');
    const session = new ScopedBackend(app, cloneSpaceRoot(ID));
    spaces.bind(ID, session);
    await spaces.writePage(ID, 'Hello.md', '# Hello\n\nedited\n');
    expect(await clone.readFile('Hello.md')).not.toBeNull();
    expect(await spaces.readPage(ID, 'Hello.md')).toContain('edited');
    spaces.unbind(ID);
    await expect(spaces.writePage(ID, 'Hello.md', 'again')).rejects.toThrow(GIT_SPACE_LOCKED);
    spaces.bind(ID, session);
    await spaces.deletePage(ID, 'Hello.md');
    expect(await clone.exists('Hello.md')).toBe(false);
  });

  it('keeps the state of a writable space in the app backend, not in the clone', async () => {
    await spaces.createRemote('Notes', URL, 'main', undefined, 'token', { writable: true });
    const { snapshot } = await spaces.open(ID, 'Notes');
    await spaces.saveState(ID, { ...snapshot!, recentPages: [{ id: 'Hello.md', title: 'Hello' }] });
    expect(await app.exists(spaceWorkspaceFile(ID))).toBe(true);
    expect(await clone.exists('.cept')).toBe(false);
  });

  it('marks a space synced with the sign-in writable, but never an anonymous one', async () => {
    await spaces.createRemote('Notes', URL, 'main', undefined, 'token');
    const manifest = await spaces.markWritable(ID);
    expect(manifest.spaces.find((s) => s.id === ID)?.readOnly).toBe(false);
    expect(spaces.isGitSpace(ID)).toBe(true);

    const other = generateRemoteSpaceId('https://github.com/me/other', 'main');
    await spaces.createRemote(
      'Other',
      'https://github.com/me/other',
      'main',
      undefined,
      'anonymous',
    );
    await expect(spaces.markWritable(other)).rejects.toThrow(/GitHub sign-in/);
    expect(spaces.isGitSpace(other)).toBe(false);
  });

  it('keeps the writable flag after a reload of the manifest', async () => {
    await spaces.createRemote('Notes', URL, 'main', undefined, 'token', { writable: true });
    const again = new SpaceManager(app);
    await again.load();
    expect(again.isGitSpace(ID)).toBe(true);
  });

  it('forgets the space and its clone when it is deleted', async () => {
    await spaces.createRemote('Notes', URL, 'main', undefined, 'token', { writable: true });
    await spaces.delete(ID);
    expect(spaces.isGitSpace(ID)).toBe(false);
    expect(await clone.exists('space.cept.yaml')).toBe(false);
  });
});
