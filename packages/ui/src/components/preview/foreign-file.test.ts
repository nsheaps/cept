import { describe, expect, it } from 'vitest';
import { TEXT_PREVIEW_LIMIT, mimeTypeOf, previewKind, previewText } from './foreign-file.js';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('previewKind', () => {
  it('previews images and PDFs by extension, any case', () => {
    expect(previewKind('logo.PNG', bytes('x'))).toBe('image');
    expect(previewKind('a.svg', bytes('<svg/>'))).toBe('image');
    expect(previewKind('paper.pdf', bytes('%PDF'))).toBe('pdf');
  });

  it('previews known text extensions and extensionless text', () => {
    expect(previewKind('data.json', bytes('{}'))).toBe('text');
    expect(previewKind('LICENSE', bytes('MIT'))).toBe('text');
  });

  it('offers a download for binaries and unknown types', () => {
    expect(previewKind('archive.zip', bytes('PK'))).toBe('download');
    expect(previewKind('blob', new Uint8Array([1, 0, 2]))).toBe('download');
    expect(previewKind('empty', new Uint8Array())).toBe('download');
  });
});

describe('mimeTypeOf and previewText', () => {
  it('maps kinds to media types', () => {
    expect(mimeTypeOf('a.png', 'image')).toBe('image/png');
    expect(mimeTypeOf('a.pdf', 'pdf')).toBe('application/pdf');
    expect(mimeTypeOf('a.zip', 'download')).toBe('application/octet-stream');
  });

  it('cuts long text at the limit', () => {
    const long = new Uint8Array(TEXT_PREVIEW_LIMIT + 10).fill(97);
    const result = previewText(long);
    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(TEXT_PREVIEW_LIMIT);
    expect(previewText(bytes('hi'))).toEqual({ text: 'hi', truncated: false });
  });
});
