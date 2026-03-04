import { describe, it, expect } from 'vitest';
import {
  extractTags,
  convertObsidianLinks,
  extractObsidianTitle,
  importObsidianVault,
} from './obsidian-importer.js';
import type { VaultReader, VaultFile } from './obsidian-importer.js';

function createMockVaultReader(
  entries: Array<{ path: string; content: string | Uint8Array; isDirectory?: boolean }>,
): VaultReader {
  return {
    async listFiles(): Promise<VaultFile[]> {
      return entries.map((e) => ({
        path: e.path,
        isDirectory: e.isDirectory ?? false,
        async getData(): Promise<Uint8Array> {
          if (typeof e.content === 'string') {
            return new TextEncoder().encode(e.content);
          }
          return e.content;
        },
      }));
    },
  };
}

describe('extractTags', () => {
  it('extracts inline #tags', () => {
    const tags = extractTags('Some text #project and #todo here');
    expect(tags).toContain('project');
    expect(tags).toContain('todo');
  });

  it('extracts front matter tags (array format)', () => {
    const content = '---\ntags: [project, todo]\n---\nContent';
    const tags = extractTags(content);
    expect(tags).toContain('project');
    expect(tags).toContain('todo');
  });

  it('extracts front matter tags (list format)', () => {
    const content = '---\ntags:\n  - project\n  - todo\n---\nContent';
    const tags = extractTags(content);
    expect(tags).toContain('project');
    expect(tags).toContain('todo');
  });

  it('ignores tags inside code blocks', () => {
    const content = '```\n#not-a-tag\n```\n#real-tag';
    const tags = extractTags(content);
    expect(tags).toContain('real-tag');
    expect(tags).not.toContain('not-a-tag');
  });

  it('ignores tags inside inline code', () => {
    const content = 'Use `#heading` for titles #actual';
    const tags = extractTags(content);
    expect(tags).toContain('actual');
    expect(tags).not.toContain('heading');
  });

  it('handles nested tags with slashes', () => {
    const tags = extractTags('Text #project/subproject here');
    expect(tags).toContain('project/subproject');
  });

  it('deduplicates tags', () => {
    const tags = extractTags('#tag1 some text #tag1');
    expect(tags.filter((t) => t === 'tag1').length).toBe(1);
  });

  it('returns empty for no tags', () => {
    expect(extractTags('No tags here')).toEqual([]);
  });
});

describe('convertObsidianLinks', () => {
  it('converts simple wiki-links', () => {
    const pageMap = new Map([['My Page', '/pages/My Page.md']]);
    const result = convertObsidianLinks('See [[My Page]] for details', pageMap);
    expect(result).toContain('[[/pages/My Page.md|My Page]]');
  });

  it('converts links with display text', () => {
    const pageMap = new Map([['Page', '/pages/Page.md']]);
    const result = convertObsidianLinks('[[Page|custom text]]', pageMap);
    expect(result).toContain('[[/pages/Page.md|custom text]]');
  });

  it('converts links with heading anchors', () => {
    const pageMap = new Map([['Page', '/pages/Page.md']]);
    const result = convertObsidianLinks('[[Page#Section]]', pageMap);
    expect(result).toContain('[[/pages/Page.md#Section|Page]]');
  });

  it('preserves unresolvable links', () => {
    const result = convertObsidianLinks('[[Unknown Page]]', new Map());
    expect(result).toBe('[[Unknown Page]]');
  });

  it('matches case-insensitively', () => {
    const pageMap = new Map([['my page', '/pages/my page.md']]);
    const result = convertObsidianLinks('[[My Page]]', pageMap);
    expect(result).toContain('/pages/my page.md');
  });
});

describe('extractObsidianTitle', () => {
  it('extracts from front matter title', () => {
    const content = '---\ntitle: My Title\n---\n# Other';
    expect(extractObsidianTitle(content, 'file.md')).toBe('My Title');
  });

  it('falls back to first H1', () => {
    const content = '# My Heading\nSome content';
    expect(extractObsidianTitle(content, 'file.md')).toBe('My Heading');
  });

  it('falls back to filename', () => {
    const content = 'Just content, no heading';
    expect(extractObsidianTitle(content, 'My Note.md')).toBe('My Note');
  });

  it('strips quotes from front matter title', () => {
    const content = '---\ntitle: "Quoted Title"\n---\n';
    expect(extractObsidianTitle(content, 'file.md')).toBe('Quoted Title');
  });
});

describe('importObsidianVault', () => {
  it('imports markdown pages', async () => {
    const reader = createMockVaultReader([
      { path: 'notes/page.md', content: '# My Page\n\nContent here' },
    ]);

    const result = await importObsidianVault(reader);
    expect(result.pages.length).toBe(1);
    expect(result.pages[0].title).toBe('My Page');
    expect(result.pages[0].content).toContain('Content here');
  });

  it('imports attachments', async () => {
    const reader = createMockVaultReader([
      { path: 'attachments/image.png', content: new Uint8Array([137, 80]) },
    ]);

    const result = await importObsidianVault(reader);
    expect(result.assets.length).toBe(1);
    expect(result.assets[0].mimeType).toBe('image/png');
  });

  it('ignores .obsidian directory', async () => {
    const reader = createMockVaultReader([
      { path: '.obsidian/config.json', content: '{}' },
      { path: 'note.md', content: '# Note' },
    ]);

    const result = await importObsidianVault(reader);
    expect(result.pages.length).toBe(1);
    expect(result.pages.some((p) => p.sourcePath.includes('.obsidian'))).toBe(false);
  });

  it('ignores .trash directory', async () => {
    const reader = createMockVaultReader([
      { path: '.trash/deleted.md', content: 'old' },
      { path: 'note.md', content: '# Note' },
    ]);

    const result = await importObsidianVault(reader);
    expect(result.pages.length).toBe(1);
  });

  it('collects tags from all pages', async () => {
    const reader = createMockVaultReader([
      { path: 'a.md', content: '#tag1 content' },
      { path: 'b.md', content: '#tag2 more' },
    ]);

    const result = await importObsidianVault(reader);
    expect(result.tags).toContain('tag1');
    expect(result.tags).toContain('tag2');
  });

  it('converts wiki-links when enabled', async () => {
    const reader = createMockVaultReader([
      { path: 'a.md', content: 'See [[b]]' },
      { path: 'b.md', content: '# B' },
    ]);

    const result = await importObsidianVault(reader, { convertLinks: true });
    expect(result.pages[0].content).toContain('[[');
    expect(result.pages[0].content).toContain('/b.md');
  });

  it('does not convert links when disabled', async () => {
    const reader = createMockVaultReader([
      { path: 'a.md', content: 'See [[b]]' },
    ]);

    const result = await importObsidianVault(reader, { convertLinks: false });
    expect(result.pages[0].content).toBe('See [[b]]');
  });

  it('skips files exceeding max size', async () => {
    const reader = createMockVaultReader([
      { path: 'huge.md', content: 'x'.repeat(100) },
    ]);

    const result = await importObsidianVault(reader, { maxFileSize: 10 });
    expect(result.pages.length).toBe(0);
    expect(result.skippedFiles).toBe(1);
  });

  it('skips attachments when disabled', async () => {
    const reader = createMockVaultReader([
      { path: 'image.png', content: new Uint8Array([1]) },
    ]);

    const result = await importObsidianVault(reader, { importAttachments: false });
    expect(result.assets.length).toBe(0);
    expect(result.skippedFiles).toBe(1);
  });

  it('uses custom target path', async () => {
    const reader = createMockVaultReader([
      { path: 'note.md', content: '# Note' },
    ]);

    const result = await importObsidianVault(reader, { targetPath: '/imported/obsidian' });
    expect(result.pages[0].targetPath).toContain('/imported/obsidian');
  });

  it('calls progress callback', async () => {
    const reader = createMockVaultReader([
      { path: 'a.md', content: '# A' },
      { path: 'b.md', content: '# B' },
    ]);

    const progress: number[] = [];
    await importObsidianVault(reader, undefined, (p) => progress.push(p.percent));
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBe(100);
  });

  it('handles vault read errors', async () => {
    const reader: VaultReader = {
      async listFiles() { throw new Error('access denied'); },
    };

    const result = await importObsidianVault(reader);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain('access denied');
  });

  it('handles file read errors gracefully', async () => {
    const reader: VaultReader = {
      async listFiles() {
        return [{
          path: 'broken.md',
          isDirectory: false,
          async getData(): Promise<Uint8Array> { throw new Error('corrupt'); },
        }];
      },
    };

    const result = await importObsidianVault(reader);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain('corrupt');
  });

  it('skips directories', async () => {
    const reader = createMockVaultReader([
      { path: 'folder/', content: '', isDirectory: true },
      { path: 'folder/note.md', content: '# Note' },
    ]);

    const result = await importObsidianVault(reader);
    expect(result.pages.length).toBe(1);
  });

  it('custom ignore paths', async () => {
    const reader = createMockVaultReader([
      { path: 'templates/template.md', content: '# Template' },
      { path: 'note.md', content: '# Note' },
    ]);

    const result = await importObsidianVault(reader, {
      ignorePaths: ['.obsidian', '.trash', 'templates'],
    });
    expect(result.pages.length).toBe(1);
    expect(result.pages[0].sourcePath).toBe('note.md');
  });
});
