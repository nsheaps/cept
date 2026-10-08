import { describe, expect, it } from 'vitest';
import { findTargetProblems, type ProjectTargets } from './check-targets';

const all = ['build', 'typecheck', 'test:unit'];
const project = (overrides: Partial<ProjectTargets>): ProjectTargets => ({
  name: 'p',
  targets: all,
  skip: {},
  ...overrides,
});

describe('findTargetProblems', () => {
  it('accepts a project with every required target', () => {
    expect(findTargetProblems([project({})])).toEqual([]);
  });

  it('accepts a missing target that is skipped with a reason', () => {
    const p = project({ targets: ['typecheck', 'test:unit'], skip: { build: 'later (D-43)' } });
    expect(findTargetProblems([p])).toEqual([]);
  });

  it('reports each missing target that has no skip marker', () => {
    const p = project({ name: '@cept/docs', targets: ['lint'] });
    expect(findTargetProblems([p])).toEqual([
      '@cept/docs: no "build" target; add one or a cept.skipTargets reason',
      '@cept/docs: no "typecheck" target; add one or a cept.skipTargets reason',
      '@cept/docs: no "test:unit" target; add one or a cept.skipTargets reason',
    ]);
  });

  it('rejects a skip marker with an empty reason', () => {
    const p = project({ targets: ['typecheck', 'test:unit'], skip: { build: ' ' } });
    expect(findTargetProblems([p])).toEqual(['p: cept.skipTargets["build"] needs a reason']);
  });

  it('rejects a skip marker for a target the project defines', () => {
    const p = project({ skip: { build: 'stale' } });
    expect(findTargetProblems([p])).toEqual(['p: skips "build" but also defines it; remove one']);
  });
});
