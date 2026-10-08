import { readFileSync } from 'node:fs';
import path from 'node:path';

/** github-actions[bot]: the App that reports checks from GitHub Actions workflows. */
export const GITHUB_ACTIONS_APP_ID = 15368;

/** The `ci.yml` jobs every pull request must pass, plus the PR title workflow. */
export const REQUIRED_CI_JOBS = [
  'lint',
  'typecheck',
  'test-unit',
  'test-integration',
  'test-e2e',
  'build',
  'security',
] as const;

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
  const contexts = REQUIRED_CI_JOBS.map((id) => {
    const uses = ci.jobs?.[id]?.uses;
    if (!uses?.startsWith('./')) throw new Error(`ci.yml job ${id} must call a local workflow`);
    const file = path.join(root, uses);
    return `${id} / ${onlyJobName(readYaml(file) as Workflow, file)}`;
  });
  const prTitle = path.join(root, '.github/workflows/pr-title.yml');
  return [...contexts, onlyJobName(readYaml(prTitle) as Workflow, prTitle)];
}

/** The checks an active `require-checks` ruleset requires on the default branch. */
export function requiredContexts(settings: Settings): StatusCheck[] {
  const ruleset = settings.rulesets?.find((r) => r.name === 'require-checks');
  if (!ruleset || (ruleset.enforcement ?? 'active') !== 'active') return [];
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
