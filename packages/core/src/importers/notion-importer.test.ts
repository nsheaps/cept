import { describe, it, expect, vi } from 'vitest';
import {
  cleanNotionFilename,
  convertNotionLinks,
  extractTitle,
  getMimeType,
  importNotionZip,
} from './notion-importer.js';
import type { ZipReader, ZipEntry } from './notion-importer.js';

function createMockZipReader(entries: Array<{ path: string; content: string | Uint8Array; isDirectory?: boolean }>): ZipReader {
  return {
    async getEntries(): Promise<ZipEntry[]> {
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
    close: vi.fn(async () => {}),
  };
}

describe('cleanNotionFilename', () => {
  it('removes Notion UUID suffix', () => {
    expect(cleanNotionFilename('My Page a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.md'))
      .toBe('My Page.md');
  });

  it('preserves filenames without UUID', () => {
    expect(cleanNotionFilename('Normal Page.md')).toBe('Normal Page.md');
  });

  it('handles nested paths', () => {
    expect(cleanNotionFilename('folder/Page Name 0123456789abcdef0123456789abcdef.md'))
      .toBe('folder/Page Name.md');
  });

  it('handles files without extension', () => {
    expect(cleanNotionFilename('README')).toBe('README');
  });
});

describe('convertNotionLinks', () => {
  it('converts internal links to wiki-links', () => {
    const pathMap = new Map([['Other Page abc123.md', '/pages/Other Page.md']]);
    const content = '[Click here](Other%20Page%20abc123.md)';
    const result = convertNotionLinks(content, pathMap);
    expect(result).toBe('[[/pages/Other Page.md|Click here]]');
  });

  it('preserves external links', () => {
    const content = '[GitHub](https://github.com)';
    const result = convertNotionLinks(content, new Map());
    expect(result).toBe('[GitHub](https://github.com)');
  });

  it('preserves links that cannot be resolved', () => {
    const content = '[Missing](unknown.md)';
    const result = convertNotionLinks(content, new Map());
    expect(result).toBe('[Missing](unknown.md)');
  });

  it('matches by cleaned filename when exact match fails', () => {
    const pathMap = new Map([
      ['My Page a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.md', '/pages/My Page.md'],
    ]);
    const content = '[link](My%20Page%20a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.md)';
    const result = convertNotionLinks(content, pathMap);
    expect(result).toBe('[[/pages/My Page.md|link]]');
  });
});

describe('extractTitle', () => {
  it('extracts title from H1 heading', () => {
    const content = '# My Page\n\nSome content';
    expect(extractTitle(content, 'something.md')).toBe('My Page');
  });

  it('falls back to filename when no H1', () => {
    const content = 'Just some text';
    expect(extractTitle(content, 'My Page.md')).toBe('My Page');
  });

  it('cleans Notion UUID from filename fallback', () => {
    const content = 'No heading';
    expect(extractTitle(content, 'Note a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.md')).toBe('Note');
  });
});

describe('getMimeType', () => {
  it('returns correct MIME types', () => {
    expect(getMimeType('image.png')).toBe('image/png');
    expect(getMimeType('photo.jpg')).toBe('image/jpeg');
    expect(getMimeType('doc.pdf')).toBe('application/pdf');
    expect(getMimeType('data.csv')).toBe('text/csv');
  });

  it('returns octet-stream for unknown types', () => {
    expect(getMimeType('file.xyz')).toBe('application/octet-stream');
  });
});

describe('importNotionZip', () => {
  it('imports markdown pages', async () => {
    const reader = createMockZipReader([
      { path: 'My Page a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.md', content: '# My Page\n\nHello world' },
    ]);

    const result = await importNotionZip(reader);
    expect(result.pages.length).toBe(1);
    expect(result.pages[0].title).toBe('My Page');
    expect(result.pages[0].content).toContain('Hello world');
    expect(result.errors.length).toBe(0);
  });

  it('imports assets', async () => {
    const imageData = new Uint8Array([137, 80, 78, 71]); // PNG header
    const reader = createMockZipReader([
      { path: 'images/photo.png', content: imageData },
    ]);

    const result = await importNotionZip(reader);
    expect(result.assets.length).toBe(1);
    expect(result.assets[0].mimeType).toBe('image/png');
    expect(result.assets[0].size).toBe(4);
  });

  it('imports CSV files as database pages', async () => {
    const reader = createMockZipReader([
      { path: 'Tasks a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.csv', content: 'Name,Status\nDo thing,Done' },
    ]);

    const result = await importNotionZip(reader);
    expect(result.pages.length).toBe(1);
    expect(result.pages[0].isDatabase).toBe(true);
  });

  it('skips directories', async () => {
    const reader = createMockZipReader([
      { path: 'folder/', content: '', isDirectory: true },
      { path: 'folder/page.md', content: '# Page' },
    ]);

    const result = await importNotionZip(reader);
    expect(result.pages.length).toBe(1);
    expect(result.totalFiles).toBe(1);
  });

  it('skips files exceeding max size', async () => {
    const reader = createMockZipReader([
      { path: 'huge.md', content: 'x'.repeat(100) },
    ]);

    const result = await importNotionZip(reader, { maxFileSize: 10 });
    expect(result.pages.length).toBe(0);
    expect(result.skippedFiles).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain('exceeds maximum size');
  });

  it('skips databases when importDatabases is false', async () => {
    const reader = createMockZipReader([
      { path: 'data.csv', content: 'col1,col2' },
    ]);

    const result = await importNotionZip(reader, { importDatabases: false });
    expect(result.pages.length).toBe(0);
    expect(result.skippedFiles).toBe(1);
  });

  it('skips images when importImages is false', async () => {
    const reader = createMockZipReader([
      { path: 'photo.png', content: new Uint8Array([1, 2, 3]) },
    ]);

    const result = await importNotionZip(reader, { importImages: false });
    expect(result.assets.length).toBe(0);
    expect(result.skippedFiles).toBe(1);
  });

  it('calls progress callback', async () => {
    const reader = createMockZipReader([
      { path: 'a.md', content: '# A' },
      { path: 'b.md', content: '# B' },
    ]);

    const progress: Array<{ percent: number }> = [];
    await importNotionZip(reader, undefined, (p) => progress.push({ percent: p.percent }));

    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1].percent).toBe(100);
  });

  it('converts Notion links when enabled', async () => {
    const reader = createMockZipReader([
      { path: 'Page A a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.md', content: '# A\n\n[link](Page%20B%20d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9.md)' },
      { path: 'Page B d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9.md', content: '# B' },
    ]);

    const result = await importNotionZip(reader, { convertLinks: true });
    expect(result.pages[0].content).toContain('[[');
  });

  it('does not convert links when disabled', async () => {
    const reader = createMockZipReader([
      { path: 'Page A.md', content: '[link](Other.md)' },
    ]);

    const result = await importNotionZip(reader, { convertLinks: false });
    expect(result.pages[0].content).toBe('[link](Other.md)');
  });

  it('handles ZIP read errors gracefully', async () => {
    const reader: ZipReader = {
      async getEntries() { throw new Error('corrupted zip'); },
      async close() {},
    };

    const result = await importNotionZip(reader);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain('corrupted zip');
  });

  it('closes the zip reader', async () => {
    const reader = createMockZipReader([]);
    await importNotionZip(reader);
    expect(reader.close).toHaveBeenCalled();
  });

  it('uses custom target path', async () => {
    const reader = createMockZipReader([
      { path: 'page.md', content: '# Page' },
    ]);

    const result = await importNotionZip(reader, { targetPath: '/imported/notion' });
    expect(result.pages[0].targetPath).toContain('/imported/notion');
  });

  it('handles file processing errors', async () => {
    const reader: ZipReader = {
      async getEntries() {
        return [{
          path: 'broken.md',
          isDirectory: false,
          async getData(): Promise<Uint8Array> { throw new Error('read error'); },
        }];
      },
      async close() {},
    };

    const result = await importNotionZip(reader);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain('read error');
  });
});
