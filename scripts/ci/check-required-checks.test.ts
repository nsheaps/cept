import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { findProblems, GITHUB_ACTIONS_APP_ID, requiredContexts } from './check-required-checks';

const check = (context: string) => ({ context, integration_id: GITHUB_ACTIONS_APP_ID });
const ruleset = (enforcement: string, contexts: string[]) => ({
  rulesets: [
    {
      name: 'require-checks',
      enforcement,
      rules: [
        {
          type: 'required_status_checks',
          parameters: { required_status_checks: contexts.map(check) },
        },
      ],
    },
  ],
});

describe('requiredContexts', () => {
  it('reads the checks of an active require-checks ruleset', () => {
    expect(requiredContexts(ruleset('active', ['lint / Lint']))).toEqual([check('lint / Lint')]);
  });

  it('requires nothing when the ruleset is missing', () => {
    expect(requiredContexts({ rulesets: [] })).toEqual([]);
  });

  it.each(['evaluate', 'disabled'])('rejects a ruleset with enforcement %s', (enforcement) => {
    expect(() => requiredContexts(ruleset(enforcement, ['lint / Lint']))).toThrow(
      `require-checks ruleset must be enforcement: active (got ${enforcement})`,
    );
  });
});

describe('findProblems', () => {
  it('passes when the required checks match the CI jobs', () => {
    expect(findProblems(['lint / Lint'], [check('lint / Lint')])).toEqual([]);
  });

  it('flags a CI job that is not required', () => {
    expect(findProblems(['lint / Lint', 'build / Build'], [check('lint / Lint')])).toEqual([
      '"build / Build" is not a required check',
    ]);
  });

  it('flags a required check that no job reports', () => {
    expect(findProblems([], [check('lint')])).toEqual(['"lint" is required but no job reports it']);
  });

  it('flags a check required from another App', () => {
    expect(findProblems(['lint / Lint'], [{ context: 'lint / Lint', integration_id: 1 }])).toEqual([
      `"lint / Lint" must use integration_id ${GITHUB_ACTIONS_APP_ID}`,
    ]);
  });
});

describe('check-required-checks CLI', () => {
  const ROOT = path.resolve(__dirname, '../..');
  const dir = mkdtempSync(path.join(tmpdir(), 'required-checks-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const run = (root: string) =>
    spawnSync('bun', [path.resolve(__dirname, 'check-required-checks.ts'), root], {
      encoding: 'utf8',
    });

  it('passes on this repository', () => {
    const result = run(ROOT);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('fails when a CI job is renamed without updating the required checks', () => {
    cpSync(path.join(ROOT, '.github'), path.join(dir, '.github'), { recursive: true });
    const build = path.join(dir, '.github/workflows/_build.yml');
    writeFileSync(
      build,
      readFileSync(build, 'utf8').replace('    name: Build\n', '    name: Compile\n'),
    );
    const result = run(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('"build / Compile" is not a required check');
    expect(result.stderr).toContain('"build / Build" is required but no job reports it');
  });

  it('fails when a new CI job is added without making it a required check', () => {
    const added = mkdtempSync(path.join(tmpdir(), 'required-checks-added-'));
    try {
      cpSync(path.join(ROOT, '.github'), path.join(added, '.github'), { recursive: true });
      const ci = path.join(added, '.github/workflows/ci.yml');
      writeFileSync(
        ci,
        readFileSync(ci, 'utf8').replace(
          '  screenshots:\n',
          '  lint-again:\n    uses: ./.github/workflows/_lint.yml\n\n  screenshots:\n',
        ),
      );
      const result = run(added);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('"lint-again / Lint" is not a required check');
    } finally {
      rmSync(added, { recursive: true, force: true });
    }
  });
});
