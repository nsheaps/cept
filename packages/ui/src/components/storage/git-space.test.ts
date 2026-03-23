import { describe, it, expect } from 'vitest';
import { normalizeRepoUrl, parseCeptYaml, extractFrontMatter } from './git-space.js';

describe('normalizeRepoUrl', () => {
  it('should add https:// to bare domain', () => {
    expect(normalizeRepoUrl('github.com/user/repo')).toBe('https://github.com/user/repo');
  });

  it('should leave https:// URLs unchanged', () => {
    expect(normalizeRepoUrl('https://github.com/user/repo')).toBe('https://github.com/user/repo');
  });

  it('should leave http:// URLs unchanged', () => {
    expect(normalizeRepoUrl('http://github.com/user/repo')).toBe('http://github.com/user/repo');
  });

  it('should strip trailing .git', () => {
    expect(normalizeRepoUrl('https://github.com/user/repo.git')).toBe('https://github.com/user/repo');
  });

  it('should trim whitespace', () => {
    expect(normalizeRepoUrl('  github.com/user/repo  ')).toBe('https://github.com/user/repo');
  });
});

describe('parseCeptYaml', () => {
  it('parses inline hide array', () => {
    const config = parseCeptYaml('hide: [specs, tests]');
    expect(config.hide).toEqual(['specs', 'tests']);
  });

  it('parses block hide list', () => {
    const config = parseCeptYaml('hide:\n  - specs\n  - tests\n  - .github');
    expect(config.hide).toEqual(['specs', 'tests', '.github']);
  });

  it('returns empty config for empty content', () => {
    const config = parseCeptYaml('');
    expect(config.hide).toBeUndefined();
  });

  it('handles quoted values', () => {
    const config = parseCeptYaml("hide: ['specs/', \"tests/\"]");
    expect(config.hide).toEqual(['specs/', 'tests/']);
  });

  it('stops reading list at next key', () => {
    const config = parseCeptYaml('hide:\n  - specs\nother: value');
    expect(config.hide).toEqual(['specs']);
  });
});

describe('extractFrontMatter', () => {
  it('extracts key-value pairs from front matter', () => {
    const result = extractFrontMatter('---\ntitle: My Page\nauthor: Test\n---\n# Content');
    expect(result).toEqual({ title: 'My Page', author: 'Test' });
  });

  it('returns null when no front matter', () => {
    expect(extractFrontMatter('# Just a heading\n\nSome content')).toBeNull();
  });

  it('strips quotes from values', () => {
    const result = extractFrontMatter("---\ntitle: 'Quoted Title'\n---\n");
    expect(result).toEqual({ title: 'Quoted Title' });
  });

  it('handles empty front matter', () => {
    const result = extractFrontMatter('---\n\n---\n# Content');
    expect(result).toEqual({});
  });
});
