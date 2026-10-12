import { describe, it, expect, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  claimFencedBlocks,
  parseMarkdownDocument,
  releaseFencedBlocks,
  serializeMarkdownDocument,
} from '@cept/core';
import type { PmNode } from '@cept/core';
import { GraphBlock, graphBlockPlugin, parseGraphBlock } from './graph-block.js';

const fixture = JSON.stringify(
  {
    nodes: [
      { id: 'a', title: 'Alpha' },
      { id: 'b', title: 'Beta' },
    ],
    links: [{ source: 'a', target: 'b', type: 'link' }],
  },
  null,
  2,
);

describe('parseGraphBlock', () => {
  it('reads nodes and links', () => {
    const data = parseGraphBlock(fixture);
    expect(data.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(data.links).toEqual([{ source: 'a', target: 'b', type: 'link' }]);
  });

  it('defaults a missing link type and missing links', () => {
    const data = parseGraphBlock(
      '{"nodes":[{"id":"a","title":"A"},{"id":"b","title":"B"}],"links":[{"source":"a","target":"b"}]}',
    );
    expect(data.links[0]?.type).toBe('link');
    expect(parseGraphBlock('{"nodes":[{"id":"a","title":"A"}]}').links).toEqual([]);
  });

  it('rejects invalid JSON, a missing node list and links to unknown nodes', () => {
    expect(() => parseGraphBlock('not json')).toThrow(/JSON/);
    expect(() => parseGraphBlock('{}')).toThrow(/nodes/);
    expect(() => parseGraphBlock('{"nodes":[{"id":"a"}]}')).toThrow(/title/);
    expect(() => parseGraphBlock('{"nodes":[{"id":"a","title":""}]}')).toThrow(/title/);
    expect(() =>
      parseGraphBlock('{"nodes":[{"id":"a","title":"A"},{"id":"a","title":"B"}]}'),
    ).toThrow(/Duplicate node id "a"/);
    expect(() =>
      parseGraphBlock('{"nodes":[{"id":"a","title":"A"}],"links":[{"source":"a","target":"z"}]}'),
    ).toThrow(/unknown node "z"/);
  });
});

describe('graph fenced block', () => {
  it('claims graph fences only', () => {
    expect(graphBlockPlugin.claims('graph', null)).toBe(true);
    expect(graphBlockPlugin.claims('mermaid', null)).toBe(false);
  });

  it('round-trips through the page pipeline unchanged', () => {
    const markdown = `Intro\n\n\`\`\`graph\n${fixture}\n\`\`\`\n\nOutro\n`;
    const parsed = parseMarkdownDocument(markdown);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, GraphBlock],
      content: claimFencedBlocks(parsed.doc, [graphBlockPlugin]),
    });
    expect(editor.view.dom.querySelector('[data-type="graph"]')).not.toBeNull();
    const saved = releaseFencedBlocks(editor.getJSON() as PmNode, [graphBlockPlugin]);
    expect(serializeMarkdownDocument(saved, parsed)).toBe(markdown);
    editor.destroy();
  });

  it('renders the graph view for valid source and the error for invalid source', async () => {
    const valid = document.createElement('div');
    const cleanup = graphBlockPlugin.render(fixture, valid, { language: 'graph', meta: null });
    await vi.waitFor(() =>
      expect(valid.querySelector('[data-testid="knowledge-graph-view"]')).not.toBeNull(),
    );
    cleanup?.();

    const invalid = document.createElement('div');
    graphBlockPlugin.render('nope', invalid, { language: 'graph', meta: null });
    expect(invalid.querySelector('.cept-graph-error')?.textContent).toMatch(/JSON/);
    expect(invalid.querySelector('.cept-graph-source')?.textContent).toBe('nope');
  });

  it('is an atom block node named graph', () => {
    expect(GraphBlock.name).toBe('graph');
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, GraphBlock],
    });
    expect(editor.schema.nodes.graph).toBeDefined();
    editor.destroy();
  });
});
