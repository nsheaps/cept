import { spawnSync } from 'node:child_process';

/**
 * The `nx` arguments for running `targets` (plus any flags such as `--projects`).
 * With `NX_BASE` set (pull requests), only projects affected between `NX_BASE`
 * and `NX_HEAD` run; without it (pushes to `main`, local runs), every project does.
 */
export function nxArgs(args: readonly string[], env: Record<string, string | undefined>): string[] {
  const targets = args.filter((a) => !a.startsWith('-'));
  const flags = args.filter((a) => a.startsWith('-'));
  if (targets.length === 0) throw new Error('usage: nx-targets.ts <target>... [--projects=<p>]');
  const base = env.NX_BASE;
  if (!base) return ['run-many', '-t', ...targets, ...flags];
  return [
    'affected',
    '-t',
    ...targets,
    ...flags,
    `--base=${base}`,
    `--head=${env.NX_HEAD || 'HEAD'}`,
  ];
}

if (import.meta.main) {
  const args = nxArgs(process.argv.slice(2), process.env);
  console.log(`nx ${args.join(' ')}`);
  const result = spawnSync('bunx', ['nx', ...args], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
