import { spawnSync } from 'node:child_process';

/** Runs `nx` with `args` and returns its stdout; throws if it fails. */
export type NxRunner = (args: string[]) => string;

/**
 * Whether `project` is affected between `NX_BASE` and `NX_HEAD`. Without
 * `NX_BASE` (pushes to `main`, local runs) every project counts as affected.
 */
export function isAffected(
  project: string,
  env: Record<string, string | undefined>,
  nx: NxRunner,
): boolean {
  const base = env.NX_BASE;
  if (!base) return true;
  const out = nx([
    'show',
    'projects',
    '--affected',
    '--json',
    `--base=${base}`,
    `--head=${env.NX_HEAD || 'HEAD'}`,
  ]);
  return (JSON.parse(out) as string[]).includes(project);
}

const runNx: NxRunner = (args) => {
  const result = spawnSync('bunx', ['nx', ...args], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`nx ${args.join(' ')} failed:\n${result.stderr}`);
  return result.stdout;
};

// Prints `affected=true|false` for $GITHUB_OUTPUT, so a job can skip setup
// (browsers, system packages) for a project the pull request does not touch.
if (import.meta.main) {
  const project = process.argv[2];
  if (!project) {
    console.error('usage: nx-affected.ts <project>');
    process.exit(2);
  }
  console.log(`affected=${isAffected(project, process.env, runNx)}`);
}
