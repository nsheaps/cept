import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryBackend } from '@cept/core';
import { ForeignFilePreview } from './ForeignFilePreview.js';

const enc = (text: string) => new TextEncoder().encode(text);

describe('ForeignFilePreview', () => {
  const revoked: string[] = [];
  let backend: MemoryBackend;
  const readFile = (path: string) => backend.readFile(`/${path}`);

  beforeEach(async () => {
    revoked.length = 0;
    let n = 0;
    URL.createObjectURL = vi.fn(() => `blob:mock/${++n}`);
    URL.revokeObjectURL = vi.fn((url: string) => {
      revoked.push(url);
    });
    backend = new MemoryBackend();
    await backend.writeFile('/img/pic.png', enc('PNG'));
    await backend.writeFile('/docs/paper.pdf', enc('%PDF'));
    await backend.writeFile('/notes.json', enc('{"a":1}'));
    await backend.writeFile('/data.zip', enc('PK'));
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows an image from a blob URL and revokes it on close', async () => {
    const { unmount } = render(<ForeignFilePreview path="img/pic.png" readFile={readFile} />);
    const img = await screen.findByAltText('pic.png');
    expect(img.getAttribute('src')).toBe('blob:mock/1');
    unmount();
    expect(revoked).toEqual(['blob:mock/1']);
  });

  it('embeds a PDF', async () => {
    const { container } = render(<ForeignFilePreview path="docs/paper.pdf" readFile={readFile} />);
    await waitFor(() =>
      expect(container.querySelector('object')?.getAttribute('data')).toBe('blob:mock/1'),
    );
  });

  it('shows plain text', async () => {
    render(<ForeignFilePreview path="notes.json" readFile={readFile} />);
    expect((await screen.findByTestId('foreign-file-text')).textContent).toBe('{"a":1}');
  });

  it('offers only a download for other files, named after the file', async () => {
    const { container } = render(<ForeignFilePreview path="data.zip" readFile={readFile} />);
    const link = await screen.findByTestId('foreign-file-download');
    expect(link.getAttribute('download')).toBe('data.zip');
    expect(container.querySelector('img, object, pre')).toBeNull();
  });

  it('says so when the file is missing', async () => {
    render(<ForeignFilePreview path="gone.png" readFile={readFile} />);
    expect(await screen.findByTestId('foreign-file-missing')).toBeDefined();
  });

  it('never writes to the space', async () => {
    const write = vi.spyOn(backend, 'writeFile');
    const remove = vi.spyOn(backend, 'deleteFile');
    render(<ForeignFilePreview path="img/pic.png" readFile={readFile} />);
    await screen.findByAltText('pic.png');
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
