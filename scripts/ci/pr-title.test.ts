import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_LENGTH, checkPrTitle, releaseTypes } from './pr-title';

const root = path.resolve(__dirname, '../..');
const types = releaseTypes(readFileSync(path.join(root, '.release-it.json'), 'utf8'));

describe('checkPrTitle', () => {
  it.each([
    'feat: add comments',
    'fix(editor): keep the caret after paste',
    'ci(security): add gitleaks and osv-scanner job',
    'build(mise): pin tools exactly and add mise tasks',
    'style: format the repo with prettier',
    'refactor(core)!: drop the database engine',
    'feat!: require a space marker',
    'chore(deps): update dependency nx to v23.2.1 [security]',
    'fix(deps): update dependency @anthropic-ai/sdk to v0.124.0',
    'revert: feat: add comments',
    'docs(specs/requirements): record D-50',
  ])('accepts %j', (title) => {
    expect(checkPrTitle(title, types)).toEqual({ ok: true });
  });

  it.each([
    ['Add comments', 'type(scope): subject'],
    ['feat add comments', 'type(scope): subject'],
    ['feat:add comments', 'type(scope): subject'],
    ['Feat: add comments', 'type(scope): subject'],
    ['[sync] Update dispatch-review.yaml', 'type(scope): subject'],
    ['feature: add comments', 'type "feature" is not one of'],
    ['wip: add comments', 'type "wip" is not one of'],
    ['feat(Editor): add comments', 'scope "Editor"'],
    ['feat(): add comments', 'scope ""'],
    ['feat(a b): add comments', 'scope "a b"'],
    ['feat: ', 'subject must be non-empty'],
    ['feat:  add comments', 'subject must be non-empty'],
    ['feat: add comments ', 'subject must be non-empty'],
    [`feat: ${'x'.repeat(MAX_LENGTH)}`, 'the limit is'],
  ])('rejects %j', (title, reason) => {
    const result = checkPrTitle(title, types);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toContain(reason);
  });
});

describe('releaseTypes', () => {
  it('reads the conventional-changelog types, including build, style and revert', () => {
    expect(types).toEqual(
      expect.arrayContaining(['feat', 'fix', 'ci', 'build', 'style', 'revert']),
    );
  });

  it('throws when the config lists no types', () => {
    expect(() => releaseTypes('{"plugins":{}}')).toThrow('lists no conventional-changelog types');
  });
});

describe('pr-title CLI', () => {
  const run = (title: string) =>
    spawnSync('bun', [path.join(root, 'scripts/ci/pr-title.ts')], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PR_TITLE: title },
    });

  it('passes a valid title and fails a bad one with a GitHub annotation', () => {
    expect(run('ci: check pr titles are conventional commits').status).toBe(0);
    const bad = run('Update stuff');
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('::error title=PR title::');
  });
});
