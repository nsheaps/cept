import { describe, it, expect } from 'vitest';
import {
  parseConflictMarkers,
  threeWayMerge,
  autoResolve,
} from './merge-engine.js';
import type { MergeConflict } from './merge-engine.js';

describe('parseConflictMarkers', () => {
  it('detects no conflicts in clean content', () => {
    const result = parseConflictMarkers('Hello\nWorld\n');
    expect(result.hasConflicts).toBe(false);
    expect(result.sections).toHaveLength(0);
  });

  it('parses a single conflict', () => {
    const content = `line1
<<<<<<< ours
our change
=======
their change
>>>>>>> theirs
line3
`;
    const result = parseConflictMarkers(content);
    expect(result.hasConflicts).toBe(true);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].ours).toBe('our change\n');
    expect(result.sections[0].theirs).toBe('their change\n');
  });

  it('parses multiple conflicts', () => {
    const content = `start
<<<<<<< ours
a
=======
b
>>>>>>> theirs
middle
<<<<<<< ours
c
=======
d
>>>>>>> theirs
end
`;
    const result = parseConflictMarkers(content);
    expect(result.hasConflicts).toBe(true);
    expect(result.sections).toHaveLength(2);
  });

  it('parses diff3 style with base', () => {
    const content = `<<<<<<< ours
our version
||||||| base
original
=======
their version
>>>>>>> theirs
`;
    const result = parseConflictMarkers(content);
    expect(result.hasConflicts).toBe(true);
    expect(result.sections[0].ours).toBe('our version\n');
    expect(result.sections[0].base).toBe('original\n');
    expect(result.sections[0].theirs).toBe('their version\n');
  });
});

describe('threeWayMerge', () => {
  it('merges identical files', () => {
    const result = threeWayMerge('a\nb\nc', 'a\nb\nc', 'a\nb\nc');
    expect(result.hasConflicts).toBe(false);
    expect(result.merged).toBe('a\nb\nc');
  });

  it('takes our changes when theirs matches base', () => {
    const result = threeWayMerge('a\nb\nc', 'a\nB\nc', 'a\nb\nc');
    expect(result.hasConflicts).toBe(false);
    expect(result.merged).toBe('a\nB\nc');
  });

  it('takes their changes when ours matches base', () => {
    const result = threeWayMerge('a\nb\nc', 'a\nb\nc', 'a\nB\nc');
    expect(result.hasConflicts).toBe(false);
    expect(result.merged).toBe('a\nB\nc');
  });

  it('detects conflict when both sides change differently', () => {
    const result = threeWayMerge('a\nb\nc', 'a\nX\nc', 'a\nY\nc');
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts).toBe(1);
    expect(result.merged).toContain('<<<<<<< ours');
    expect(result.merged).toContain('X');
    expect(result.merged).toContain('Y');
    expect(result.merged).toContain('>>>>>>> theirs');
  });

  it('no conflict when both sides make same change', () => {
    const result = threeWayMerge('a\nb\nc', 'a\nX\nc', 'a\nX\nc');
    expect(result.hasConflicts).toBe(false);
    expect(result.merged).toBe('a\nX\nc');
  });

  it('handles files of different lengths', () => {
    const result = threeWayMerge('a\nb', 'a\nb\nc', 'a\nb');
    expect(result.hasConflicts).toBe(false);
    expect(result.merged).toBe('a\nb\nc');
  });

  it('handles empty base', () => {
    const result = threeWayMerge('', 'a', 'b');
    expect(result.hasConflicts).toBe(true);
  });
});

describe('autoResolve', () => {
  it('handles empty conflicts array', () => {
    const result = autoResolve([]);
    expect(result.fullyResolved).toBe(true);
    expect(result.autoResolved).toHaveLength(0);
    expect(result.manualConflicts).toHaveLength(0);
  });

  it('auto-resolves delete-modify with theirs strategy (default)', () => {
    const conflicts: MergeConflict[] = [{
      path: 'test.md',
      type: 'delete-modify',
      ours: null,
      theirs: 'modified content',
      base: 'original',
    }];
    const result = autoResolve(conflicts);
    expect(result.fullyResolved).toBe(true);
    expect(result.autoResolved[0].strategy).toBe('theirs');
    expect(result.autoResolved[0].resolvedContent).toBe('modified content');
  });

  it('auto-resolves delete-modify with ours strategy', () => {
    const conflicts: MergeConflict[] = [{
      path: 'test.md',
      type: 'delete-modify',
      ours: null,
      theirs: 'modified',
      base: 'original',
    }];
    const result = autoResolve(conflicts, { deleteModifyStrategy: 'ours' });
    expect(result.autoResolved[0].strategy).toBe('ours');
    expect(result.autoResolved[0].resolvedContent).toBe('');
  });

  it('auto-resolves add-add by merging (default)', () => {
    const conflicts: MergeConflict[] = [{
      path: 'new.md',
      type: 'add-add',
      ours: 'our content',
      theirs: 'their content',
      base: null,
    }];
    const result = autoResolve(conflicts);
    expect(result.fullyResolved).toBe(true);
    expect(result.autoResolved[0].strategy).toBe('merge');
    expect(result.autoResolved[0].resolvedContent).toContain('our content');
    expect(result.autoResolved[0].resolvedContent).toContain('their content');
  });

  it('auto-resolves add-add with ours strategy', () => {
    const conflicts: MergeConflict[] = [{
      path: 'new.md',
      type: 'add-add',
      ours: 'our content',
      theirs: 'their content',
      base: null,
    }];
    const result = autoResolve(conflicts, { addAddStrategy: 'ours' });
    expect(result.autoResolved[0].resolvedContent).toBe('our content');
  });

  it('auto-resolves content conflict with three-way merge', () => {
    const conflicts: MergeConflict[] = [{
      path: 'page.md',
      type: 'content',
      ours: 'a\nX\nc',
      theirs: 'a\nb\nY',
      base: 'a\nb\nc',
    }];
    const result = autoResolve(conflicts);
    expect(result.fullyResolved).toBe(true);
    expect(result.autoResolved[0].resolvedContent).toBe('a\nX\nY');
  });

  it('reports manual conflict when three-way merge fails', () => {
    const conflicts: MergeConflict[] = [{
      path: 'page.md',
      type: 'content',
      ours: 'a\nX\nc',
      theirs: 'a\nY\nc',
      base: 'a\nb\nc',
    }];
    const result = autoResolve(conflicts);
    expect(result.fullyResolved).toBe(false);
    expect(result.manualConflicts).toHaveLength(1);
    expect(result.manualConflicts[0].path).toBe('page.md');
  });

  it('uses ours strategy for all content conflicts', () => {
    const conflicts: MergeConflict[] = [{
      path: 'page.md',
      type: 'content',
      ours: 'our version',
      theirs: 'their version',
      base: 'base',
    }];
    const result = autoResolve(conflicts, { defaultStrategy: 'ours' });
    expect(result.fullyResolved).toBe(true);
    expect(result.autoResolved[0].resolvedContent).toBe('our version');
  });

  it('uses theirs strategy for all content conflicts', () => {
    const conflicts: MergeConflict[] = [{
      path: 'page.md',
      type: 'content',
      ours: 'our version',
      theirs: 'their version',
      base: 'base',
    }];
    const result = autoResolve(conflicts, { defaultStrategy: 'theirs' });
    expect(result.fullyResolved).toBe(true);
    expect(result.autoResolved[0].resolvedContent).toBe('their version');
  });

  it('applies pattern-specific strategy', () => {
    const conflicts: MergeConflict[] = [
      {
        path: 'config.yaml',
        type: 'content',
        ours: 'our config',
        theirs: 'their config',
        base: 'base config',
      },
      {
        path: 'pages/doc.md',
        type: 'content',
        ours: 'a\nX\nc',
        theirs: 'a\nY\nc',
        base: 'a\nb\nc',
      },
    ];
    const result = autoResolve(conflicts, {
      patternStrategies: [
        { pattern: '.yaml', strategy: 'ours' },
      ],
    });
    expect(result.autoResolved).toHaveLength(1);
    expect(result.autoResolved[0].path).toBe('config.yaml');
    expect(result.autoResolved[0].strategy).toBe('ours');
    expect(result.manualConflicts).toHaveLength(1);
    expect(result.manualConflicts[0].path).toBe('pages/doc.md');
  });

  it('handles content conflict without base (manual)', () => {
    const conflicts: MergeConflict[] = [{
      path: 'page.md',
      type: 'content',
      ours: 'our version',
      theirs: 'their version',
      base: null,
    }];
    const result = autoResolve(conflicts);
    expect(result.fullyResolved).toBe(false);
    expect(result.manualConflicts).toHaveLength(1);
  });

  it('resolves mixed conflicts', () => {
    const conflicts: MergeConflict[] = [
      {
        path: 'deleted.md',
        type: 'delete-modify',
        ours: null,
        theirs: 'kept',
        base: 'original',
      },
      {
        path: 'both-added.md',
        type: 'add-add',
        ours: 'a',
        theirs: 'b',
        base: null,
      },
      {
        path: 'conflict.md',
        type: 'content',
        ours: 'X',
        theirs: 'Y',
        base: 'Z',
      },
    ];
    const result = autoResolve(conflicts);
    expect(result.autoResolved).toHaveLength(2);
    expect(result.manualConflicts).toHaveLength(1);
    expect(result.manualConflicts[0].path).toBe('conflict.md');
  });
});
