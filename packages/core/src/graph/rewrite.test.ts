import { describe, expect, it } from 'vitest';
import { extractDestinations } from './links.js';
import { mapPath, planLinkRewrites, rewriteLinks } from './rewrite.js';

describe('extractDestinations', () => {
  it('locates inline links, images and definitions exactly', () => {
    const md = '---\ntitle: x\n---\n[a](one.md "t") ![i](img/p.png) [r][d]\n\n[d]: <two.md>\n';
    const found = extractDestinations(md).map((d) => [d.url, md.slice(d.start, d.end)]);
    expect(found).toEqual([
      ['one.md', 'one.md'],
      ['img/p.png', 'img/p.png'],
      ['two.md', 'two.md'],
    ]);
  });

  it('skips code, and finds an image inside a link', () => {
    const md = '`[a](x.md)`\n\n```\n[b](y.md)\n```\n\n[![i](p.png)](z.md)\n';
    expect(extractDestinations(md).map((d) => d.url)).toEqual(['z.md', 'p.png']);
  });

  it('leaves out a destination written with escapes', () => {
    expect(extractDestinations('[a](a\\_b.md)')).toEqual([]);
  });
});

describe('mapPath', () => {
  it('maps a file, a folder and what is under it', () => {
    const moved = [{ from: 'a', to: 'x/a' }];
    expect(mapPath('a', moved)).toBe('x/a');
    expect(mapPath('a/b.md', moved)).toBe('x/a/b.md');
    expect(mapPath('ab/b.md', moved)).toBe('ab/b.md');
  });

  it('maps a file page that became a folder page to its index', () => {
    expect(mapPath('a/b.md', [{ from: 'a/b.md', to: 'a/b' }])).toBe('a/b/index.md');
  });
});

describe('rewriteLinks', () => {
  it('points an inbound link at the new name and keeps the anchor and text', () => {
    const r = rewriteLinks('See [Setup](setup.md#install).', 'index.md', 'index.md', [
      { from: 'setup.md', to: 'install.md' },
    ]);
    expect(r).toEqual({ text: 'See [Setup](install.md#install).', count: 1 });
  });

  it('rewrites a moved page’s own relative links and images', () => {
    const r = rewriteLinks(
      '[o](other.md) ![p](img/p.png) [w](https://x.dev/a.md) [h](#top)',
      'a.md',
      'docs/a.md',
      [{ from: 'a.md', to: 'docs/a.md' }],
    );
    expect(r.text).toBe('[o](../other.md) ![p](../img/p.png) [w](https://x.dev/a.md) [h](#top)');
    expect(r.count).toBe(2);
  });

  it('keeps links between two pages that move together, and absolute links absolute', () => {
    const moved = [{ from: 'g', to: 'guides' }];
    const r = rewriteLinks(
      '[s](setup.md) [r](/g/setup.md)',
      'g/index.md',
      'guides/index.md',
      moved,
    );
    expect(r.text).toBe('[s](setup.md) [r](/guides/setup.md)');
  });

  it('encodes spaces in the new path and rewrites a definition once', () => {
    const r = rewriteLinks('[a][d] [b][d]\n\n[d]: old.md', 'i.md', 'i.md', [
      { from: 'old.md', to: 'new name.md' },
    ]);
    expect(r.text).toBe('[a][d] [b][d]\n\n[d]: new%20name.md');
    expect(r.count).toBe(1);
  });

  it('changes nothing when nothing points at the move', () => {
    const r = rewriteLinks('[a](b.md)', 'i.md', 'i.md', [{ from: 'z.md', to: 'y.md' }]);
    expect(r).toEqual({ text: '[a](b.md)', count: 0 });
  });
});

describe('planLinkRewrites', () => {
  it('plans three inbound links across pages, naming the pages after the move', () => {
    const files = new Map([
      ['a.md', 'Go [b](b.md).'],
      ['dir/c.md', '[b](../b.md#x) and [b again](../b.md)'],
      ['d.md', 'No links here.'],
      ['b.md', '[a](a.md)'],
    ]);
    const plan = planLinkRewrites(files, [{ from: 'b.md', to: 'renamed.md' }]);
    expect(plan.map((p) => [p.file, p.newFile, p.count])).toEqual([
      ['a.md', 'a.md', 1],
      ['dir/c.md', 'dir/c.md', 2],
    ]);
    expect(plan[1]!.text).toBe('[b](../renamed.md#x) and [b again](../renamed.md)');
  });
});
