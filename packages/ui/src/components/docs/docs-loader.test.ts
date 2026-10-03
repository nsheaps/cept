import { describe, it, expect } from 'vitest';
import { DOCS_SPACE_ID, DOCS_DISPLAY_NAME, DOCS_REPO_URL, DOCS_BRANCH, DOCS_SUB_PATH } from './docs-loader.js';

describe('DOCS_SPACE_ID', () => {
  it('is a deterministic remote space ID for the docs repo', () => {
    // Should follow the format: repo@branch::subPath
    expect(DOCS_SPACE_ID).toContain('github.com/nsheaps/cept');
    expect(DOCS_SPACE_ID).toContain('@main');
    expect(DOCS_SPACE_ID).toContain('docs/content');
  });

  it('includes all required components', () => {
    expect(DOCS_SPACE_ID).toMatch(/^github\.com\/nsheaps\/cept@main::docs\/content$/);
  });
});

describe('docs constants', () => {
  it('exports correct repo URL', () => {
    expect(DOCS_REPO_URL).toBe('github.com/nsheaps/cept');
  });

  it('exports correct branch', () => {
    expect(DOCS_BRANCH).toBe('main');
  });

  it('exports correct sub-path', () => {
    expect(DOCS_SUB_PATH).toBe('docs/content');
  });

  it('exports a display name', () => {
    expect(DOCS_DISPLAY_NAME).toBe('Cept Docs');
  });
});
