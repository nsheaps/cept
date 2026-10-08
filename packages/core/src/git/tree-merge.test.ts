import { describe, it, expect } from 'vitest';
import { conflictCopyPath, planMerge } from './tree-merge.js';
import type { FlatTree, MergedFile, TreeFile } from './tree-merge.js';

/** A tiny blob store: oid `blob:<text>`. */
function blobs(...texts: string[]): Record<string, TreeFile> {
  return Object.fromEntries(texts.map((t) => [t, { oid: `blob:${t}`, mode: '100644' }]));
}
const read = async (oid: string) => new TextEncoder().encode(oid.slice('blob:'.length));
const tree = (entries: Record<string, string>): FlatTree =>
  new Map(Object.entries(entries).map(([path, text]) => [path, blobs(text)[text]!]));
const labels = { mine: 'aaaaaaa', theirs: 'bbbbbbb' };

function textOf(file: MergedFile | undefined): string | undefined {
  if (!file) return undefined;
  return 'content' in file ? new TextDecoder().decode(file.content) : file.oid.slice(5);
}

describe('planMerge (REQ-WS-026)', () => {
  it('takes files changed, added or deleted on one side only', async () => {
    const plan = await planMerge({
      base: tree({ 'a.md': 'a', 'b.md': 'b', 'c.md': 'c' }),
      mine: tree({ 'a.md': 'a2', 'b.md': 'b', 'c.md': 'c', 'new.md': 'n' }),
      theirs: tree({ 'a.md': 'a', 'b.md': 'b3' }),
      read,
      labels,
    });
    expect(plan.conflicts).toEqual([]);
    expect([...plan.files.keys()].sort()).toEqual(['a.md', 'b.md', 'new.md']);
    expect(textOf(plan.files.get('a.md'))).toBe('a2');
    expect(textOf(plan.files.get('b.md'))).toBe('b3');
  });

  it('merges a file both sides changed in different places', async () => {
    const plan = await planMerge({
      base: tree({ 'p.md': '---\ntitle: P\n---\none\ntwo\nthree\n' }),
      mine: tree({ 'p.md': '---\ntitle: P\nstatus: done\n---\nONE\ntwo\nthree\n' }),
      theirs: tree({ 'p.md': '---\ntitle: P\ntags: [x]\n---\none\ntwo\nTHREE\n' }),
      read,
      labels,
    });
    expect(plan.conflicts).toEqual([]);
    expect(textOf(plan.files.get('p.md'))).toBe(
      '---\ntitle: P\nstatus: done\ntags: [x]\n---\nONE\ntwo\nTHREE\n',
    );
  });

  it('keeps a mode change from either side when the contents merge', async () => {
    const at = (text: string, mode: string): FlatTree =>
      new Map([['run.sh', { oid: `blob:${text}`, mode }]]);
    const merge = (mineMode: string, theirMode: string) =>
      planMerge({
        base: at('one\ntwo\nthree\n', '100644'),
        mine: at('ONE\ntwo\nthree\n', mineMode),
        theirs: at('one\ntwo\nTHREE\n', theirMode),
        read,
        labels,
      });
    const theirsExec = await merge('100644', '100755');
    expect(theirsExec.conflicts).toEqual([]);
    expect(theirsExec.files.get('run.sh')?.mode).toBe('100755');
    expect(textOf(theirsExec.files.get('run.sh'))).toBe('ONE\ntwo\nTHREE\n');
    expect((await merge('100755', '100644')).files.get('run.sh')?.mode).toBe('100755');
  });

  it('reports overlapping edits as a conflict with both versions and a marked merge', async () => {
    const plan = await planMerge({
      base: tree({ 'p.md': 'line\n' }),
      mine: tree({ 'p.md': 'mine\n' }),
      theirs: tree({ 'p.md': 'theirs\n' }),
      read,
      labels,
    });
    expect(plan.conflicts).toEqual([
      {
        path: 'p.md',
        type: 'content',
        ours: 'mine\n',
        theirs: 'theirs\n',
        base: 'line\n',
        merged: '<<<<<<< mine\nmine\n=======\ntheirs\n>>>>>>> theirs\n',
      },
    ]);
  });

  it('reports a file deleted on one side and changed on the other', async () => {
    const plan = await planMerge({
      base: tree({ 'p.md': 'v1' }),
      mine: tree({}),
      theirs: tree({ 'p.md': 'v2' }),
      read,
      labels,
    });
    expect(plan.conflicts).toMatchObject([
      { path: 'p.md', type: 'delete-modify', ours: null, theirs: 'v2' },
    ]);
  });

  it('keeps the version not chosen as a conflict copy', async () => {
    const input = {
      base: tree({ 'notes/p.md': 'line\n' }),
      mine: tree({ 'notes/p.md': 'mine\n' }),
      theirs: tree({ 'notes/p.md': 'theirs\n' }),
      read,
      labels,
    };
    const keepMine = await planMerge({
      ...input,
      resolutions: [{ path: 'notes/p.md', choice: 'mine' }],
    });
    expect(keepMine.conflicts).toEqual([]);
    expect(textOf(keepMine.files.get('notes/p.md'))).toBe('mine\n');
    const copy = 'notes/p (their version bbbbbbb).md';
    expect(keepMine.copies.get('notes/p.md')).toBe(copy);
    expect(textOf(keepMine.files.get(copy))).toBe('theirs\n');

    const keepTheirs = await planMerge({
      ...input,
      resolutions: [{ path: 'notes/p.md', choice: 'theirs' }],
    });
    expect(textOf(keepTheirs.files.get('notes/p.md'))).toBe('theirs\n');
    expect(textOf(keepTheirs.files.get('notes/p (my version aaaaaaa).md'))).toBe('mine\n');
  });

  it('takes merged content, but never one that still holds conflict markers', async () => {
    const input = {
      base: tree({ 'p.md': 'line\n' }),
      mine: tree({ 'p.md': 'mine\n' }),
      theirs: tree({ 'p.md': 'theirs\n' }),
      read,
      labels,
    };
    const merged = await planMerge({
      ...input,
      resolutions: [{ path: 'p.md', choice: 'merged', content: 'mine and theirs\n' }],
    });
    expect(merged.conflicts).toEqual([]);
    expect(textOf(merged.files.get('p.md'))).toBe('mine and theirs\n');
    expect(merged.copies.size).toBe(0);

    const marked = await planMerge({
      ...input,
      resolutions: [
        {
          path: 'p.md',
          choice: 'merged',
          content: '<<<<<<< mine\nx\n=======\ny\n>>>>>>> theirs\n',
        },
      ],
    });
    expect(marked.conflicts.map((c) => c.path)).toEqual(['p.md']);
  });

  it('deletes a file when the deleting side is chosen', async () => {
    const plan = await planMerge({
      base: tree({ 'p.md': 'v1' }),
      mine: tree({}),
      theirs: tree({ 'p.md': 'v2' }),
      read,
      labels,
      resolutions: [{ path: 'p.md', choice: 'mine' }],
    });
    expect(plan.conflicts).toEqual([]);
    expect(plan.files.has('p.md')).toBe(false);
  });

  it('treats binary files changed on both sides as a conflict without a merge', async () => {
    const binary = (oid: string): FlatTree => new Map([['img.png', { oid, mode: '100644' }]]);
    const bytes: Record<string, Uint8Array> = {
      base: new Uint8Array([0, 1]),
      mine: new Uint8Array([0, 2]),
      theirs: new Uint8Array([0, 3]),
    };
    const plan = await planMerge({
      base: binary('base'),
      mine: binary('mine'),
      theirs: binary('theirs'),
      read: async (oid) => bytes[oid]!,
      labels,
    });
    expect(plan.conflicts).toMatchObject([{ path: 'img.png', binary: true }]);
    expect(plan.conflicts[0]!.merged).toBeUndefined();
  });
});

describe('conflictCopyPath', () => {
  it('numbers a copy whose name is taken', () => {
    const taken = new Set(['a/p (their version x).md']);
    expect(conflictCopyPath('a/p.md', 'their version x', (p) => taken.has(p))).toBe(
      'a/p (their version x 2).md',
    );
    expect(conflictCopyPath('README', 'my version y', () => false)).toBe('README (my version y)');
  });
});
