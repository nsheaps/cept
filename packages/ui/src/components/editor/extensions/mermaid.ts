import { Node, mergeAttributes } from '@tiptap/core';

export interface MermaidOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      setMermaid: (attrs?: { content?: string }) => ReturnType;
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

export const Mermaid = Node.create<MermaidOptions>({
  name: 'mermaid',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      content: {
        default: defaultMermaidContent,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-mermaid') ?? defaultMermaidContent,
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-mermaid': attributes.content as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaid"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, string>;
    const content = attrs['data-mermaid'] || defaultMermaidContent;

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, attrs, {
        'data-type': 'mermaid',
        class: 'cept-mermaid',
      }),
      ['pre', { class: 'cept-mermaid-source' }, content],
      ['div', { class: 'cept-mermaid-preview' }],
    ] as const;
  },

  addCommands() {
    return {
      setMermaid:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { content: attrs?.content ?? defaultMermaidContent },
          });
        },
    };
  },
});
