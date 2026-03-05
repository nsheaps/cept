import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { CeptEditor } from './CeptEditor.js';

describe('Media Blocks', () => {
  describe('Image block', () => {
    it('renders an image with src and alt', async () => {
      const { container } = render(
        <CeptEditor
          content='<figure data-type="image" data-src="https://example.com/photo.jpg" data-alt="A photo" data-width="100%" data-caption=""><img src="https://example.com/photo.jpg" alt="A photo" style="width: 100%; max-width: 100%;" draggable="false"></figure>'
        />,
      );
      await waitFor(() => {
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        expect(img?.getAttribute('src')).toBe('https://example.com/photo.jpg');
        expect(img?.getAttribute('alt')).toBe('A photo');
      });
    });

    it('renders an image with caption', async () => {
      const { container } = render(
        <CeptEditor
          content='<figure data-type="image" data-src="https://example.com/photo.jpg" data-alt="" data-width="100%" data-caption="My caption"><img src="https://example.com/photo.jpg" alt="" style="width: 100%; max-width: 100%;" draggable="false"><figcaption class="cept-image-caption">My caption</figcaption></figure>'
        />,
      );
      await waitFor(() => {
        const figcaption = container.querySelector('figcaption');
        expect(figcaption).not.toBeNull();
        expect(figcaption?.textContent).toBe('My caption');
      });
    });

    it('renders an image with custom width', async () => {
      const { container } = render(
        <CeptEditor
          content='<figure data-type="image" data-src="https://example.com/photo.jpg" data-alt="" data-width="50%" data-caption=""><img src="https://example.com/photo.jpg" alt="" style="width: 50%; max-width: 100%;" draggable="false"></figure>'
        />,
      );
      await waitFor(() => {
        const figure = container.querySelector('figure[data-type="image"]');
        expect(figure).not.toBeNull();
        expect(figure?.getAttribute('data-width')).toBe('50%');
      });
    });
  });

  describe('Embed block', () => {
    it('renders an embed with youtube provider', async () => {
      const { container } = render(
        <CeptEditor
          content='<figure data-type="embed" data-provider="youtube" data-src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" data-width="100%" data-height="400px"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="100%" height="400px" frameborder="0" allowfullscreen="true" loading="lazy" style="border: none; border-radius: 4px;"></iframe></figure>'
        />,
      );
      await waitFor(() => {
        const embed = container.querySelector('figure[data-type="embed"]');
        expect(embed).not.toBeNull();
        expect(embed?.getAttribute('data-provider')).toBe('youtube');
      });
    });

    it('renders an embed with vimeo provider', async () => {
      const { container } = render(
        <CeptEditor
          content='<figure data-type="embed" data-provider="vimeo" data-src="https://vimeo.com/123456" data-width="100%" data-height="400px"><iframe src="https://player.vimeo.com/video/123456" width="100%" height="400px" frameborder="0" allowfullscreen="true" loading="lazy" style="border: none; border-radius: 4px;"></iframe></figure>'
        />,
      );
      await waitFor(() => {
        const embed = container.querySelector('figure[data-type="embed"]');
        expect(embed).not.toBeNull();
        expect(embed?.getAttribute('data-provider')).toBe('vimeo');
      });
    });
  });

  describe('Bookmark block', () => {
    it('renders a bookmark with title and URL', async () => {
      const { container } = render(
        <CeptEditor
          content='<aside data-type="bookmark" data-url="https://example.com" data-title="Example Site" data-description="An example website" data-favicon="" data-image=""><a href="https://example.com" target="_blank" rel="noopener noreferrer" class="cept-bookmark-link" contenteditable="false"><div class="cept-bookmark-text"><div class="cept-bookmark-title">Example Site</div><div class="cept-bookmark-description">An example website</div><div class="cept-bookmark-meta"><span class="cept-bookmark-url">https://example.com</span></div></div></a></aside>'
        />,
      );
      await waitFor(() => {
        const bookmark = container.querySelector('aside[data-type="bookmark"]');
        expect(bookmark).not.toBeNull();
        expect(bookmark?.getAttribute('data-title')).toBe('Example Site');
        expect(bookmark?.getAttribute('data-description')).toBe('An example website');
        expect(bookmark?.getAttribute('data-url')).toBe('https://example.com');
      });
    });

    it('renders a bookmark with favicon and cover image', async () => {
      const { container } = render(
        <CeptEditor
          content='<aside data-type="bookmark" data-url="https://example.com" data-title="Example" data-description="" data-favicon="https://example.com/favicon.ico" data-image="https://example.com/cover.jpg"><a href="https://example.com" target="_blank" rel="noopener noreferrer" class="cept-bookmark-link" contenteditable="false"><div class="cept-bookmark-text"><div class="cept-bookmark-title">Example</div><div class="cept-bookmark-meta"><img src="https://example.com/favicon.ico" class="cept-bookmark-favicon" width="16" height="16" loading="lazy"><span class="cept-bookmark-url">https://example.com</span></div></div><div class="cept-bookmark-cover"><img src="https://example.com/cover.jpg" loading="lazy" draggable="false"></div></a></aside>'
        />,
      );
      await waitFor(() => {
        const bookmark = container.querySelector('aside[data-type="bookmark"]');
        expect(bookmark).not.toBeNull();
        expect(bookmark?.getAttribute('data-favicon')).toBe(
          'https://example.com/favicon.ico',
        );
        expect(bookmark?.getAttribute('data-image')).toBe(
          'https://example.com/cover.jpg',
        );
      });
    });
  });

  describe('Mixed media content', () => {
    it('renders multiple media blocks together', async () => {
      const { container } = render(
        <CeptEditor
          content={`<p>Some text before media</p>
<figure data-type="image" data-src="https://example.com/img.jpg" data-alt="test" data-width="100%" data-caption=""><img src="https://example.com/img.jpg" alt="test" style="width: 100%; max-width: 100%;" draggable="false"></figure>
<aside data-type="bookmark" data-url="https://example.com" data-title="Link" data-description="" data-favicon="" data-image=""><a href="https://example.com" target="_blank" rel="noopener noreferrer" class="cept-bookmark-link" contenteditable="false"><div class="cept-bookmark-text"><div class="cept-bookmark-title">Link</div><div class="cept-bookmark-meta"><span class="cept-bookmark-url">https://example.com</span></div></div></a></aside>
<p>Some text after media</p>`}
        />,
      );
      await waitFor(() => {
        const paragraphs = container.querySelectorAll('p.cept-paragraph');
        expect(paragraphs.length).toBeGreaterThanOrEqual(2);
        const img = container.querySelector('img[alt="test"]');
        expect(img).not.toBeNull();
        const bookmark = container.querySelector('aside[data-type="bookmark"]');
        expect(bookmark).not.toBeNull();
      });
    });
  });
});
