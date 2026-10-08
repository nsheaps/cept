import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
}
export type Runner = (args: string[]) => CommandResult;

export type ReleaseVersion =
  { kind: 'release'; version: string } | { kind: 'none' } | { kind: 'error'; message: string };

/**
 * Interprets `release-it --release-version --ci`. A non-zero exit is an error.
 * Exit 0 with empty output means no releasable commits, which is not an error.
 */
export function classifyReleaseVersion(result: CommandResult): ReleaseVersion {
  if (result.status !== 0) {
    const message = `${result.stderr}${result.stdout}`.trim() || `exit code ${result.status}`;
    return { kind: 'error', message };
  }
  const version = result.stdout.trim();
  return version === '' ? { kind: 'none' } : { kind: 'release', version };
}

export type BumpType = 'major' | 'minor' | 'patch' | 'none';

export function bumpType(current: string, next: string): BumpType {
  const [cMajor, cMinor, cPatch] = current.split('.');
  const [nMajor, nMinor, nPatch] = next.split('.');
  if (nMajor !== cMajor) return 'major';
  if (nMinor !== cMinor) return 'minor';
  if (nPatch !== cPatch) return 'patch';
  return 'none';
}

/** Computes the step outputs the "Comment on PR" step reads. */
export function versionOutputs(current: string, run: Runner): Record<string, string> {
  const outputs: Record<string, string> = { current_version: current };
  const result = classifyReleaseVersion(run(['release-it', '--release-version', '--ci']));
  if (result.kind === 'error') {
    return { ...outputs, error: 'true', error_message: result.message };
  }
  outputs.error = 'false';
  if (result.kind === 'none') return { ...outputs, bump_type: 'none' };
  const changelog = run(['release-it', '--changelog', '--ci']);
  return {
    ...outputs,
    next_version: result.version,
    changelog: changelog.status === 0 ? changelog.stdout : '',
    bump_type: bumpType(current, result.version),
  };
}

export function formatGithubOutput(outputs: Record<string, string>): string {
  const delimiter = `EOF_${randomUUID()}`;
  return Object.entries(outputs)
    .map(([key, value]) => `${key}<<${delimiter}\n${value}\n${delimiter}\n`)
    .join('');
}

const bunx: Runner = (args) => {
  const r = spawnSync('bunx', args, { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

if (import.meta.main) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  const outputs = versionOutputs(pkg.version, bunx);
  const text = formatGithubOutput(outputs);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text);
  else process.stdout.write(text);
  if (outputs.error === 'true') console.error(outputs.error_message);
}
