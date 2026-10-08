import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Workflow files that are synced from elsewhere and must not be edited here.
 * Each entry needs a reason; the check skips these files entirely.
 */
export const ALLOWLIST: Record<string, string> = {
  'apply-repo-settings.yaml': 'managed by nsheaps/.github (sync-files); edits are overwritten',
  'dispatch-review.yaml': 'consumer template synced from nsheaps/agents (sync-dispatch-workflows)',
  'pr-status-dispatch.yaml': 'consumer-repo template copied from nsheaps/.org (GSD-101)',
};

export interface Violation {
  line: number;
  reason: string;
}

const RUN_KEY = /^(\s*)(?:-\s+)?run:\s*(.*?)\s*$/;
const BLOCK_SCALAR = /^[|>][+-]?\d*$/;

/** Removes `${{ ... }}` expressions, whose `&&`/`||` are not shell operators. */
function stripExpressions(text: string): string {
  return text.replace(/\$\{\{.*?\}\}/g, 'EXPR');
}

/** Removes quoted arguments, whose `;`, `&&` and `||` are not shell operators. */
function stripQuoted(text: string): string {
  return text.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, 'STR');
}

function isComment(line: string): boolean {
  return line.trim().startsWith('#');
}

/**
 * Returns every `run:` step that holds more than one command: a block scalar
 * with more than one command line (a trailing `\` continues the same command),
 * or a single line chaining commands with `&&`, `||` or `;`.
 */
export function findInlineLogic(yaml: string): Violation[] {
  const lines = yaml.split('\n');
  const violations: Violation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = RUN_KEY.exec(lines[i] ?? '');
    if (!match) continue;
    const indent = (match[1] ?? '').length;
    const value = match[2] ?? '';
    if (BLOCK_SCALAR.test(value)) {
      let commands = 0;
      let continued = false;
      for (let j = i + 1; j < lines.length; j++) {
        const body = lines[j] ?? '';
        if (body.trim() === '') continue;
        if (body.length - body.trimStart().length <= indent) break;
        if (isComment(body)) continue;
        if (!continued) commands++;
        continued = body.trimEnd().endsWith('\\');
      }
      if (commands > 1) {
        violations.push({ line: i + 1, reason: `run block has ${commands} commands` });
      }
    } else if (/&&|\|\||;/.test(stripQuoted(stripExpressions(value)))) {
      violations.push({ line: i + 1, reason: 'run line chains commands' });
    }
  }
  return violations;
}

if (import.meta.main) {
  const dir = process.argv[2] ?? '.github/workflows';
  let failed = false;
  for (const file of readdirSync(dir).sort()) {
    if (!/\.ya?ml$/.test(file) || file in ALLOWLIST) continue;
    for (const v of findInlineLogic(readFileSync(path.join(dir, file), 'utf8'))) {
      console.error(`${dir}/${file}:${v.line}: ${v.reason}; move it to scripts/ci or a mise task`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
  console.log(`${dir}: no inline logic in run steps`);
}
