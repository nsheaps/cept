import { spawnSync } from 'node:child_process';

/**
 * The `nx` arguments for running `targets`. With `NX_BASE` set (pull requests),
 * only projects affected between `NX_BASE` and `NX_HEAD` run; without it
 * (pushes to `main`, local runs), every project does.
 */
export function nxArgs(
  targets: readonly string[],
  env: Record<string, string | undefined>,
): string[] {
  if (targets.length === 0) throw new Error('usage: nx-targets.ts <target>...');
  const base = env.NX_BASE;
  if (!base) return ['run-many', '-t', ...targets];
  return ['affected', '-t', ...targets, `--base=${base}`, `--head=${env.NX_HEAD || 'HEAD'}`];
}

if (import.meta.main) {
  const args = nxArgs(process.argv.slice(2), process.env);
  console.log(`nx ${args.join(' ')}`);
  const result = spawnSync('bunx', ['nx', ...args], { stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  process.exit(result.status ?? 1);
}
