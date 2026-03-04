import { describe, it, expect } from 'vitest';
import { Callout } from './callout.js';

describe('Callout extension', () => {
  it('has correct name', () => {
    expect(Callout.name).toBe('callout');
  });

  it('is a block-level node', () => {
    expect(Callout.config.group).toBe('block');
  });

  it('has content spec for block+', () => {
    expect(Callout.config.content).toBe('block+');
  });

  it('is defining', () => {
    expect(Callout.config.defining).toBe(true);
  });

  it('parses from div[data-type="callout"]', () => {
    const parseRules = Callout.config.parseHTML?.call(Callout);
    expect(parseRules).toEqual([{ tag: 'div[data-type="callout"]' }]);
  });

  it('has default icon attribute', () => {
    const attrs = Callout.config.addAttributes?.call(Callout);
    expect(attrs?.icon?.default).toBe('💡');
  });

  it('has default color attribute', () => {
    const attrs = Callout.config.addAttributes?.call(Callout);
    expect(attrs?.color?.default).toBe('default');
  });

  it('defines setCallout and toggleCallout commands', () => {
    const commands = Callout.config.addCommands?.call(Callout);
    expect(commands).toHaveProperty('setCallout');
    expect(commands).toHaveProperty('toggleCallout');
  });

  it('defines keyboard shortcuts config', () => {
    expect(Callout.config.addKeyboardShortcuts).toBeDefined();
  });
});
