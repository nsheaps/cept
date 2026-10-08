import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryBackend } from './test-helpers.js';
import { useSpaces } from './useSpaces.js';

describe('useSpaces', () => {
  it('starts on the default space with no manifest loaded', () => {
    const { result } = renderHook(() => useSpaces(new MemoryBackend()));
    expect(result.current.activeId).toBe('default');
    expect(result.current.manifest).toBeNull();
  });

  it('refresh loads the manifest into state', async () => {
    const backend = new MemoryBackend();
    const { result } = renderHook(() => useSpaces(backend));
    await act(async () => {
      await result.current.manager.create('Work');
      await result.current.refresh();
    });
    expect(result.current.manifest?.spaces.map((s) => s.name)).toEqual(['My Space', 'Work']);
  });

  it('keeps one manager per backend across renders', () => {
    const backend = new MemoryBackend();
    const { result, rerender } = renderHook(() => useSpaces(backend));
    const first = result.current.manager;
    rerender();
    expect(result.current.manager).toBe(first);
    expect(first.backend).toBe(backend);
  });
});
