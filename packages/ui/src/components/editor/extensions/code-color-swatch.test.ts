import { describe, it, expect } from 'vitest';
import { CodeColorSwatch, colorSwatchPluginKey } from './code-color-swatch.js';

describe('CodeColorSwatch extension', () => {
  it('has correct name', () => {
    expect(CodeColorSwatch.name).toBe('codeColorSwatch');
  });

  it('exports a plugin key', () => {
    expect(colorSwatchPluginKey).toBeDefined();
  });

  it('defines ProseMirror plugins', () => {
    expect(CodeColorSwatch.config.addProseMirrorPlugins).toBeDefined();
  });

  it('is an Extension (not a Node or Mark)', () => {
    expect(CodeColorSwatch.type).toBe('extension');
  });
});
