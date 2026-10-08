import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Targets every Nx project must have, or skip with a reason. */
export const REQUIRED_TARGETS = ['build', 'typecheck', 'test:unit'] as const;

export interface ProjectTargets {
  name: string;
  targets: string[];
  /** `cept.skipTargets` from the project's package.json: target name to the reason it is skipped. */
  skip: Record<string, string>;
  /** Nx tags (`nx.tags` in package.json, `tags` in project.json). */
  tags: string[];
}

/** Tag prefixes every project carries exactly once; `eslint.config.js` constrains dependencies by them. */
export const REQUIRED_TAG_PREFIXES = ['scope:', 'platform:'] as const;

/** Returns one problem per project that lacks, or repeats, a `scope:` or `platform:` tag. */
export function findTagProblems(projects: ProjectTargets[]): string[] {
  const problems: string[] = [];
  for (const project of projects) {
    for (const prefix of REQUIRED_TAG_PREFIXES) {
      const tags = project.tags.filter((t) => t.startsWith(prefix));
      if (tags.length !== 1) {
        problems.push(
          `${project.name}: needs exactly one "${prefix}" tag in nx.tags, has ${tags.length === 0 ? 'none' : tags.join(', ')}`,
        );
      }
    }
  }
  return problems;
}

/**
 * Returns one problem per required target a project neither has nor skips with a
 * non-empty reason, per skip marker that names a target the project does have, and
 * per skip marker that names a target outside `required` (usually a typo).
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
    for (const skipped of Object.keys(project.skip)) {
      if (!required.includes(skipped)) {
        problems.push(
          `${project.name}: cept.skipTargets["${skipped}"] is not a required target (${required.join(', ')})`,
        );
      }
    }
  }
  return problems;
}

function readSkip(root: string): Record<string, string> {
  const file = path.join(root, 'package.json');
  if (!existsSync(file)) return {};
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
    cept?: { skipTargets?: Record<string, string> };
  };
  return pkg.cept?.skipTargets ?? {};
}

interface ProjectGraph {
  graph: {
    nodes: Record<
      string,
      { data: { root: string; targets?: Record<string, unknown>; tags?: string[] } }
    >;
  };
}

/** Reads every project's targets from one `nx graph --file` export. */
export function loadProjects(): ProjectTargets[] {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-targets-'));
  try {
    const file = path.join(dir, 'graph.json');
    execFileSync('bunx', ['nx', 'graph', `--file=${file}`], { stdio: 'ignore' });
    const { graph } = JSON.parse(readFileSync(file, 'utf8')) as ProjectGraph;
    return Object.entries(graph.nodes).map(([name, { data }]) => ({
      name,
      targets: Object.keys(data.targets ?? {}),
      skip: readSkip(data.root),
      tags: data.tags ?? [],
    }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const projects = loadProjects();
  const problems = [...findTargetProblems(projects), ...findTagProblems(projects)];
  if (problems.length > 0) {
    console.error(
      `Every Nx project needs ${REQUIRED_TARGETS.join(', ')} (or a skip reason) and one scope: and platform: tag:`,
    );
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(
    `Every Nx project has ${REQUIRED_TARGETS.join(', ')} or a skip reason, and one scope: and platform: tag.`,
  );
}
