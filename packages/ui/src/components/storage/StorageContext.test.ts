import { describe, it, expect } from 'vitest';
import { MemoryBackend } from '@cept/core';
import { clearAllData } from './StorageContext.js';

const enc = (text: string) => new TextEncoder().encode(text);

async function seed(backend: MemoryBackend): Promise<void> {
  await backend.writeFile('space.cept.yaml', enc('name: Mine\n'));
  await backend.writeFile('Mine.md', enc('# Mine\n'));
  await backend.writeFile('Notes/Idea.md', enc('# Idea\n'));
  await backend.writeFile('.cept/workspace-state.json', enc('{}'));
  await backend.writeFile('.cept/spaces/other/space.cept.yaml', enc('name: Other\n'));
}

describe('clearAllData', () => {
  it('clears every root entry but .cept/ in the browser store', async () => {
    const backend = new MemoryBackend();
    await seed(backend);

    await clearAllData(backend);

    expect(await backend.exists('Mine.md')).toBe(false);
    expect(await backend.exists('Notes')).toBe(false);
    expect(await backend.exists('space.cept.yaml')).toBe(false);
    expect(await backend.exists('.cept/workspace-state.json')).toBe(false);
    expect(await backend.exists('.cept/spaces/other/space.cept.yaml')).toBe(true);
  });

  it("keeps the user's own files in a folder on disk", async () => {
    const backend = new MemoryBackend();
    Object.defineProperty(backend, 'type', { value: 'local' });
    await seed(backend);

    await clearAllData(backend);

    expect(await backend.exists('Mine.md')).toBe(true);
    expect(await backend.exists('Notes/Idea.md')).toBe(true);
    expect(await backend.exists('.cept/workspace-state.json')).toBe(false);
  });
});
