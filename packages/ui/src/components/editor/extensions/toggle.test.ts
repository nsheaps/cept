import { describe, it, expect } from 'vitest';
import { Toggle } from './toggle.js';

describe('Toggle extension', () => {
  it('has correct name', () => {
    expect(Toggle.name).toBe('toggle');
  });

  it('is a block-level node', () => {
    const ext = Toggle;
    expect(ext.config.group).toBe('block');
  });

  it('has content spec for block+', () => {
    const ext = Toggle;
    expect(ext.config.content).toBe('block+');
  });

  it('is defining', () => {
    const ext = Toggle;
    expect(ext.config.defining).toBe(true);
  });

  it('parses from details[data-type="toggle"]', () => {
    const ext = Toggle;
    const parseRules = ext.config.parseHTML?.call(ext);
    expect(parseRules).toEqual([{ tag: 'details[data-type="toggle"]' }]);
  });

  it('has default summary attribute', () => {
    const ext = Toggle;
    const attrs = ext.config.addAttributes?.call(ext);
    expect(attrs?.summary?.default).toBe('Toggle');
  });

  it('has default open=false attribute', () => {
    const ext = Toggle;
    const attrs = ext.config.addAttributes?.call(ext);
    expect(attrs?.open?.default).toBe(false);
  });

  it('defines setToggle and toggleToggleOpen commands', () => {
    const ext = Toggle;
    const commands = ext.config.addCommands?.call(ext);
    expect(commands).toHaveProperty('setToggle');
    expect(commands).toHaveProperty('toggleToggleOpen');
  });

  it('has higher priority than blockquote (110)', () => {
    const ext = Toggle;
    expect(ext.config.priority).toBe(110);
  });

  it('defines an input rule for > shortcut', () => {
    const ext = Toggle;
    const inputRules = ext.config.addInputRules?.call(ext);
    expect(inputRules).toBeDefined();
    expect(inputRules!.length).toBeGreaterThan(0);
  });

  it('provides markdown serialization storage', () => {
    const ext = Toggle;
    const storage = ext.config.addStorage?.call(ext);
    expect(storage).toBeDefined();
    expect(storage?.markdown?.serialize).toBeDefined();
    expect(typeof storage?.markdown?.serialize).toBe('function');
  });

  it('defines ProseMirror plugins for click handling', () => {
    const ext = Toggle;
    const plugins = ext.config.addProseMirrorPlugins?.call(ext);
    expect(plugins).toBeDefined();
    expect(plugins!.length).toBeGreaterThan(0);
  });
});
