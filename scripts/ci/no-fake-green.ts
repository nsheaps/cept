import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface Violation {
  line: number;
  reason: string;
}

/**
 * Patterns that let a release job report success for something it did not
 * build: a missing artifact that only warns, a step whose failure is ignored,
 * a Capacitor sync with no native project behind it, and an upload whose
 * errors are discarded.
 */
const RULES: readonly { pattern: RegExp; reason: string }[] = [
  {
    pattern: /^\s*if-no-files-found:\s*['"]?(warn|ignore)\b/,
    reason: 'if-no-files-found must be error; a missing artifact has to fail the job',
  },
  {
    pattern: /^\s*continue-on-error:\s*['"]?true\b/,
    reason: 'continue-on-error hides a failed step; fix the step or remove it',
  },
  {
    pattern: /\bcap\s+sync\b/,
    reason: 'cap sync without a native project builds nothing (mobile packaging is deferred, D-43)',
  },
  {
    pattern: /\brelease\s+upload\b.*\|\|\s*true\b/,
    reason: 'release upload errors are swallowed; a failed upload has to fail the job',
  },
];

function isComment(line: string): boolean {
  return line.trim().startsWith('#');
}

/** Returns every line of a workflow or CI script that fakes a green build. */
export function findFakeGreen(text: string): Violation[] {
  const violations: Violation[] = [];
  text.split('\n').forEach((line, i) => {
    if (isComment(line)) return;
    for (const rule of RULES) {
      if (rule.pattern.test(line)) violations.push({ line: i + 1, reason: rule.reason });
    }
  });
  return violations;
}

/** Workflow files and CI scripts under `dirs`, as repo-relative paths. */
function filesIn(dirs: readonly string[]): string[] {
  return dirs.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => /\.(ya?ml|sh)$/.test(f))
      .sort()
      .map((f) => path.join(dir, f)),
  );
}

if (import.meta.main) {
  const dirs = process.argv.slice(2);
  const targets = dirs.length > 0 ? dirs : ['.github/workflows', 'scripts/ci'];
  let failed = false;
  for (const file of filesIn(targets)) {
    for (const v of findFakeGreen(readFileSync(file, 'utf8'))) {
      console.error(`${file}:${v.line}: ${v.reason}`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
  console.log(`${targets.join(', ')}: no fake-green release steps`);
}
