import { describe, it, expect } from 'vitest';
import { Mermaid, defaultMermaidContent, mermaidExamples } from './mermaid.js';

describe('Mermaid extension', () => {
  it('has the correct name', () => {
    expect(Mermaid.name).toBe('mermaid');
  });

  it('is a block node', () => {
    expect(Mermaid.config.group).toBe('block');
  });

  it('is an atom node', () => {
    expect(Mermaid.config.atom).toBe(true);
  });

  it('has default content attribute', () => {
    const attrs = Mermaid.config.addAttributes?.call(Mermaid);
    expect(attrs).toBeDefined();
    if (attrs) {
      expect((attrs as Record<string, { default: string }>).content.default).toBe(
        defaultMermaidContent,
      );
    }
  });

  it('parses div[data-type="mermaid"]', () => {
    const parseRules = Mermaid.config.parseHTML?.call(Mermaid);
    expect(parseRules).toEqual([{ tag: 'div[data-type="mermaid"]' }]);
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
