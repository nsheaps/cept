import { describe, it, expect } from 'vitest';
import { detectCSSColor } from './color-utils.js';

describe('detectCSSColor', () => {
  describe('hex colors', () => {
    it('detects 3-digit hex', () => {
      expect(detectCSSColor('#fff')).toBe('#fff');
      expect(detectCSSColor('#ABC')).toBe('#ABC');
    });

    it('detects 4-digit hex (with alpha)', () => {
      expect(detectCSSColor('#fffa')).toBe('#fffa');
    });

    it('detects 6-digit hex', () => {
      expect(detectCSSColor('#ff0000')).toBe('#ff0000');
      expect(detectCSSColor('#EEAAFF')).toBe('#EEAAFF');
    });

    it('detects 8-digit hex (with alpha)', () => {
      expect(detectCSSColor('#ff000080')).toBe('#ff000080');
    });

    it('rejects invalid hex', () => {
      expect(detectCSSColor('#ff')).toBeNull();
      expect(detectCSSColor('#gggggg')).toBeNull();
      expect(detectCSSColor('#12345')).toBeNull();
      expect(detectCSSColor('#1234567890')).toBeNull();
    });
  });

  describe('rgb/rgba', () => {
    it('detects rgb()', () => {
      expect(detectCSSColor('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
    });

    it('detects rgba()', () => {
      expect(detectCSSColor('rgba(255, 0, 0, 0.5)')).toBe('rgba(255, 0, 0, 0.5)');
    });

    it('detects modern rgb with slash alpha', () => {
      expect(detectCSSColor('rgb(255 0 0 / 50%)')).toBe('rgb(255 0 0 / 50%)');
    });
  });

  describe('hsl/hsla', () => {
    it('detects hsl()', () => {
      expect(detectCSSColor('hsl(0, 100%, 50%)')).toBe('hsl(0, 100%, 50%)');
    });

    it('detects hsla()', () => {
      expect(detectCSSColor('hsla(0, 100%, 50%, 0.5)')).toBe('hsla(0, 100%, 50%, 0.5)');
    });
  });

  describe('modern color functions', () => {
    it('detects oklch()', () => {
      expect(detectCSSColor('oklch(0.7 0.15 180)')).toBe('oklch(0.7 0.15 180)');
    });

    it('detects oklab()', () => {
      expect(detectCSSColor('oklab(0.7 -0.1 0.1)')).toBe('oklab(0.7 -0.1 0.1)');
    });
  });

  describe('named colors', () => {
    it('detects common named colors', () => {
      expect(detectCSSColor('red')).toBe('red');
      expect(detectCSSColor('blue')).toBe('blue');
      expect(detectCSSColor('cornflowerblue')).toBe('cornflowerblue');
      expect(detectCSSColor('transparent')).toBe('transparent');
    });

    it('is case-insensitive for named colors', () => {
      expect(detectCSSColor('Red')).toBe('Red');
      expect(detectCSSColor('BLUE')).toBe('BLUE');
    });

    it('rejects non-color words', () => {
      expect(detectCSSColor('hello')).toBeNull();
      expect(detectCSSColor('function')).toBeNull();
      expect(detectCSSColor('const')).toBeNull();
    });
  });

  describe('whitespace handling', () => {
    it('trims whitespace', () => {
      expect(detectCSSColor('  #fff  ')).toBe('#fff');
    });

    it('returns null for empty string', () => {
      expect(detectCSSColor('')).toBeNull();
      expect(detectCSSColor('   ')).toBeNull();
    });
  });

  describe('non-color values', () => {
    it('rejects plain numbers', () => {
      expect(detectCSSColor('123')).toBeNull();
    });

    it('rejects code snippets', () => {
      expect(detectCSSColor('console.log()')).toBeNull();
      expect(detectCSSColor('var x = 1')).toBeNull();
    });

    it('rejects partial color-like strings', () => {
      expect(detectCSSColor('#')).toBeNull();
      expect(detectCSSColor('rgb')).toBeNull();
      expect(detectCSSColor('hsl(')).toBeNull();
    });
  });
});
