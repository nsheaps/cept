import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Targets every Nx project must have, or skip with a reason. */
export const REQUIRED_TARGETS = ['build', 'typecheck', 'test:unit'] as const;

export interface ProjectTargets {
  name: string;
  targets: string[];
  /** `cept.skipTargets` from the project's package.json: target name to the reason it is skipped. */
  skip: Record<string, string>;
}

/**
 * Returns one problem per required target a project neither has nor skips with a
 * non-empty reason, and per skip marker that names a target the project does have.
 */
export function findTargetProblems(
  projects: ProjectTargets[],
  required: readonly string[] = REQUIRED_TARGETS,
): string[] {
  const problems: string[] = [];
  for (const project of projects) {
    for (const target of required) {
      const has = project.targets.includes(target);
      const reason = project.skip[target];
      if (has && reason !== undefined) {
        problems.push(`${project.name}: skips "${target}" but also defines it; remove one`);
      } else if (!has && reason === undefined) {
        problems.push(
          `${project.name}: no "${target}" target; add one or a cept.skipTargets reason`,
        );
      } else if (!has && reason.trim() === '') {
        problems.push(`${project.name}: cept.skipTargets["${target}"] needs a reason`);
      }
    }
  }
  return problems;
}

function nx(...args: string[]): string {
  return execFileSync('bunx', ['nx', ...args], { encoding: 'utf8' });
}

function readSkip(root: string): Record<string, string> {
  const file = path.join(root, 'package.json');
  if (!existsSync(file)) return {};
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
    cept?: { skipTargets?: Record<string, string> };
  };
  return pkg.cept?.skipTargets ?? {};
}

/** Reads every project's targets from the Nx project graph. */
export function loadProjects(): ProjectTargets[] {
  const names = JSON.parse(nx('show', 'projects', '--json')) as string[];
  return names.map((name) => {
    const project = JSON.parse(nx('show', 'project', name, '--json')) as {
      root: string;
      targets?: Record<string, unknown>;
    };
    return {
      name,
      targets: Object.keys(project.targets ?? {}),
      skip: readSkip(project.root),
    };
  });
}

if (import.meta.main) {
  const problems = findTargetProblems(loadProjects());
  if (problems.length > 0) {
    console.error(`Every Nx project needs ${REQUIRED_TARGETS.join(', ')} (or a skip reason):`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(`Every Nx project has ${REQUIRED_TARGETS.join(', ')} or a skip reason.`);
}
