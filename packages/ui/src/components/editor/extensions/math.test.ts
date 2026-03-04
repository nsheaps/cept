import { describe, it, expect, vi } from 'vitest';
import { MathBlock, InlineMath, renderKatex } from './math.js';

// Mock katex since it requires DOM
vi.mock('katex', () => ({
  default: {
    renderToString: vi.fn((latex: string, opts: { displayMode: boolean }) => {
      if (latex === 'invalid\\') {
        throw new Error('Parse error');
      }
      return `<span class="katex${opts.displayMode ? '-display' : ''}">${latex}</span>`;
    }),
  },
}));

describe('renderKatex', () => {
  it('renders valid LaTeX', () => {
    const result = renderKatex('E = mc^2', true);
    expect(result).toContain('E = mc^2');
    expect(result).toContain('katex-display');
  });

  it('renders inline mode', () => {
    const result = renderKatex('x^2', false);
    expect(result).toContain('x^2');
    expect(result).toContain('katex');
    expect(result).not.toContain('katex-display');
  });

  it('returns error span for invalid LaTeX', () => {
    const result = renderKatex('invalid\\', false);
    expect(result).toContain('cept-math-error');
  });
});

describe('MathBlock extension', () => {
  it('has the correct name', () => {
    expect(MathBlock.name).toBe('mathBlock');
  });

  it('is a block node', () => {
    expect(MathBlock.config.group).toBe('block');
  });

  it('is an atom node', () => {
    expect(MathBlock.config.atom).toBe(true);
  });

  it('has default content attribute', () => {
    const attrs = MathBlock.config.addAttributes?.call(MathBlock);
    expect(attrs).toBeDefined();
    if (attrs) {
      expect((attrs as Record<string, { default: string }>).content.default).toBe('');
    }
  });

  it('parses div[data-type="math-block"]', () => {
    const parseRules = MathBlock.config.parseHTML?.call(MathBlock);
    expect(parseRules).toEqual([{ tag: 'div[data-type="math-block"]' }]);
  });
});

describe('InlineMath extension', () => {
  it('has the correct name', () => {
    expect(InlineMath.name).toBe('inlineMath');
  });

  it('is an inline node', () => {
    expect(InlineMath.config.group).toBe('inline');
    expect(InlineMath.config.inline).toBe(true);
  });

  it('is an atom node', () => {
    expect(InlineMath.config.atom).toBe(true);
  });

  it('parses span[data-type="inline-math"]', () => {
    const parseRules = InlineMath.config.parseHTML?.call(InlineMath);
    expect(parseRules).toEqual([{ tag: 'span[data-type="inline-math"]' }]);
  });
});
