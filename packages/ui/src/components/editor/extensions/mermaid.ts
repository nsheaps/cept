import type { Attributes } from '@tiptap/core';
import type { FencedBlockEditorPlugin } from './fenced-block.js';
import { createFencedBlockExtension } from './fenced-block.js';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      setMermaid: (attrs?: { source?: string }) => ReturnType;
    };
  }
}

export const defaultMermaidContent = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Cancel]`;

export const mermaidExamples: Record<string, string> = {
  flowchart: `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Cancel]`,
  sequence: `sequenceDiagram
    Alice->>Bob: Hello Bob
    Bob-->>Alice: Hi Alice
    Alice->>Bob: How are you?`,
  classDiagram: `classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Duck : +String beakColor
    Duck : +swim()
    Fish : +int sizeInFeet
    Fish : +canEat()`,
  stateDiagram: `stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,
  erDiagram: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses`,
  gantt: `gantt
    title Project Schedule
    dateFormat YYYY-MM-DD
    section Phase 1
    Design :a1, 2024-01-01, 30d
    Implementation :after a1, 45d
    section Phase 2
    Testing :2024-03-15, 30d`,
  pie: `pie title Distribution
    "A" : 40
    "B" : 30
    "C" : 20
    "D" : 10`,
  journey: `journey
    title My Working Day
    section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me
    section Go home
      Go downstairs: 5: Me
      Sit down: 5: Me`,
  gitgraph: `gitGraph
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
    commit`,
  mindmap: `mindmap
  root((mindmap))
    Origins
      Long history
    Research
      Popularisation
    Tools
      Pen and paper`,
};

/** The part of the `mermaid` package the plugin uses. */
export interface MermaidApi {
  initialize(config: { startOnLoad: boolean; securityLevel: 'strict' }): void;
  render(id: string, text: string): Promise<{ svg: string }>;
}

/**
 * The mermaid fenced-block plugin (EDT-013, D-33): it claims ` ```mermaid `
 * fences and renders them to SVG with the `mermaid` package, imported only
 * when the first diagram is shown (a failed load is retried by the next
 * diagram). A diagram that fails to render shows its
 * source and the error instead. `loadMermaid` is injectable for tests.
 */
export function createMermaidPlugin(
  loadMermaid: () => Promise<MermaidApi> = async () => (await import('mermaid')).default,
): FencedBlockEditorPlugin {
  let nextDiagramId = 0;
  let ready: Promise<MermaidApi> | null = null;
  const load = () => {
    ready ??= loadMermaid()
      .then((mermaid) => {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
        return mermaid;
      })
      .catch((error: unknown) => {
        // Let the next diagram retry a failed load (a flaky chunk, offline).
        ready = null;
        throw error;
      });
    return ready;
  };

  return {
    name: 'mermaid',
    language: 'mermaid',
    defaultSource: defaultMermaidContent,
    claims: (language) => language === 'mermaid',
    render(source, element) {
      let active = true;
      const wrapper = document.createElement('div');
      wrapper.className = 'cept-mermaid';
      const preview = document.createElement('div');
      preview.className = 'cept-mermaid-preview';
      wrapper.append(preview);
      element.append(wrapper);

      load()
        .then((mermaid) => mermaid.render(`cept-mermaid-${nextDiagramId++}`, source))
        .then(({ svg }) => {
          if (active) preview.innerHTML = svg;
        })
        .catch((error: unknown) => {
          if (!active) return;
          const code = document.createElement('pre');
          code.className = 'cept-mermaid-source';
          code.textContent = source;
          const message = document.createElement('div');
          message.className = 'cept-mermaid-error';
          message.textContent = error instanceof Error ? error.message : String(error);
          preview.replaceChildren(code, message);
        });

      return () => {
        active = false;
      };
    },
  };
}

export const mermaidPlugin = createMermaidPlugin();

/** The editor node for mermaid diagrams, saved as a ` ```mermaid ` fence. */
export const Mermaid = createFencedBlockExtension(mermaidPlugin).extend({
  addAttributes() {
    const attributes: Attributes = this.parent?.() ?? {};
    return {
      ...attributes,
      source: {
        ...attributes.source,
        // Pages saved before PR 51 keep the diagram in `data-mermaid`.
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-source') ?? element.getAttribute('data-mermaid') ?? '',
      },
    };
  },

  addCommands() {
    return {
      setMermaid:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { source: attrs?.source ?? defaultMermaidContent },
          }),
    };
  },
});
