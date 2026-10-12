import { describe, it, expect } from 'vitest';
import { MemoryBackend } from '../storage/memory.js';
import { backlinksOf, buildLinkGraph, readLinkGraph, type LinkGraphPage } from './link-graph.js';

const page = (file: string, markdown: string, id = file): LinkGraphPage => ({ id, file, markdown });

describe('buildLinkGraph', () => {
  const pages = [
    page('README.md', '# Home\n\n[Setup](guides/setup.md) [Setup again](guides/setup.md#install)'),
    page('guides/setup.md', '# Setup\n\n[Home](../README.md) [Self](#install) [Gone](missing.md)'),
    page('guides/other.md', '# Other\n\n[Setup][s]\n\n[s]: setup.md\n'),
  ];
  const { graph, references } = buildLinkGraph(pages);

  it('makes a node per page with its title and top-level folder as group', () => {
    expect(graph.nodes.filter((n) => !n.unresolved)).toEqual([
      { id: 'README.md', title: 'Home' },
      { id: 'guides/setup.md', title: 'Setup', group: 'guides' },
      { id: 'guides/other.md', title: 'Other', group: 'guides' },
    ]);
  });

  it('makes one link edge per linked pair, and none for same-page anchors', () => {
    expect(graph.links).toEqual([
      { source: 'README.md', target: 'guides/setup.md', type: 'link' },
      { source: 'guides/setup.md', target: 'README.md', type: 'link' },
      { source: 'guides/setup.md', target: 'guides/missing.md', type: 'link' },
      { source: 'guides/other.md', target: 'guides/setup.md', type: 'link' },
    ]);
  });

  it('adds an unresolved node for a dead link', () => {
    expect(graph.nodes.find((n) => n.unresolved)).toEqual({
      id: 'guides/missing.md',
      title: 'missing',
      unresolved: true,
    });
  });

  it('records every reference with anchor, text, offsets and dead state', () => {
    const toSetup = references.filter((r) => r.target === 'guides/setup.md');
    expect(toSetup.map((r) => [r.source, r.anchor])).toEqual([
      ['README.md', undefined],
      ['README.md', 'install'],
      ['guides/other.md', undefined],
    ]);
    const first = references[0]!;
    expect(pages[0]!.markdown.slice(first.start, first.end)).toBe('[Setup](guides/setup.md)');
    expect(references.find((r) => r.unresolved)?.target).toBe('guides/missing.md');
  });

  it('lists the pages that link to a page, once each', () => {
    const g = buildLinkGraph(pages);
    expect(backlinksOf(g, 'guides/setup.md')).toEqual(['README.md', 'guides/other.md']);
    expect(backlinksOf(g, 'guides/other.md')).toEqual([]);
  });

  it('drops links to hidden paths instead of showing them dead', () => {
    const g = buildLinkGraph([page('a.md', '[x](.secret.md) [y](.git/x.md) [z](b.md)')]);
    expect(g.references.map((r) => r.target)).toEqual(['b.md']);
  });

  it('uses folder-page ids for targets', () => {
    const g = buildLinkGraph([
      page('README.md', '[Guides](guides/index.md)'),
      page('guides/index.md', '# Guides', 'guides'),
    ]);
    expect(g.graph.links).toEqual([{ source: 'README.md', target: 'guides', type: 'link' }]);
  });
});

describe('readLinkGraph', () => {
  const enc = new TextEncoder();
  async function space(files: Record<string, string>): Promise<MemoryBackend> {
    const backend = new MemoryBackend();
    for (const [path, text] of Object.entries(files))
      await backend.writeFile(path, enc.encode(text));
    return backend;
  }

  it('reads the space and treats links to ignored files as hidden, missing ones as dead', async () => {
    const backend = await space({
      'space.cept.yaml': 'version: "1"\nname: Notes\nslug: notes\n',
      '.cept.yaml': 'ignore:\n  - drafts/\n',
      'README.md': '# Home\n\n[A](a.md) [Draft](drafts/d.md) [Nope](nope.md)',
      'a.md': '# A\n\n[Home](README.md)',
      'drafts/d.md': '# Draft',
    });
    // The root page's id is the empty string, like the space tree's root.
    const { graph, references } = await readLinkGraph(backend);
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(['', 'a.md', 'nope.md']);
    expect(references.map((r) => `${r.source}>${r.target}`).sort()).toEqual([
      '>a.md',
      '>nope.md',
      'a.md>',
    ]);
  });
});
