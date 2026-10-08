import { describe, expect, it } from 'vitest';
import { nxArgs } from './nx-targets';

describe('nxArgs', () => {
  it('runs every project when no base is set (main, local runs)', () => {
    expect(nxArgs(['test:unit'], {})).toEqual(['run-many', '-t', 'test:unit']);
  });

  it('runs only affected projects when NX_BASE is set (pull requests)', () => {
    expect(nxArgs(['lint', 'typecheck'], { NX_BASE: 'abc', NX_HEAD: 'def' })).toEqual([
      'affected',
      '-t',
      'lint',
      'typecheck',
      '--base=abc',
      '--head=def',
    ]);
  });

  it('compares against HEAD when NX_HEAD is unset', () => {
    expect(nxArgs(['build'], { NX_BASE: 'abc' })).toEqual([
      'affected',
      '-t',
      'build',
      '--base=abc',
      '--head=HEAD',
    ]);
  });

  it('ignores an empty NX_BASE', () => {
    expect(nxArgs(['build'], { NX_BASE: '' })).toEqual(['run-many', '-t', 'build']);
  });

  it('passes --projects through', () => {
    expect(nxArgs(['test', '--projects=@cept/e2e'], { NX_BASE: 'abc' })).toEqual([
      'affected',
      '-t',
      'test',
      '--projects=@cept/e2e',
      '--base=abc',
      '--head=HEAD',
    ]);
  });

  it('rejects a call with no target', () => {
    expect(() => nxArgs([], {})).toThrow(/target/);
  });
});
