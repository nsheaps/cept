import { describe, it, expect } from 'vitest';
import { MemoryBackend } from './memory.js';
import { ScopedBackend } from './scoped.js';
import type { FsEvent } from './backend.js';

const enc = (text: string) => new TextEncoder().encode(text);
const dec = (data: Uint8Array | null) => (data ? new TextDecoder().decode(data) : null);

describe('ScopedBackend', () => {
  it('stores files under its prefix in the base backend', async () => {
    const base = new MemoryBackend();
    const scoped = new ScopedBackend(base, '/.cept/spaces/s1/');
    await scoped.writeFile('/pages/a.md', enc('A'));
    expect(dec(await base.readFile('.cept/spaces/s1/pages/a.md'))).toBe('A');
    expect(dec(await scoped.readFile('pages/a.md'))).toBe('A');
    expect(scoped.prefix).toBe('.cept/spaces/s1');
  });

  it('cannot see or change files outside its prefix', async () => {
    const base = new MemoryBackend();
    await base.writeFile('pages/a.md', enc('root'));
    const scoped = new ScopedBackend(base, '.cept/spaces/s1');
    expect(await scoped.readFile('pages/a.md')).toBeNull();
    expect(await scoped.readFile('../../../pages/a.md')).toBeNull();
    await scoped.deleteFile('pages');
    expect(dec(await base.readFile('pages/a.md'))).toBe('root');
  });

  it('reports watch events with scope-relative paths', async () => {
    const base = new MemoryBackend();
    const scoped = new ScopedBackend(base, 'space');
    const events: FsEvent[] = [];
    const stop = scoped.watch('pages', (e) => events.push(e));
    await scoped.writeFile('pages/a.md', enc('A'));
    await base.writeFile('elsewhere/pages/b.md', enc('B'));
    stop();
    expect(events.map((e) => e.path.replace(/^\/+/, ''))).toEqual(['pages/a.md']);
  });

  it('takes its type and capabilities from the base backend', () => {
    const base = new MemoryBackend();
    const scoped = new ScopedBackend(base, 'x');
    expect(scoped.type).toBe(base.type);
    expect(scoped.capabilities).toBe(base.capabilities);
  });

  it('refuses an empty prefix', () => {
    expect(() => new ScopedBackend(new MemoryBackend(), '/')).toThrow(/prefix/);
  });
});
