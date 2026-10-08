import { describe, it, expect } from 'vitest';
import { MemoryBackend } from './memory.js';

const enc = (text: string) => new TextEncoder().encode(text);

describe('MemoryBackend path kinds', () => {
  it('rejects writing a file over an implicit directory', async () => {
    const backend = new MemoryBackend();
    await backend.writeFile('/foo/bar.txt', enc('x'));
    await expect(backend.writeFile('/foo', enc('y'))).rejects.toThrow(/EISDIR/);
    expect((await backend.stat('/foo'))?.isDirectory).toBe(true);
  });

  it('rejects writing a file under an existing file', async () => {
    const backend = new MemoryBackend();
    await backend.writeFile('/foo', enc('x'));
    await expect(backend.writeFile('/foo/bar.txt', enc('y'))).rejects.toThrow(/ENOTDIR/);
    expect(await backend.listDirectory('/foo')).toEqual([]);
  });
});
