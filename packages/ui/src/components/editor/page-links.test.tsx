import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryBackend } from '@cept/core';
import { CeptEditor } from './CeptEditor.js';
import type { PageLinksContext } from './page-links.js';
import { imageMimeType, isRelativeUrl } from './page-links.js';

const encode = (text: string) => new TextEncoder().encode(text);

async function spaceWith(files: Record<string, string>): Promise<MemoryBackend> {
  const backend = new MemoryBackend();
  for (const [path, text] of Object.entries(files)) await backend.writeFile(path, encode(text));
  return backend;
}

function contextFor(
  backend: MemoryBackend,
  pageId: string,
  pages: string[],
  onNavigate = vi.fn(),
): PageLinksContext {
  return {
    pageId,
    hasPage: (id) => pages.includes(id),
    readFile: (path) => backend.readFile(`/${path}`),
    onNavigate,
  };
}

describe('relative links in a page', () => {
  it('navigates to a linked page when the page is read-only', async () => {
    const backend = await spaceWith({});
    const onNavigate = vi.fn();
    render(
      <CeptEditor
        editable={false}
        content="[Setup](../guides/setup.md#install)"
        links={contextFor(backend, 'notes/today.md', ['guides/setup.md'], onNavigate)}
      />,
    );
    const link = await screen.findByText('Setup');
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith('guides/setup.md', 'install');
  });

  it('opens a folder page from a link to its folder or its README', async () => {
    const backend = await spaceWith({});
    const onNavigate = vi.fn();
    render(
      <CeptEditor
        editable={false}
        content={'[Folder](guides/) [Readme](guides/README.md)'}
        links={contextFor(backend, 'home.md', ['home.md', 'guides'], onNavigate)}
      />,
    );
    fireEvent.click(await screen.findByText('Folder'));
    fireEvent.click(screen.getByText('Readme'));
    expect(onNavigate).toHaveBeenNthCalledWith(1, 'guides', undefined);
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'guides', undefined);
  });

  it('resolves links of a folder page against its folder', async () => {
    const backend = await spaceWith({});
    const onNavigate = vi.fn();
    render(
      <CeptEditor
        editable={false}
        content="[Sibling](other.md)"
        links={contextFor(backend, 'guides', ['guides', 'guides/other.md'], onNavigate)}
      />,
    );
    fireEvent.click(await screen.findByText('Sibling'));
    expect(onNavigate).toHaveBeenCalledWith('guides/other.md', undefined);
  });

  it('keeps plain clicks for the caret in an editable page, and follows Ctrl-click', async () => {
    const backend = await spaceWith({});
    const onNavigate = vi.fn();
    render(
      <CeptEditor
        content="[Setup](setup.md)"
        links={contextFor(backend, 'home.md', ['setup.md'], onNavigate)}
      />,
    );
    const link = await screen.findByText('Setup');
    fireEvent.click(link);
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.click(link, { ctrlKey: true });
    expect(onNavigate).toHaveBeenCalledWith('setup.md', undefined);
  });

  it('leaves external links alone', async () => {
    const backend = await spaceWith({});
    const onNavigate = vi.fn();
    render(
      <CeptEditor
        editable={false}
        content="[Site](https://example.com/a.md)"
        links={contextFor(backend, 'home.md', [], onNavigate)}
      />,
    );
    const notPrevented = fireEvent.click(await screen.findByText('Site'));
    expect(notPrevented).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('marks a link to a missing page as broken and does not navigate', async () => {
    const backend = await spaceWith({});
    const onNavigate = vi.fn();
    render(
      <CeptEditor
        editable={false}
        content="[Gone](gone.md) [Here](here.md)"
        links={contextFor(backend, 'home.md', ['here.md'], onNavigate)}
      />,
    );
    const gone = await screen.findByText('Gone');
    await waitFor(() => expect(gone.getAttribute('data-broken')).toBe('true'));
    expect(screen.getByText('Here').getAttribute('data-broken')).toBeNull();
    const notPrevented = fireEvent.click(gone);
    expect(notPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('scrolls to a heading of the same page for an #anchor link', async () => {
    const backend = await spaceWith({});
    const onNavigate = vi.fn();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <CeptEditor
        editable={false}
        content={'[Down](#second-part)\n\n# First part\n\n# Second part\n'}
        links={contextFor(backend, 'home.md', ['home.md'], onNavigate)}
      />,
    );
    fireEvent.click(await screen.findByText('Down'));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('scrolls to the anchor it is opened with', async () => {
    const backend = await spaceWith({});
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <CeptEditor
        editable={false}
        anchor="install"
        content={'# Intro\n\n# Install\n'}
        links={contextFor(backend, 'home.md', ['home.md'])}
      />,
    );
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });
});

describe('relative images in a page', () => {
  const created: string[] = [];
  const revoked: string[] = [];
  beforeEach(() => {
    created.length = 0;
    revoked.length = 0;
    let n = 0;
    URL.createObjectURL = vi.fn(() => {
      const url = `blob:mock/${++n}`;
      created.push(url);
      return url;
    });
    URL.revokeObjectURL = vi.fn((url: string) => {
      revoked.push(url);
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('loads an image through the backend and revokes its blob URL on unmount', async () => {
    const backend = await spaceWith({ 'notes/img/pic.png': 'PNG' });
    const { unmount } = render(
      <CeptEditor
        editable={false}
        content="![A picture](img/pic.png)"
        links={contextFor(backend, 'notes/today.md', ['notes/today.md'])}
      />,
    );
    const img = await screen.findByAltText('A picture');
    await waitFor(() => expect(img.getAttribute('src')).toBe('blob:mock/1'));
    unmount();
    expect(revoked).toEqual(['blob:mock/1']);
  });

  it('marks an image that is not in the space as broken', async () => {
    const backend = await spaceWith({});
    render(
      <CeptEditor
        editable={false}
        content="![Missing](nope.png)"
        links={contextFor(backend, 'home.md', ['home.md'])}
      />,
    );
    const img = await screen.findByAltText('Missing');
    await waitFor(() => expect(img.getAttribute('data-broken')).toBe('true'));
    expect(created).toEqual([]);
  });

  it('leaves external and data images alone', async () => {
    const backend = await spaceWith({});
    const readFile = vi.spyOn(backend, 'readFile');
    render(
      <CeptEditor
        editable={false}
        content="![Remote](https://example.com/a.png)"
        links={contextFor(backend, 'home.md', ['home.md'])}
      />,
    );
    const img = await screen.findByAltText('Remote');
    expect(img.getAttribute('src')).toBe('https://example.com/a.png');
    expect(readFile).not.toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('names the media type of an image by its extension', () => {
    expect(imageMimeType('a/b.PNG')).toBe('image/png');
    expect(imageMimeType('x.svg')).toBe('image/svg+xml');
    expect(imageMimeType('x.bin')).toBe('application/octet-stream');
  });

  it('tells relative URLs from absolute ones', () => {
    expect(isRelativeUrl('a/b.md')).toBe(true);
    expect(isRelativeUrl('/a/b.md')).toBe(true);
    expect(isRelativeUrl('#x')).toBe(true);
    expect(isRelativeUrl('https://x.test')).toBe(false);
    expect(isRelativeUrl('blob:abc')).toBe(false);
    expect(isRelativeUrl('//cdn.test/a')).toBe(false);
    expect(isRelativeUrl('')).toBe(false);
  });
});
