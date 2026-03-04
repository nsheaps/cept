import { describe, it, expect } from 'vitest';
import { evaluateFormula } from './formula.js';
import type { DatabaseRow, DatabaseSchema } from '../models/index.js';

const schema: DatabaseSchema = {
  id: 'test',
  title: 'Test',
  properties: {
    name: { type: 'text' },
    price: { type: 'number' },
    quantity: { type: 'number' },
    status: { type: 'select', options: [{ value: 'Active', color: 'green' }] },
    done: { type: 'checkbox' },
  },
  views: [],
};

const row: DatabaseRow = {
  id: 'r1',
  properties: {
    name: 'Widget',
    price: 25.5,
    quantity: 10,
    status: 'Active',
    done: true,
  },
};

describe('Formula Evaluator', () => {
  describe('literals', () => {
    it('should evaluate number literals', () => {
      expect(evaluateFormula('42', row, schema)).toBe(42);
    });

    it('should evaluate string literals', () => {
      expect(evaluateFormula('"hello"', row, schema)).toBe('hello');
    });

    it('should evaluate boolean literals', () => {
      expect(evaluateFormula('true', row, schema)).toBe(true);
      expect(evaluateFormula('false', row, schema)).toBe(false);
    });
  });

  describe('arithmetic', () => {
    it('should add numbers', () => {
      expect(evaluateFormula('2 + 3', row, schema)).toBe(5);
    });

    it('should subtract numbers', () => {
      expect(evaluateFormula('10 - 4', row, schema)).toBe(6);
    });

    it('should multiply numbers', () => {
      expect(evaluateFormula('3 * 4', row, schema)).toBe(12);
    });

    it('should divide numbers', () => {
      expect(evaluateFormula('10 / 2', row, schema)).toBe(5);
    });

    it('should handle modulo', () => {
      expect(evaluateFormula('7 % 3', row, schema)).toBe(1);
    });

    it('should respect operator precedence', () => {
      expect(evaluateFormula('2 + 3 * 4', row, schema)).toBe(14);
    });

    it('should handle parentheses', () => {
      expect(evaluateFormula('(2 + 3) * 4', row, schema)).toBe(20);
    });

    it('should handle unary minus', () => {
      expect(evaluateFormula('-5', row, schema)).toBe(-5);
    });
  });

  describe('comparison', () => {
    it('should compare equality', () => {
      expect(evaluateFormula('1 == 1', row, schema)).toBe(true);
      expect(evaluateFormula('1 == 2', row, schema)).toBe(false);
    });

    it('should compare inequality', () => {
      expect(evaluateFormula('1 != 2', row, schema)).toBe(true);
    });

    it('should compare greater/less', () => {
      expect(evaluateFormula('5 > 3', row, schema)).toBe(true);
      expect(evaluateFormula('3 < 5', row, schema)).toBe(true);
      expect(evaluateFormula('5 >= 5', row, schema)).toBe(true);
      expect(evaluateFormula('3 <= 5', row, schema)).toBe(true);
    });
  });

  describe('logic', () => {
    it('should handle and', () => {
      expect(evaluateFormula('true && true', row, schema)).toBe(true);
      expect(evaluateFormula('true && false', row, schema)).toBe(false);
    });

    it('should handle or', () => {
      expect(evaluateFormula('false || true', row, schema)).toBe(true);
      expect(evaluateFormula('false || false', row, schema)).toBe(false);
    });

    it('should handle not', () => {
      expect(evaluateFormula('!true', row, schema)).toBe(false);
      expect(evaluateFormula('!false', row, schema)).toBe(true);
    });
  });

  describe('property references', () => {
    it('should resolve prop() references', () => {
      expect(evaluateFormula('prop("name")', row, schema)).toBe('Widget');
      expect(evaluateFormula('prop("price")', row, schema)).toBe(25.5);
      expect(evaluateFormula('prop("done")', row, schema)).toBe(true);
    });

    it('should return null for missing properties', () => {
      expect(evaluateFormula('prop("nonexistent")', row, schema)).toBeNull();
    });

    it('should use prop values in arithmetic', () => {
      expect(evaluateFormula('prop("price") * prop("quantity")', row, schema)).toBe(255);
    });
  });

  describe('built-in functions', () => {
    it('should handle if()', () => {
      expect(evaluateFormula('if(true, "yes", "no")', row, schema)).toBe('yes');
      expect(evaluateFormula('if(false, "yes", "no")', row, schema)).toBe('no');
    });

    it('should handle concat()', () => {
      expect(evaluateFormula('concat("hello", " ", "world")', row, schema)).toBe(
        'hello world',
      );
    });

    it('should handle contains()', () => {
      expect(evaluateFormula('contains("hello world", "world")', row, schema)).toBe(true);
      expect(evaluateFormula('contains("hello", "xyz")', row, schema)).toBe(false);
    });

    it('should handle length()', () => {
      expect(evaluateFormula('length("hello")', row, schema)).toBe(5);
    });

    it('should handle lower() and upper()', () => {
      expect(evaluateFormula('lower("HELLO")', row, schema)).toBe('hello');
      expect(evaluateFormula('upper("hello")', row, schema)).toBe('HELLO');
    });

    it('should handle abs(), ceil(), floor(), round()', () => {
      expect(evaluateFormula('abs(-5)', row, schema)).toBe(5);
      expect(evaluateFormula('ceil(4.2)', row, schema)).toBe(5);
      expect(evaluateFormula('floor(4.8)', row, schema)).toBe(4);
      expect(evaluateFormula('round(4.5)', row, schema)).toBe(5);
    });

    it('should handle min() and max()', () => {
      expect(evaluateFormula('min(3, 1, 2)', row, schema)).toBe(1);
      expect(evaluateFormula('max(3, 1, 2)', row, schema)).toBe(3);
    });

    it('should handle pow() and sqrt()', () => {
      expect(evaluateFormula('pow(2, 3)', row, schema)).toBe(8);
      expect(evaluateFormula('sqrt(9)', row, schema)).toBe(3);
    });

    it('should handle empty()', () => {
      expect(evaluateFormula('empty("")', row, schema)).toBe(true);
      expect(evaluateFormula('empty("text")', row, schema)).toBe(false);
    });

    it('should handle toNumber() and toString()', () => {
      expect(evaluateFormula('toNumber("42")', row, schema)).toBe(42);
      expect(evaluateFormula('toString(42)', row, schema)).toBe('42');
    });

    it('should handle trim()', () => {
      expect(evaluateFormula('trim("  hello  ")', row, schema)).toBe('hello');
    });
  });

  describe('complex expressions', () => {
    it('should evaluate nested function calls', () => {
      const result = evaluateFormula(
        'if(prop("price") > 20, "expensive", "cheap")',
        row,
        schema,
      );
      expect(result).toBe('expensive');
    });

    it('should evaluate prop arithmetic with function', () => {
      const result = evaluateFormula(
        'round(prop("price") * prop("quantity") * 1.1)',
        row,
        schema,
      );
      expect(result).toBe(281); // 25.5 * 10 * 1.1 = 280.5, rounded = 281
    });

    it('should return null for empty expression', () => {
      expect(evaluateFormula('', row, schema)).toBeNull();
    });

    it('should return null for invalid expression', () => {
      expect(evaluateFormula(')))invalid(((', row, schema)).toBeNull();
    });
  });

  describe('string concatenation with +', () => {
    it('should concat strings with +', () => {
      expect(evaluateFormula('"hello" + " " + "world"', row, schema)).toBe('hello world');
    });
  });

  describe('division by zero', () => {
    it('should return null for division by zero', () => {
      expect(evaluateFormula('10 / 0', row, schema)).toBeNull();
    });
  });
});
