/**
 * Proves the project graph PR CI relies on: `nx affected` must skip projects a
 * change cannot reach, and must run everything when a root config file changes.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });

const ROOT = path.resolve(__dirname, '../..');

function affected(file: string): string[] {
  const result = spawnSync(
    'bunx',
    ['nx', 'show', 'projects', '--affected', '--json', `--files=${file}`],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, NX_DAEMON: 'false' },
    },
  );
  if (result.status !== 0) throw new Error(`nx show projects failed: ${result.stderr}`);
  return (JSON.parse(result.stdout) as string[]).sort();
}

function allProjects(): string[] {
  const result = spawnSync('bunx', ['nx', 'show', 'projects', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NX_DAEMON: 'false' },
  });
  if (result.status !== 0) throw new Error(`nx show projects failed: ${result.stderr}`);
  return (JSON.parse(result.stdout) as string[]).sort();
}

describe('nx affected', () => {
  it('skips ui when only the signaling server changes', () => {
    const projects = affected('packages/signaling-server/src/index.ts');
    expect(projects).toContain('@cept/signaling');
    expect(projects).not.toContain('@cept/ui');
  });

  it('runs e2e when the web app or anything it renders changes', () => {
    expect(affected('packages/ui/src/index.ts')).toContain('@cept/e2e');
  });

  it('runs the repo-level suites when a package changes', () => {
    expect(affected('packages/core/src/index.ts')).toContain('cept-workspace');
  });

  it.each([
    'nx.json',
    'package.json',
    'bun.lock',
    'bunfig.toml',
    '.mise.toml',
    'tsconfig.json',
    'tsconfig.base.json',
    'vitest.config.ts',
  ])('treats a change to the root config file %s as affecting every project', (file) => {
    expect(affected(file)).toEqual(allProjects());
  });
});
