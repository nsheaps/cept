import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  claimFencedBlocks,
  parseMarkdownDocument,
  releaseFencedBlocks,
  serializeMarkdownDocument,
} from '@cept/core';
import type { PmNode } from '@cept/core';
import {
  Mermaid,
  createMermaidPlugin,
  defaultMermaidContent,
  mermaidExamples,
  mermaidPlugin,
  type MermaidApi,
} from './mermaid.js';

/** A stand-in for the `mermaid` package: jsdom cannot lay out real diagrams. */
function fakeMermaid(render: MermaidApi['render']) {
  const calls = { initialize: 0, load: 0 };
  const api: MermaidApi = {
    initialize: () => {
      calls.initialize++;
    },
    render,
  };
  const plugin = createMermaidPlugin(async () => {
    calls.load++;
    return api;
  });
  return { plugin, calls };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function editorWith(doc: PmNode) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, Mermaid],
    content: doc,
  });
}

describe('Mermaid extension', () => {
  it('is an atom block node named mermaid', () => {
    expect(Mermaid.name).toBe('mermaid');
    expect(Mermaid.config.group).toBe('block');
    expect(Mermaid.config.atom).toBe(true);
  });

  it('claims mermaid fences only', () => {
    expect(mermaidPlugin.claims('mermaid', null)).toBe(true);
    expect(mermaidPlugin.claims('python', null)).toBe(false);
  });

  it('inserts the default diagram with setMermaid', () => {
    const editor = editorWith({ type: 'doc', content: [{ type: 'paragraph' }] });
    editor.commands.setMermaid();
    const block = (editor.getJSON() as PmNode).content?.find((node) => node.type === 'mermaid');
    expect(block?.attrs).toMatchObject({ language: 'mermaid', source: defaultMermaidContent });
    editor.destroy();
  });

  it('reads the diagram from HTML saved before the plugin (data-mermaid)', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, Mermaid],
      content: '<div data-type="mermaid" data-mermaid="graph LR\n  X --> Y"></div>',
    });
    const block = (editor.getJSON() as PmNode).content?.[0];
    expect(block?.attrs?.source).toBe('graph LR\n  X --> Y');
    editor.destroy();
  });

  it('loads a mermaid fence from Markdown and saves it back unchanged', () => {
    const markdown = 'Before\n\n```mermaid\ngraph TD\n  A --> B\n```\n\nAfter\n';
    const parsed = parseMarkdownDocument(markdown);
    const editor = editorWith(claimFencedBlocks(parsed.doc, [mermaidPlugin]));
    expect(editor.view.dom.querySelector('[data-type="mermaid"] .cept-mermaid')).not.toBeNull();
    const saved = releaseFencedBlocks(editor.getJSON() as PmNode, [mermaidPlugin]);
    expect(serializeMarkdownDocument(saved, parsed)).toBe(markdown);
    editor.destroy();
  });
});

describe('createMermaidPlugin', () => {
  it('renders the diagram to SVG, loading mermaid once', async () => {
    const { plugin, calls } = fakeMermaid(async (id, text) => ({
      svg: `<svg id="${id}"><text>${text}</text></svg>`,
    }));
    const first = document.createElement('div');
    const second = document.createElement('div');
    plugin.render('graph TD\n  A --> B', first, { language: 'mermaid', meta: null });
    plugin.render('pie', second, { language: 'mermaid', meta: null });
    await settle();
    expect(first.querySelector('.cept-mermaid-preview svg')?.textContent).toBe(
      'graph TD\n  A --> B',
    );
    expect(second.querySelector('svg')).not.toBeNull();
    expect(calls).toEqual({ initialize: 1, load: 1 });
  });

  it('shows the source and the error when a diagram does not parse', async () => {
    const { plugin } = fakeMermaid(async () => {
      throw new Error('Parse error on line 1');
    });
    const element = document.createElement('div');
    plugin.render('not a diagram', element, { language: 'mermaid', meta: null });
    await settle();
    expect(element.querySelector('.cept-mermaid-source')?.textContent).toBe('not a diagram');
    expect(element.querySelector('.cept-mermaid-error')?.textContent).toBe('Parse error on line 1');
  });

  it('retries loading mermaid after a failed load', async () => {
    let attempts = 0;
    const plugin = createMermaidPlugin(async () => {
      attempts++;
      if (attempts === 1) throw new Error('chunk failed to load');
      return { initialize: () => undefined, render: async () => ({ svg: '<svg></svg>' }) };
    });
    const first = document.createElement('div');
    plugin.render('graph TD', first, { language: 'mermaid', meta: null });
    await settle();
    expect(first.querySelector('.cept-mermaid-error')?.textContent).toBe('chunk failed to load');

    const second = document.createElement('div');
    plugin.render('graph TD', second, { language: 'mermaid', meta: null });
    await settle();
    expect(second.querySelector('svg')).not.toBeNull();
    expect(attempts).toBe(2);
  });

  it('drops a render that finishes after cleanup', async () => {
    const { plugin } = fakeMermaid(async () => ({ svg: '<svg></svg>' }));
    const element = document.createElement('div');
    const cleanup = plugin.render('graph TD', element, { language: 'mermaid', meta: null });
    if (typeof cleanup === 'function') cleanup();
    await settle();
    expect(element.querySelector('svg')).toBeNull();
  });
});

describe('defaultMermaidContent', () => {
  it('is a valid flowchart', () => {
    expect(defaultMermaidContent).toContain('graph TD');
    expect(defaultMermaidContent).toContain('-->');
  });
});

describe('mermaidExamples', () => {
  it('has flowchart example', () => {
    expect(mermaidExamples.flowchart).toContain('graph TD');
  });

  it('has sequence diagram example', () => {
    expect(mermaidExamples.sequence).toContain('sequenceDiagram');
  });

  it('has class diagram example', () => {
    expect(mermaidExamples.classDiagram).toContain('classDiagram');
  });

  it('has state diagram example', () => {
    expect(mermaidExamples.stateDiagram).toContain('stateDiagram');
  });

  it('has ER diagram example', () => {
    expect(mermaidExamples.erDiagram).toContain('erDiagram');
  });

  it('has Gantt chart example', () => {
    expect(mermaidExamples.gantt).toContain('gantt');
  });

  it('has pie chart example', () => {
    expect(mermaidExamples.pie).toContain('pie');
  });

  it('has journey example', () => {
    expect(mermaidExamples.journey).toContain('journey');
  });

  it('has git graph example', () => {
    expect(mermaidExamples.gitgraph).toContain('gitGraph');
  });

  it('has mindmap example', () => {
    expect(mermaidExamples.mindmap).toContain('mindmap');
  });

  it('has at least 10 diagram types', () => {
    expect(Object.keys(mermaidExamples).length).toBeGreaterThanOrEqual(10);
  });
});
