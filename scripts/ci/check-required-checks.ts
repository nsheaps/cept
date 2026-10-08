import { readFileSync } from 'node:fs';
import path from 'node:path';

/** github-actions[bot]: the App that reports checks from GitHub Actions workflows. */
export const GITHUB_ACTIONS_APP_ID = 15368;

/**
 * The `ci.yml` jobs that do not gate a pull request, with the reason. Every
 * other `ci.yml` job must be a required check, so a new job is gated unless it
 * is added here on purpose.
 */
export const OPTIONAL_CI_JOBS: Readonly<Record<string, string>> = {
  screenshots: 'regenerates documentation images; their content does not gate correctness',
  'tag-release': 'runs only on pushes to main, after the other jobs',
};

interface Workflow {
  jobs?: Record<string, { name?: string; uses?: string }>;
}

interface StatusCheck {
  context?: string;
  integration_id?: number;
}

interface Ruleset {
  name?: string;
  enforcement?: string;
  rules?: { type?: string; parameters?: { required_status_checks?: StatusCheck[] } }[];
}

interface Settings {
  rulesets?: Ruleset[];
}

type ReadYaml = (file: string) => unknown;

// A reusable workflow holds one job, so each `ci.yml` job maps to one check.
// Split a workflow that needs several jobs (say, per-browser e2e) into
// separate `ci.yml` jobs instead.
function onlyJobName(workflow: Workflow, file: string): string {
  const jobs = Object.values(workflow.jobs ?? {});
  const name = jobs[0]?.name;
  if (jobs.length !== 1 || !name) throw new Error(`${file} must define exactly one named job`);
  return name;
}

/**
 * The check names GitHub reports for the required jobs. A job that calls a
 * reusable workflow reports as `<caller job id> / <called job name>`.
 */
export function expectedContexts(root: string, readYaml: ReadYaml): string[] {
  const ci = readYaml(path.join(root, '.github/workflows/ci.yml')) as Workflow;
  const jobs = ci.jobs ?? {};
  for (const id of Object.keys(OPTIONAL_CI_JOBS)) {
    if (!(id in jobs)) throw new Error(`OPTIONAL_CI_JOBS lists ${id}, which ci.yml does not have`);
  }
  const required = Object.keys(jobs).filter((id) => !(id in OPTIONAL_CI_JOBS));
  const contexts = required.map((id) => {
    const uses = jobs[id]?.uses;
    if (!uses?.startsWith('./')) throw new Error(`ci.yml job ${id} must call a local workflow`);
    const file = path.join(root, uses);
    return `${id} / ${onlyJobName(readYaml(file) as Workflow, file)}`;
  });
  const prTitle = path.join(root, '.github/workflows/pr-title.yml');
  return [...contexts, onlyJobName(readYaml(prTitle) as Workflow, prTitle)];
}

/**
 * The checks the `require-checks` ruleset requires on the default branch. A
 * ruleset that exists but is not enforced (`evaluate`, `disabled`) is an error,
 * not an empty list, so it cannot quietly leave `main` ungated.
 */
export function requiredContexts(settings: Settings): StatusCheck[] {
  const ruleset = settings.rulesets?.find((r) => r.name === 'require-checks');
  if (!ruleset) return [];
  const enforcement = ruleset.enforcement ?? 'active';
  if (enforcement !== 'active') {
    throw new Error(`require-checks ruleset must be enforcement: active (got ${enforcement})`);
  }
  return (ruleset.rules ?? [])
    .filter((r) => r.type === 'required_status_checks')
    .flatMap((r) => r.parameters?.required_status_checks ?? []);
}

/**
 * Problems with the required checks: a CI job that is not required (a red PR
 * could merge), or a required check that no workflow reports (every PR would
 * wait on it forever).
 */
export function findProblems(expected: readonly string[], required: StatusCheck[]): string[] {
  const problems: string[] = [];
  const contexts = new Map(required.map((c) => [c.context ?? '', c]));
  for (const context of expected) {
    const check = contexts.get(context);
    if (!check) problems.push(`"${context}" is not a required check`);
    else if (check.integration_id !== GITHUB_ACTIONS_APP_ID) {
      problems.push(`"${context}" must use integration_id ${GITHUB_ACTIONS_APP_ID}`);
    }
  }
  for (const context of contexts.keys()) {
    if (!expected.includes(context))
      problems.push(`"${context}" is required but no job reports it`);
  }
  return problems;
}

if (import.meta.main) {
  const root = process.argv[2] ?? '.';
  const readYaml: ReadYaml = (file) => Bun.YAML.parse(readFileSync(file, 'utf8'));
  const settings = readYaml(path.join(root, '.github/settings.yml')) as Settings;
  const problems = findProblems(expectedContexts(root, readYaml), requiredContexts(settings));
  for (const p of problems) console.error(`.github/settings.yml require-checks: ${p}`);
  if (problems.length > 0) process.exit(1);
  console.log('.github/settings.yml: every CI job is a required check');
}
