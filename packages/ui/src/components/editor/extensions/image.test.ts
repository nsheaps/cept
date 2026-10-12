import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../document-extensions.js';
import { ImageBlock } from './image.js';

describe('ImageBlock extension', () => {
  it('has correct name', () => {
    expect(ImageBlock.name).toBe('imageBlock');
  });

  it('is a block-level node', () => {
    const ext = ImageBlock;
    expect(ext.config.group).toBe('block');
  });

  it('is atomic', () => {
    const ext = ImageBlock;
    expect(ext.config.atom).toBe(true);
  });

  it('parses from figure[data-type="image"]', () => {
    const ext = ImageBlock;
    const parseRules = ext.config.parseHTML?.call(ext);
    expect(parseRules).toEqual([{ tag: 'figure[data-type="image"]' }, { tag: 'img[src]' }]);
  });

  it('reads a bare image in pasted HTML as an image block', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: '<img src="a.png" alt="An image">',
    });
    const image = editor.getJSON().content?.[0];
    expect(image?.type).toBe('imageBlock');
    expect(image?.attrs).toMatchObject({ src: 'a.png', alt: 'An image' });
    editor.destroy();
  });

  it('has src attribute defaulting to null', () => {
    const ext = ImageBlock;
    const attrs = ext.config.addAttributes?.call(ext);
    expect(attrs?.src?.default).toBeNull();
  });

  it('has alt attribute defaulting to empty string', () => {
    const ext = ImageBlock;
    const attrs = ext.config.addAttributes?.call(ext);
    expect(attrs?.alt?.default).toBe('');
  });

  it('has caption attribute', () => {
    const ext = ImageBlock;
    const attrs = ext.config.addAttributes?.call(ext);
    expect(attrs?.caption?.default).toBe('');
  });

  it('has width attribute defaulting to null (natural size)', () => {
    const ext = ImageBlock;
    const attrs = ext.config.addAttributes?.call(ext);
    expect(attrs?.width?.default).toBeNull();
  });

  it('defines setImageBlock command', () => {
    const ext = ImageBlock;
    const commands = ext.config.addCommands?.call(ext);
    expect(commands).toHaveProperty('setImageBlock');
  });
});
