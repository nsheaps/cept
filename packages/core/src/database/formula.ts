/**
 * Formula evaluator for Cept database formulas.
 *
 * Supports:
 * - Property references: prop("name")
 * - Arithmetic: +, -, *, /, %
 * - Comparison: ==, !=, >, <, >=, <=
 * - Logic: and, or, not
 * - String functions: concat, contains, length, lower, upper, replace, slice, trim
 * - Number functions: abs, ceil, floor, round, min, max, pow, sqrt
 * - Date functions: now, dateAdd, dateBetween, formatDate
 * - Conditional: if(condition, then, else)
 * - Type checking: empty, toNumber, toString
 */

import type { DatabaseRow, DatabaseSchema } from '../models/index.js';

/** Token types for the formula lexer */
type TokenType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'identifier'
  | 'operator'
  | 'paren'
  | 'comma';

interface Token {
  type: TokenType;
  value: string;
}

/** Tokenize a formula expression */
function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Numbers
    if (/\d/.test(ch) || (ch === '.' && i + 1 < expression.length && /\d/.test(expression[i + 1]))) {
      let num = '';
      while (i < expression.length && (/\d/.test(expression[i]) || expression[i] === '.')) {
        num += expression[i++];
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Strings (double or single quoted)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = '';
      i++; // skip opening quote
      while (i < expression.length && expression[i] !== quote) {
        if (expression[i] === '\\' && i + 1 < expression.length) {
          i++;
          str += expression[i];
        } else {
          str += expression[i];
        }
        i++;
      }
      i++; // skip closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Two-character operators
    if (i + 1 < expression.length) {
      const two = expression.slice(i, i + 2);
      if (['==', '!=', '>=', '<=', '&&', '||'].includes(two)) {
        tokens.push({ type: 'operator', value: two });
        i += 2;
        continue;
      }
    }

    // Single character operators
    if ('+-*/%><!'.includes(ch)) {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }

    // Parentheses
    if ('()'.includes(ch)) {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }

    // Comma
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ',' });
      i++;
      continue;
    }

    // Identifiers and boolean keywords
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < expression.length && /[a-zA-Z0-9_]/.test(expression[i])) {
        id += expression[i++];
      }
      if (id === 'true' || id === 'false') {
        tokens.push({ type: 'boolean', value: id });
      } else {
        tokens.push({ type: 'identifier', value: id });
      }
      continue;
    }

    // Skip unknown characters
    i++;
  }

  return tokens;
}

type FormulaValue = string | number | boolean | null | Date;

/** Built-in functions */
const FUNCTIONS: Record<
  string,
  (args: FormulaValue[], row: DatabaseRow, schema: DatabaseSchema) => FormulaValue
> = {
  // Property reference
  prop: (args, row) => {
    const propName = String(args[0]);
    const val = row.properties[propName];
    if (val === undefined || val === null) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
    return String(val);
  },

  // Conditional
  if: (args) => {
    const [condition, thenValue, elseValue] = args;
    return condition ? (thenValue ?? null) : (elseValue ?? null);
  },

  // String functions
  concat: (args) => args.map((a) => String(a ?? '')).join(''),
  contains: (args) => String(args[0] ?? '').includes(String(args[1] ?? '')),
  length: (args) => String(args[0] ?? '').length,
  lower: (args) => String(args[0] ?? '').toLowerCase(),
  upper: (args) => String(args[0] ?? '').toUpperCase(),
  replace: (args) =>
    String(args[0] ?? '').replace(String(args[1] ?? ''), String(args[2] ?? '')),
  slice: (args) => String(args[0] ?? '').slice(Number(args[1] ?? 0), Number(args[2] ?? undefined)),
  trim: (args) => String(args[0] ?? '').trim(),

  // Number functions
  abs: (args) => Math.abs(Number(args[0])),
  ceil: (args) => Math.ceil(Number(args[0])),
  floor: (args) => Math.floor(Number(args[0])),
  round: (args) => Math.round(Number(args[0])),
  min: (args) => Math.min(...args.map(Number)),
  max: (args) => Math.max(...args.map(Number)),
  pow: (args) => Math.pow(Number(args[0]), Number(args[1])),
  sqrt: (args) => Math.sqrt(Number(args[0])),

  // Type functions
  empty: (args) => args[0] === null || args[0] === '' || args[0] === undefined,
  toNumber: (args) => Number(args[0]),
  toString: (args: FormulaValue[]) => String(args[0] ?? ''),

  // Date functions
  now: () => new Date(),
  dateAdd: (args) => {
    const date = args[0] instanceof Date ? args[0] : new Date(String(args[0] ?? ''));
    const amount = Number(args[1] ?? 0);
    const unit = String(args[2] ?? 'days');
    const result = new Date(date);
    switch (unit) {
      case 'years':
        result.setFullYear(result.getFullYear() + amount);
        break;
      case 'months':
        result.setMonth(result.getMonth() + amount);
        break;
      case 'weeks':
        result.setDate(result.getDate() + amount * 7);
        break;
      case 'days':
        result.setDate(result.getDate() + amount);
        break;
      case 'hours':
        result.setHours(result.getHours() + amount);
        break;
      case 'minutes':
        result.setMinutes(result.getMinutes() + amount);
        break;
    }
    return result;
  },
  dateBetween: (args) => {
    const d1 = args[0] instanceof Date ? args[0] : new Date(String(args[0] ?? ''));
    const d2 = args[1] instanceof Date ? args[1] : new Date(String(args[1] ?? ''));
    const unit = String(args[2] ?? 'days');
    const diffMs = d2.getTime() - d1.getTime();
    switch (unit) {
      case 'years':
        return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
      case 'months':
        return Math.floor(diffMs / (30.44 * 24 * 60 * 60 * 1000));
      case 'weeks':
        return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      case 'days':
        return Math.floor(diffMs / (24 * 60 * 60 * 1000));
      case 'hours':
        return Math.floor(diffMs / (60 * 60 * 1000));
      case 'minutes':
        return Math.floor(diffMs / (60 * 1000));
      default:
        return diffMs;
    }
  },
  formatDate: (args) => {
    const date = args[0] instanceof Date ? args[0] : new Date(String(args[0] ?? ''));
    return date.toISOString();
  },

  // Logic
  and: (args) => args.every(Boolean),
  or: (args) => args.some(Boolean),
  not: (args) => !args[0],
};

/** Simple recursive-descent parser for formula evaluation */
class FormulaEvaluator {
  private tokens: Token[];
  private pos: number;
  private row: DatabaseRow;
  private schema: DatabaseSchema;

  constructor(tokens: Token[], row: DatabaseRow, schema: DatabaseSchema) {
    this.tokens = tokens;
    this.pos = 0;
    this.row = row;
    this.schema = schema;
  }

  evaluate(): FormulaValue {
    const result = this.parseExpression();
    return result;
  }

  private parseExpression(): FormulaValue {
    return this.parseOr();
  }

  private parseOr(): FormulaValue {
    let left = this.parseAnd();
    while (this.match('operator', '||') || this.match('identifier', 'or')) {
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  private parseAnd(): FormulaValue {
    let left = this.parseComparison();
    while (this.match('operator', '&&') || this.match('identifier', 'and')) {
      const right = this.parseComparison();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  private parseComparison(): FormulaValue {
    let left = this.parseAddSub();
    while (true) {
      if (this.match('operator', '==')) {
        const right = this.parseAddSub();
        left = left === right;
      } else if (this.match('operator', '!=')) {
        const right = this.parseAddSub();
        left = left !== right;
      } else if (this.match('operator', '>=')) {
        const right = this.parseAddSub();
        left = Number(left) >= Number(right);
      } else if (this.match('operator', '<=')) {
        const right = this.parseAddSub();
        left = Number(left) <= Number(right);
      } else if (this.match('operator', '>')) {
        const right = this.parseAddSub();
        left = Number(left) > Number(right);
      } else if (this.match('operator', '<')) {
        const right = this.parseAddSub();
        left = Number(left) < Number(right);
      } else {
        break;
      }
    }
    return left;
  }

  private parseAddSub(): FormulaValue {
    let left = this.parseMulDiv();
    while (true) {
      if (this.match('operator', '+')) {
        const right = this.parseMulDiv();
        if (typeof left === 'string' || typeof right === 'string') {
          left = String(left ?? '') + String(right ?? '');
        } else {
          left = Number(left) + Number(right);
        }
      } else if (this.match('operator', '-')) {
        const right = this.parseMulDiv();
        left = Number(left) - Number(right);
      } else {
        break;
      }
    }
    return left;
  }

  private parseMulDiv(): FormulaValue {
    let left = this.parseUnary();
    while (true) {
      if (this.match('operator', '*')) {
        const right = this.parseUnary();
        left = Number(left) * Number(right);
      } else if (this.match('operator', '/')) {
        const right = this.parseUnary();
        const divisor = Number(right);
        left = divisor === 0 ? null : Number(left) / divisor;
      } else if (this.match('operator', '%')) {
        const right = this.parseUnary();
        left = Number(left) % Number(right);
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): FormulaValue {
    if (this.match('operator', '-')) {
      const val = this.parsePrimary();
      return -Number(val);
    }
    if (this.match('operator', '!') || this.match('identifier', 'not')) {
      const val = this.parsePrimary();
      return !val;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): FormulaValue {
    const token = this.peek();
    if (!token) return null;

    // Number literal
    if (token.type === 'number') {
      this.advance();
      return Number(token.value);
    }

    // String literal
    if (token.type === 'string') {
      this.advance();
      return token.value;
    }

    // Boolean literal
    if (token.type === 'boolean') {
      this.advance();
      return token.value === 'true';
    }

    // Parenthesized expression
    if (token.type === 'paren' && token.value === '(') {
      this.advance();
      const val = this.parseExpression();
      this.expect('paren', ')');
      return val;
    }

    // Function call or identifier
    if (token.type === 'identifier') {
      this.advance();
      const name = token.value;

      // Check for function call
      if (this.peek()?.type === 'paren' && this.peek()?.value === '(') {
        this.advance(); // consume '('
        const args: FormulaValue[] = [];

        if (!(this.peek()?.type === 'paren' && this.peek()?.value === ')')) {
          args.push(this.parseExpression());
          while (this.match('comma', ',')) {
            args.push(this.parseExpression());
          }
        }

        this.expect('paren', ')');

        const fn = FUNCTIONS[name];
        if (fn) {
          return fn(args, this.row, this.schema);
        }
        return null;
      }

      // Bare identifier — treat as property reference
      const propVal = this.row.properties[name];
      if (propVal === undefined || propVal === null) return null;
      if (typeof propVal === 'string' || typeof propVal === 'number' || typeof propVal === 'boolean') {
        return propVal;
      }
      return String(propVal);
    }

    // Unknown token — skip
    this.advance();
    return null;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token | undefined {
    return this.tokens[this.pos++];
  }

  private match(type: TokenType, value: string): boolean {
    const token = this.peek();
    if (token && token.type === type && token.value === value) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType, value: string): void {
    if (!this.match(type, value)) {
      // Allow missing closing parens at end
    }
  }
}

/** Evaluate a formula expression for a given row */
export function evaluateFormula(
  expression: string,
  row: DatabaseRow,
  schema: DatabaseSchema,
): FormulaValue {
  if (!expression || expression.trim() === '') return null;

  try {
    const tokens = tokenize(expression);
    const evaluator = new FormulaEvaluator(tokens, row, schema);
    return evaluator.evaluate();
  } catch {
    return null;
  }
}
