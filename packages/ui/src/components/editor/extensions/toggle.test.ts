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

  it('defines setToggle command', () => {
    const ext = Toggle;
    const commands = ext.config.addCommands?.call(ext);
    expect(commands).toHaveProperty('setToggle');
  });
});
