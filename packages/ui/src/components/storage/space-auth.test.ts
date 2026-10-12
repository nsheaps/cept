import { describe, expect, it } from 'vitest';
import type { GitAuthRecord } from '@cept/core';
import { resolveSpaceAuth } from './space-auth.js';

const record = (id: string, over: Partial<GitAuthRecord> = {}): GitAuthRecord => ({
  id,
  host: 'github.com',
  username: 'x-access-token',
  label: id,
  status: 'ok',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('resolveSpaceAuth', () => {
  it('uses the auth the space is bound to', () => {
    const a = record('a');
    const b = record('b');
    expect(resolveSpaceAuth({ authId: 'b' }, [a, b])).toEqual({ kind: 'auth', auth: b });
  });

  it('falls back to the first working GitHub auth for a space with none chosen', () => {
    const rejected = record('a', { status: 'rejected' });
    const b = record('b');
    expect(resolveSpaceAuth({}, [rejected, b])).toEqual({ kind: 'auth', auth: b });
  });

  it('reports no auth when none is chosen and none works', () => {
    expect(resolveSpaceAuth({}, [])).toEqual({ kind: 'none' });
    expect(resolveSpaceAuth({}, [record('a', { host: 'git.example.com' })])).toEqual({
      kind: 'none',
    });
  });

  it('reports a removed auth instead of silently using another account', () => {
    expect(resolveSpaceAuth({ authId: 'gone' }, [record('b')])).toEqual({
      kind: 'lost',
      authId: 'gone',
      reason: 'removed',
    });
  });

  it('reports a rejected auth instead of silently using another account', () => {
    expect(
      resolveSpaceAuth({ authId: 'a' }, [record('a', { status: 'rejected' }), record('b')]),
    ).toEqual({ kind: 'lost', authId: 'a', reason: 'rejected' });
  });

  it('keeps an unchecked auth (a host Cept cannot verify) usable', () => {
    const a = record('a', { host: 'git.example.com', status: 'unchecked' });
    expect(resolveSpaceAuth({ authId: 'a' }, [a])).toEqual({ kind: 'auth', auth: a });
  });
});
