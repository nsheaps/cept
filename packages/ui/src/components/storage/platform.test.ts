import { describe, it, expect } from 'vitest';
import { MemoryBackend } from '@cept/core';
import { probePlatform, spaceSources } from './platform.js';

/** A backend that can host a Git clone, like the IndexedDB browser backend. */
class CloneHostBackend extends MemoryBackend {
  getRawFs(): unknown {
    return {};
  }
}

const desktopChrome = { indexedDB: {}, showDirectoryPicker: () => undefined };
const phonePwa = { indexedDB: {} };

describe('probePlatform', () => {
  it('finds File System Access and IndexedDB in desktop Chrome', () => {
    expect(probePlatform(desktopChrome)).toEqual({ fileSystemAccess: true, indexedDB: true });
  });

  it('finds no File System Access in a phone PWA', () => {
    expect(probePlatform(phonePwa)).toEqual({ fileSystemAccess: false, indexedDB: true });
  });

  it('finds nothing where neither API exists', () => {
    expect(probePlatform({ indexedDB: null, showDirectoryPicker: 'nope' })).toEqual({
      fileSystemAccess: false,
      indexedDB: false,
    });
  });
});

describe('spaceSources', () => {
  it('offers browser, folder and git in desktop Chrome', () => {
    expect(spaceSources(probePlatform(desktopChrome), new CloneHostBackend())).toEqual({
      browser: true,
      folder: true,
      git: true,
    });
  });

  it('hides the local folder in a phone PWA', () => {
    expect(spaceSources(probePlatform(phonePwa), new CloneHostBackend())).toEqual({
      browser: true,
      folder: false,
      git: true,
    });
  });

  it('hides git when the backend cannot host a clone', () => {
    expect(spaceSources(probePlatform(desktopChrome), new MemoryBackend()).git).toBe(false);
  });
});
