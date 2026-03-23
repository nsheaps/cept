import { describe, it, expect, vi } from 'vitest';
import { getRemoteDocsSourceUrl } from './docs-loader.js';

// Mock the docs-content module to avoid importing the full bundled content
vi.mock('./docs-content.js', () => ({
  DOCS_PAGES: [{ id: 'docs-index', title: 'Test', children: [] }],
  DOCS_CONTENT: { 'docs-index': '# Test' },
  resolveDocsContent: (c: string) => c.replace(/\{\{base\}\}/g, '/'),
  getDocsSourceUrl: (id: string) => {
    const paths: Record<string, string> = {
      'docs-index': 'docs/content/index.md',
      'docs-introduction': 'docs/content/getting-started/introduction.md',
    };
    return paths[id] ? `https://github.com/nsheaps/cept/blob/main/${paths[id]}` : undefined;
  },
}));

describe('getRemoteDocsSourceUrl', () => {
  it('returns GitHub URL for bundled page IDs using source path lookup', () => {
    const url = getRemoteDocsSourceUrl('docs-index', 'bundled');
    expect(url).toBe('https://github.com/nsheaps/cept/blob/main/docs/content/index.md');
  });

  it('returns undefined for unknown bundled page IDs', () => {
    const url = getRemoteDocsSourceUrl('unknown-page', 'bundled');
    expect(url).toBeUndefined();
  });

  it('returns GitHub URL for remote page IDs using file path', () => {
    const url = getRemoteDocsSourceUrl('getting-started/introduction.md', 'remote');
    expect(url).toBe('https://github.com/nsheaps/cept/blob/main/docs/content/getting-started/introduction.md');
  });

  it('returns GitHub URL for cached page IDs using file path', () => {
    const url = getRemoteDocsSourceUrl('reference/roadmap.md', 'cache');
    expect(url).toBe('https://github.com/nsheaps/cept/blob/main/docs/content/reference/roadmap.md');
  });

  it('uses custom branch when provided', () => {
    const url = getRemoteDocsSourceUrl('index.md', 'remote', 'develop');
    expect(url).toBe('https://github.com/nsheaps/cept/blob/develop/docs/content/index.md');
  });
});

describe('loadDocs', () => {
  it('returns bundled content when backend is null', async () => {
    // Dynamic import to get loadDocs after mocks are set up
    const { loadDocs } = await import('./docs-loader.js');
    const result = await loadDocs(null);
    expect(result.source).toBe('bundled');
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].id).toBe('docs-index');
    expect(result.pageContents['docs-index']).toBe('# Test');
  });
});
