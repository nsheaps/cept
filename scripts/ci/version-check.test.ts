import { describe, expect, it } from 'vitest';
import {
  bumpType,
  classifyReleaseVersion,
  formatGithubOutput,
  versionOutputs,
  type Runner,
} from './version-check';

const ok = (stdout: string) => ({ status: 0, stdout, stderr: '' });

describe('classifyReleaseVersion', () => {
  it('treats empty output with exit 0 as no release, not an error', () => {
    expect(classifyReleaseVersion(ok(''))).toEqual({ kind: 'none' });
    expect(classifyReleaseVersion(ok('\n'))).toEqual({ kind: 'none' });
  });

  it('returns the trimmed version on exit 0', () => {
    expect(classifyReleaseVersion(ok('0.8.0\n'))).toEqual({ kind: 'release', version: '0.8.0' });
  });

  it('treats a non-zero exit as an error carrying the output', () => {
    const r = classifyReleaseVersion({ status: 1, stdout: '', stderr: 'boom\n' });
    expect(r).toEqual({ kind: 'error', message: 'boom' });
    expect(classifyReleaseVersion({ status: 2, stdout: '', stderr: '' })).toEqual({
      kind: 'error',
      message: 'exit code 2',
    });
  });
});

describe('bumpType', () => {
  it('compares major, minor and patch', () => {
    expect(bumpType('0.7.39', '1.0.0')).toBe('major');
    expect(bumpType('0.7.39', '0.8.0')).toBe('minor');
    expect(bumpType('0.7.39', '0.7.40')).toBe('patch');
    expect(bumpType('0.7.39', '0.7.39')).toBe('none');
  });
});

describe('versionOutputs', () => {
  it('reports no release without an error when release-it prints nothing', () => {
    const run: Runner = () => ok('');
    expect(versionOutputs('0.7.39', run)).toEqual({
      current_version: '0.7.39',
      error: 'false',
      bump_type: 'none',
    });
  });

  it('reports the error message on a failing release-it', () => {
    const run: Runner = () => ({ status: 1, stdout: '', stderr: 'no tags' });
    const out = versionOutputs('0.7.39', run);
    expect(out.error).toBe('true');
    expect(out.error_message).toBe('no tags');
  });

  it('reports the next version, bump and changelog', () => {
    const run: Runner = (args) => (args.includes('--changelog') ? ok('- feat: x') : ok('0.8.0\n'));
    expect(versionOutputs('0.7.39', run)).toEqual({
      current_version: '0.7.39',
      error: 'false',
      next_version: '0.8.0',
      changelog: '- feat: x',
      bump_type: 'minor',
    });
  });
});

describe('formatGithubOutput', () => {
  it('writes each value as a delimited multiline output', () => {
    const text = formatGithubOutput({ a: 'x\ny' });
    expect(text).toMatch(/^a<<(EOF_[\w-]+)\nx\ny\n\1\n$/);
  });
});
