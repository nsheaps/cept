/**
 * Meta-tests for the security gates (`mise run security`): each gate must FAIL
 * on deliberately broken input, otherwise a green CI run proves nothing.
 *
 * - gitleaks runs against tools/security-fixtures/config.txt (a fake key) and
 *   against a secret generated at test time, in a working tree and in history.
 * - osv-scanner runs against tools/security-fixtures/bun.lock (lodash 4.17.15).
 *   It needs network access to api.osv.dev.
 * - The fixtures are excluded from the real-tree scan by path; these tests
 *   prove that exclusion does not make the gates blind to them.
 *
 * The commands come from the `security` task in .mise.toml, so the tests run
 * exactly what CI runs. Run them through `mise run test:integration` so the
 * pinned gitleaks and osv-scanner are on PATH.
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixturesDir = path.join(repoRoot, 'tools/security-fixtures');
const temps: string[] = [];

// Scanning the repo and calling api.osv.dev is slow when `mise run check` runs jobs in parallel.
vi.setConfig({ testTimeout: 120_000 });

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), `cept-${prefix}-`));
  temps.push(dir);
  return dir;
}

function run(command: string, args: string[], cwd: string): SpawnSyncReturns<string> {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error) {
    throw new Error(
      `could not run ${command} (${result.error.message}); run the tests through \`mise run test:integration\` so mise tools are on PATH`,
    );
  }
  return result;
}

afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

/** The commands `mise run security` runs (.mise.toml `[tasks.security]`). */
function securityTask(): string[] {
  const toml = readFileSync(path.join(repoRoot, '.mise.toml'), 'utf8');
  const block = /^\[tasks\.security\][\s\S]*?^run = \[\n([\s\S]*?)^\]/m.exec(toml);
  if (!block?.[1]) throw new Error('.mise.toml has no [tasks.security] run list');
  return [...block[1].matchAll(/^\s*"(.*)",?\s*$/gm)].map((m) => m[1] ?? '');
}

/** One task command run in `cwd`, with repo config files resolved from the repo root. */
function runTaskCommand(prefix: string, cwd: string): SpawnSyncReturns<string> {
  const line = securityTask().find((cmd) => cmd.startsWith(prefix));
  if (!line) throw new Error(`no \`${prefix}\` command in the security task`);
  const [command = '', ...args] = line.split(/\s+/);
  const configs = new Set(['.gitleaks.toml', 'osv-scanner.toml']);
  return run(
    command,
    args.map((arg) => (configs.has(arg) ? path.join(repoRoot, arg) : arg)),
    cwd,
  );
}

describe('the security task', () => {
  it('scans git history, the working tree and bun.lock', () => {
    expect(securityTask()).toEqual([
      expect.stringMatching(/^gitleaks git .*--log-opts=HEAD .*\.$/),
      expect.stringMatching(/^gitleaks dir .*\.$/),
      expect.stringMatching(/^osv-scanner scan source .*--lockfile bun\.lock$/),
    ]);
  });
});

describe('gitleaks catches secrets', () => {
  // A GitHub personal access token shape, generated fresh so no secret is ever committed.
  const fakeToken = () =>
    `ghp_${randomBytes(27)
      .toString('base64')
      .replace(/[^A-Za-z0-9]/g, 'A')
      .slice(0, 36)}`;

  function repo(): { dir: string; git: (...args: string[]) => void } {
    const dir = tempDir('gitleaks-git');
    const git = (...args: string[]) => {
      const r = run('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], dir);
      expect(r.status, r.stderr).toBe(0);
    };
    git('init', '--quiet', '--initial-branch=main');
    return { dir, git };
  }

  it('in the working tree', () => {
    const dir = tempDir('gitleaks-dir');
    writeFileSync(path.join(dir, 'clean.ts'), 'export const token = process.env.TOKEN;\n');
    const clean = runTaskCommand('gitleaks dir', dir);
    expect(clean.status, clean.stdout + clean.stderr).toBe(0);

    writeFileSync(path.join(dir, 'leak.ts'), `export const token = '${fakeToken()}';\n`);
    const leak = runTaskCommand('gitleaks dir', dir);
    expect(leak.status, leak.stdout + leak.stderr).toBe(1);
  });

  it('in git history after the secret was deleted', () => {
    const { dir, git } = repo();
    writeFileSync(path.join(dir, 'config.ts'), `export const token = '${fakeToken()}';\n`);
    git('add', '.');
    git('commit', '--quiet', '--no-gpg-sign', '-m', 'add token');
    writeFileSync(path.join(dir, 'config.ts'), 'export const token = process.env.TOKEN;\n');
    git('commit', '--quiet', '--no-gpg-sign', '-am', 'remove token');

    const result = runTaskCommand('gitleaks git', dir);
    expect(result.status, result.stdout + result.stderr).toBe(1);
  });

  it('in the committed fixture once it is outside its excluded path', () => {
    const dir = tempDir('gitleaks-fixture');
    cpSync(fixturesDir, dir, { recursive: true });
    const result = runTaskCommand('gitleaks dir', dir);
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stderr).toContain('leaks found: 1');
  });

  it('but skips the fixture directory in place, by path only', () => {
    // The real-tree scan must stay green with the fixture committed; the copy
    // above shows that is the path allowlist at work and not a blind rule.
    const result = runTaskCommand('gitleaks dir', repoRoot);
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});

describe('osv-scanner catches a known-vulnerable dependency in bun.lock', () => {
  it('fails on the fixture lockfile (lodash 4.17.15, GHSA-p6mc-m468-83gw)', () => {
    const dir = tempDir('osv');
    cpSync(path.join(fixturesDir, 'bun.lock'), path.join(dir, 'bun.lock'));
    const result = runTaskCommand('osv-scanner', dir);
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('lodash');
  });

  it('is not pointed at the fixture lockfile by the real-tree scan', () => {
    const line = securityTask().find((cmd) => cmd.startsWith('osv-scanner')) ?? '';
    expect(line).toContain('--lockfile bun.lock');
    expect(line).not.toContain('security-fixtures');
  });
});
