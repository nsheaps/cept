import { describe, it, expect } from 'vitest';
import { detectProvider, toEmbedUrl } from './embed.js';

describe('Embed helpers', () => {
  describe('detectProvider', () => {
    it('detects YouTube URLs', () => {
      expect(detectProvider('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
      expect(detectProvider('https://youtu.be/abc123')).toBe('youtube');
    });

    it('detects Vimeo URLs', () => {
      expect(detectProvider('https://vimeo.com/123456')).toBe('vimeo');
    });

    it('detects Twitter URLs', () => {
      expect(detectProvider('https://twitter.com/user/status/123')).toBe('twitter');
      expect(detectProvider('https://x.com/user/status/123')).toBe('twitter');
    });

    it('detects CodePen URLs', () => {
      expect(detectProvider('https://codepen.io/user/pen/abc')).toBe('codepen');
    });

    it('detects Figma URLs', () => {
      expect(detectProvider('https://www.figma.com/file/abc')).toBe('figma');
    });

    it('detects Loom URLs', () => {
      expect(detectProvider('https://www.loom.com/share/abc')).toBe('loom');
    });

    it('returns generic for unknown URLs', () => {
      expect(detectProvider('https://example.com')).toBe('generic');
    });
  });

  describe('toEmbedUrl', () => {
    it('converts YouTube watch URLs to embed URLs', () => {
      expect(toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube')).toBe(
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
      );
    });

    it('converts YouTube short URLs to embed URLs', () => {
      expect(toEmbedUrl('https://youtu.be/dQw4w9WgXcQ', 'youtube')).toBe(
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
      );
    });

    it('converts Vimeo URLs to embed URLs', () => {
      expect(toEmbedUrl('https://vimeo.com/123456', 'vimeo')).toBe(
        'https://player.vimeo.com/video/123456',
      );
    });

    it('returns original URL for generic provider', () => {
      expect(toEmbedUrl('https://example.com/embed', 'generic')).toBe(
        'https://example.com/embed',
      );
    });
  });
});
