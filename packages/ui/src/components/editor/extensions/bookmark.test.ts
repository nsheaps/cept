import { describe, it, expect } from 'vitest';
import { Bookmark } from './bookmark.js';

describe('Bookmark extension', () => {
  it('has correct name', () => {
    expect(Bookmark.name).toBe('bookmark');
  });

  it('is a block-level node', () => {
    const ext = Bookmark;
    expect(ext.config.group).toBe('block');
  });

  it('is atomic', () => {
    const ext = Bookmark;
    expect(ext.config.atom).toBe(true);
  });

  it('parses from aside[data-type="bookmark"]', () => {
    const ext = Bookmark;
    const parseRules = ext.config.parseHTML?.call(ext);
    expect(parseRules).toEqual([{ tag: 'aside[data-type="bookmark"]' }]);
  });

  it('has url attribute defaulting to null', () => {
    const ext = Bookmark;
    const attrs = ext.config.addAttributes?.call(ext);
    expect(attrs?.url?.default).toBeNull();
  });

  it('has title attribute', () => {
    const ext = Bookmark;
    const attrs = ext.config.addAttributes?.call(ext);
    expect(attrs?.title?.default).toBe('');
  });

  it('has description attribute', () => {
    const ext = Bookmark;
    const attrs = ext.config.addAttributes?.call(ext);
    expect(attrs?.description?.default).toBe('');
  });

  it('has favicon attribute', () => {
    const ext = Bookmark;
    const attrs = ext.config.addAttributes?.call(ext);
    expect(attrs?.favicon?.default).toBe('');
  });

  it('has image attribute', () => {
    const ext = Bookmark;
    const attrs = ext.config.addAttributes?.call(ext);
    expect(attrs?.image?.default).toBe('');
  });

  it('defines setBookmark command', () => {
    const ext = Bookmark;
    const commands = ext.config.addCommands?.call(ext);
    expect(commands).toHaveProperty('setBookmark');
  });
});
