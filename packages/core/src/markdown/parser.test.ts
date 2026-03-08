import { describe, it, expect, beforeEach } from 'vitest';
import { CeptMarkdownParser } from './parser.js';

describe('CeptMarkdownParser', () => {
  let parser: CeptMarkdownParser;

  beforeEach(() => {
    parser = new CeptMarkdownParser();
  });

  describe('parseFrontMatter', () => {
    it('should parse YAML front matter', () => {
      const md = `---
id: "page-001"
title: "Test Page"
icon: "📝"
created: "2026-01-01T00:00:00Z"
modified: "2026-01-02T00:00:00Z"
tags:
  - test
  - demo
properties: {}
---

# Test Page
`;

      const meta = parser.parseFrontMatter(md);
      expect(meta.id).toBe('page-001');
      expect(meta.title).toBe('Test Page');
      expect(meta.icon).toBe('📝');
      expect(meta.created).toBe('2026-01-01T00:00:00Z');
      expect(meta.tags).toEqual(['test', 'demo']);
    });

    it('should handle missing front matter', () => {
      const md = '# No Front Matter\n\nJust content.';
      const meta = parser.parseFrontMatter(md);
      expect(meta.id).toBe('');
      expect(meta.title).toBe('');
      expect(meta.tags).toEqual([]);
    });

    it('should handle optional fields', () => {
      const md = `---
id: "p1"
title: "Minimal"
created: "2026-01-01T00:00:00Z"
modified: "2026-01-01T00:00:00Z"
tags: []
properties: {}
---
`;
      const meta = parser.parseFrontMatter(md);
      expect(meta.id).toBe('p1');
      expect(meta.icon).toBeUndefined();
      expect(meta.cover).toBeUndefined();
      expect(meta.parent).toBeUndefined();
      expect(meta.locked).toBeUndefined();
    });
  });

  describe('serializeFrontMatter', () => {
    it('should serialize front matter to YAML', () => {
      const meta = {
        id: 'page-001',
        title: 'Test Page',
        icon: '📝',
        created: '2026-01-01T00:00:00Z',
        modified: '2026-01-02T00:00:00Z',
        tags: ['test', 'demo'],
        properties: {},
      };

      const result = parser.serializeFrontMatter(meta);
      expect(result).toContain('id: "page-001"');
      expect(result).toContain('title: "Test Page"');
      expect(result).toContain('icon: "📝"');
    });
  });

  describe('parseBlocks', () => {
    it('should parse paragraphs', () => {
      const blocks = parser.parseBlocks('Hello world.\n\nSecond paragraph.');
      expect(blocks.length).toBe(2);
      expect(blocks[0].type).toBe('paragraph');
      expect(blocks[0].content).toBe('Hello world.');
      expect(blocks[1].content).toBe('Second paragraph.');
    });

    it('should parse headings', () => {
      const blocks = parser.parseBlocks('# Heading 1\n\n## Heading 2\n\n### Heading 3');
      expect(blocks[0].type).toBe('heading1');
      expect(blocks[0].content).toBe('Heading 1');
      expect(blocks[1].type).toBe('heading2');
      expect(blocks[2].type).toBe('heading3');
    });

    it('should parse bullet lists', () => {
      const blocks = parser.parseBlocks('- Item 1\n- Item 2\n- Item 3');
      expect(blocks[0].type).toBe('bulletList');
      expect(blocks[0].children.length).toBe(3);
      expect(blocks[0].children[0].content).toBe('Item 1');
    });

    it('should parse numbered lists', () => {
      const blocks = parser.parseBlocks('1. First\n2. Second\n3. Third');
      expect(blocks[0].type).toBe('numberedList');
      expect(blocks[0].children.length).toBe(3);
    });

    it('should parse task lists', () => {
      const blocks = parser.parseBlocks('- [x] Done\n- [ ] Todo');
      expect(blocks[0].type).toBe('todoList');
      expect(blocks[0].children[0].attrs.checked).toBe(true);
      expect(blocks[0].children[1].attrs.checked).toBe(false);
    });

    it('should parse blockquotes (multi-line with > on each line)', () => {
      const blocks = parser.parseBlocks('> This is a quote\n> Second line');
      expect(blocks[0].type).toBe('blockquote');
      expect(blocks[0].children.length).toBeGreaterThan(0);
    });

    it('should parse code blocks', () => {
      const blocks = parser.parseBlocks('```typescript\nconst x = 1;\n```');
      expect(blocks[0].type).toBe('codeBlock');
      expect(blocks[0].content).toBe('const x = 1;');
      expect(blocks[0].attrs.language).toBe('typescript');
    });

    it('should parse mermaid blocks', () => {
      const blocks = parser.parseBlocks(
        '```mermaid\nflowchart TD\n    A --> B\n```',
      );
      expect(blocks[0].type).toBe('mermaid');
      expect(blocks[0].content).toContain('flowchart TD');
    });

    it('should parse horizontal rules', () => {
      const blocks = parser.parseBlocks('---');
      expect(blocks[0].type).toBe('horizontalRule');
    });

    it('should parse images', () => {
      const blocks = parser.parseBlocks('![Alt text](https://example.com/img.png)');
      expect(blocks[0].type).toBe('image');
      expect(blocks[0].attrs.src).toBe('https://example.com/img.png');
      expect(blocks[0].attrs.alt).toBe('Alt text');
    });

    it('should parse cept:block callout comments', () => {
      const md = `<!-- cept:block {"type":"callout","icon":"💡","color":"blue"} -->

This is a callout.

<!-- /cept:block -->`;

      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('callout');
      expect(blocks[0].attrs.icon).toBe('💡');
      expect(blocks[0].attrs.color).toBe('blue');
    });

    it('should parse cept:database comments', () => {
      const md = '<!-- cept:database {"ref":".cept/databases/tasks.yaml","view":"table"} -->';
      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('database');
      expect(blocks[0].attrs.ref).toBe('.cept/databases/tasks.yaml');
    });

    it('should parse cept:toc comment', () => {
      const blocks = parser.parseBlocks('<!-- cept:toc -->');
      expect(blocks[0].type).toBe('tableOfContents');
    });

    it('should skip yaml front matter nodes', () => {
      const md = `---
title: "Test"
---

# Content`;
      const blocks = parser.parseBlocks(md);
      // Should not have a yaml block, only the heading
      expect(blocks.every((b) => b.type !== 'paragraph' || b.content !== '')).toBe(true);
      expect(blocks.some((b) => b.type === 'heading1')).toBe(true);
    });
  });

  describe('serializeBlocks', () => {
    it('should serialize paragraphs', () => {
      const result = parser.serializeBlocks([
        { id: '1', type: 'paragraph', content: 'Hello world.', attrs: {}, children: [] },
      ]);
      expect(result.trim()).toBe('Hello world.');
    });

    it('should serialize headings', () => {
      const result = parser.serializeBlocks([
        { id: '1', type: 'heading1', content: 'Title', attrs: {}, children: [] },
        { id: '2', type: 'heading2', content: 'Subtitle', attrs: {}, children: [] },
      ]);
      expect(result).toContain('# Title');
      expect(result).toContain('## Subtitle');
    });

    it('should serialize bullet lists', () => {
      const result = parser.serializeBlocks([
        {
          id: '1',
          type: 'bulletList',
          content: '',
          attrs: {},
          children: [
            { id: '2', type: 'paragraph', content: 'Item 1', attrs: {}, children: [] },
            { id: '3', type: 'paragraph', content: 'Item 2', attrs: {}, children: [] },
          ],
        },
      ]);
      expect(result).toContain('- Item 1');
      expect(result).toContain('- Item 2');
    });

    it('should serialize code blocks', () => {
      const result = parser.serializeBlocks([
        {
          id: '1',
          type: 'codeBlock',
          content: 'const x = 1;',
          attrs: { language: 'typescript' },
          children: [],
        },
      ]);
      expect(result).toContain('```typescript');
      expect(result).toContain('const x = 1;');
    });

    it('should serialize cept extensions', () => {
      const result = parser.serializeBlocks([
        {
          id: '1',
          type: 'callout',
          content: 'Note here',
          attrs: { type: 'callout', icon: '💡', color: 'blue' },
          children: [],
        },
      ]);
      expect(result).toContain('<!-- cept:block');
      expect(result).toContain('<!-- /cept:block -->');
    });

    it('should serialize database references', () => {
      const result = parser.serializeBlocks([
        {
          id: '1',
          type: 'database',
          content: '',
          attrs: { ref: '.cept/databases/tasks.yaml', view: 'table' },
          children: [],
        },
      ]);
      expect(result).toContain('<!-- cept:database');
      expect(result).toContain('.cept/databases/tasks.yaml');
    });
  });

  describe('roundtrip: parse -> serialize', () => {
    it('should roundtrip simple markdown', () => {
      const original = `# Title

Hello world.

## Section

- Item 1
- Item 2

\`\`\`javascript
console.log("hello");
\`\`\`
`;
      const blocks = parser.parseBlocks(original);
      const serialized = parser.serializeBlocks(blocks);

      expect(serialized).toContain('# Title');
      expect(serialized).toContain('Hello world.');
      expect(serialized).toContain('## Section');
      expect(serialized).toContain('- Item 1');
      expect(serialized).toContain('console.log("hello");');
    });

    it('should roundtrip full page with front matter', () => {
      const original = `---
id: "page-001"
title: "My Page"
created: "2026-01-01T00:00:00Z"
modified: "2026-01-01T00:00:00Z"
tags:
  - test
properties: {}
---

# My Page

Content here.
`;

      const page = parser.parse(original);
      expect(page.meta.title).toBe('My Page');
      expect(page.blocks.some((b) => b.type === 'heading1')).toBe(true);

      const serialized = parser.serialize(page);
      expect(serialized).toContain('title: "My Page"');
      expect(serialized).toContain('# My Page');
      expect(serialized).toContain('Content here.');
    });
  });

  describe('extractText inline formatting', () => {
    it('should preserve bold text in paragraphs', () => {
      const blocks = parser.parseBlocks('This is **bold** text.');
      expect(blocks[0].content).toBe('This is **bold** text.');
    });

    it('should preserve italic text in paragraphs', () => {
      const blocks = parser.parseBlocks('This is *italic* text.');
      expect(blocks[0].content).toBe('This is *italic* text.');
    });

    it('should preserve strikethrough text', () => {
      const blocks = parser.parseBlocks('This is ~~deleted~~ text.');
      expect(blocks[0].content).toBe('This is ~~deleted~~ text.');
    });

    it('should preserve inline code', () => {
      const blocks = parser.parseBlocks('Use the `console.log` function.');
      expect(blocks[0].content).toBe('Use the `console.log` function.');
    });

    it('should preserve links', () => {
      const blocks = parser.parseBlocks('Visit [Example](https://example.com) for info.');
      expect(blocks[0].content).toBe('Visit [Example](https://example.com) for info.');
    });

    it('should preserve nested inline formatting', () => {
      const blocks = parser.parseBlocks('This is ***bold italic*** text.');
      expect(blocks[0].content).toContain('bold italic');
      // Should have both bold and italic markers
      expect(blocks[0].content).toMatch(/\*+bold italic\*+/);
    });

    it('should preserve bold text in headings', () => {
      const blocks = parser.parseBlocks('## Heading with **bold**');
      expect(blocks[0].content).toBe('Heading with **bold**');
    });

    it('should preserve inline code in list items', () => {
      const blocks = parser.parseBlocks('- Use `foo` here\n- And `bar` there');
      expect(blocks[0].children[0].content).toBe('Use `foo` here');
      expect(blocks[0].children[1].content).toBe('And `bar` there');
    });

    it('should preserve links in list items', () => {
      const blocks = parser.parseBlocks('- Visit [Site](https://example.com)');
      expect(blocks[0].children[0].content).toBe('Visit [Site](https://example.com)');
    });
  });

  describe('roundtrip: all block types', () => {
    it('should roundtrip paragraphs with inline formatting', () => {
      const md = 'Text with **bold**, *italic*, `code`, and [link](https://example.com).';
      const blocks = parser.parseBlocks(md);
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('**bold**');
      expect(result).toContain('*italic*');
      expect(result).toContain('`code`');
      expect(result).toContain('[link](https://example.com)');
    });

    it('should roundtrip all heading levels', () => {
      const md = '# H1\n\n## H2\n\n### H3';
      const blocks = parser.parseBlocks(md);
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('# H1');
      expect(result).toContain('## H2');
      expect(result).toContain('### H3');
    });

    it('should roundtrip bullet lists', () => {
      const md = '- Alpha\n- Beta\n- Gamma';
      const blocks = parser.parseBlocks(md);
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('- Alpha');
      expect(result).toContain('- Beta');
      expect(result).toContain('- Gamma');
    });

    it('should roundtrip numbered lists', () => {
      const md = '1. First\n2. Second\n3. Third';
      const blocks = parser.parseBlocks(md);
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('1. First');
      expect(result).toContain('2. Second');
      expect(result).toContain('3. Third');
    });

    it('should roundtrip task lists', () => {
      const md = '- [x] Done task\n- [ ] Pending task';
      const blocks = parser.parseBlocks(md);
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('- [x] Done task');
      expect(result).toContain('- [ ] Pending task');
    });

    it('should roundtrip blockquotes', () => {
      const md = '> This is a quote\n>\n> With two paragraphs';
      const blocks = parser.parseBlocks(md);
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('> This is a quote');
      expect(result).toContain('> With two paragraphs');
    });

    it('should roundtrip code blocks with language', () => {
      const md = '```python\ndef hello():\n    print("world")\n```';
      const blocks = parser.parseBlocks(md);
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('```python');
      expect(result).toContain('def hello():');
      expect(result).toContain('print("world")');
      expect(result).toContain('```');
    });

    it('should roundtrip code blocks without language', () => {
      const md = '```\nplain code\n```';
      const blocks = parser.parseBlocks(md);
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('plain code');
    });

    it('should roundtrip horizontal rules', () => {
      const md = 'Above\n\n---\n\nBelow';
      const blocks = parser.parseBlocks(md);
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('---');
      expect(result).toContain('Above');
      expect(result).toContain('Below');
    });

    it('should roundtrip images', () => {
      const md = '![A cat](https://example.com/cat.png)';
      const blocks = parser.parseBlocks(md);
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('![A cat](https://example.com/cat.png)');
    });

    it('should roundtrip tables', () => {
      const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |';
      const blocks = parser.parseBlocks(md);
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('Name');
      expect(result).toContain('Age');
      expect(result).toContain('Alice');
      expect(result).toContain('Bob');
    });

    it('should roundtrip mermaid blocks', () => {
      const md = '```mermaid\nflowchart TD\n    A --> B\n```';
      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('mermaid');
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('mermaid');
      expect(result).toContain('flowchart TD');
      expect(result).toContain('A --> B');
    });

    it('should roundtrip cept:toc', () => {
      const md = '<!-- cept:toc -->';
      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('tableOfContents');
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('<!-- cept:toc -->');
    });

    it('should roundtrip cept:database', () => {
      const md = '<!-- cept:database {"ref":".cept/databases/tasks.yaml","view":"table"} -->';
      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('database');
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('.cept/databases/tasks.yaml');
      expect(result).toContain('"view"');
    });

    it('should roundtrip cept:block callout', () => {
      const md = `<!-- cept:block {"type":"callout","icon":"💡","color":"yellow"} -->

Important note here.

<!-- /cept:block -->`;
      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('callout');
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('<!-- cept:block');
      expect(result).toContain('Important note here.');
      expect(result).toContain('<!-- /cept:block -->');
    });

    it('should roundtrip strikethrough in paragraphs', () => {
      const md = 'This has ~~strikethrough~~ text.';
      const blocks = parser.parseBlocks(md);
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('~~strikethrough~~');
    });

    it('should roundtrip multiple formatted elements in a single paragraph', () => {
      const md = '**Bold** then *italic* then `code` then [link](https://x.com).';
      const blocks = parser.parseBlocks(md);
      expect(blocks.length).toBe(1);
      const result = parser.serializeBlocks(blocks);
      expect(result).toContain('**Bold**');
      expect(result).toContain('*italic*');
      expect(result).toContain('`code`');
      expect(result).toContain('[link](https://x.com)');
    });
  });

  describe('edge cases', () => {
    it('should handle empty markdown', () => {
      const blocks = parser.parseBlocks('');
      expect(blocks).toEqual([]);
    });

    it('should handle whitespace-only markdown', () => {
      const blocks = parser.parseBlocks('   \n\n   ');
      expect(blocks.length).toBe(0);
    });

    it('should handle markdown with only front matter', () => {
      const md = '---\ntitle: "Empty"\n---\n';
      const blocks = parser.parseBlocks(md);
      // Should have no content blocks (only filtered yaml)
      expect(blocks.every((b) => b.type !== 'paragraph' || b.content !== '')).toBe(true);
    });

    it('should handle deeply nested blockquotes', () => {
      const md = '> > > Deeply nested';
      const blocks = parser.parseBlocks(md);
      // `> > > text` — second line starts with `>`, so it stays a blockquote
      // Actually, `> > > text` is a single line; the preprocessor sees `> ` and
      // checks the next line. With no next line starting with `>`, this becomes
      // a toggle with summary `> > Deeply nested`.
      expect(blocks[0].type).toBe('toggle');
    });

    it('should handle code blocks with special characters', () => {
      const md = '```\n<div class="test">&amp;</div>\n```';
      const blocks = parser.parseBlocks(md);
      expect(blocks[0].content).toContain('<div class="test">');
    });

    it('should handle paragraphs with only inline code', () => {
      const blocks = parser.parseBlocks('`just code`');
      expect(blocks[0].content).toBe('`just code`');
    });

    it('should handle links with special characters in URL', () => {
      const blocks = parser.parseBlocks('[test](https://example.com/path?q=1&b=2)');
      expect(blocks[0].content).toContain('https://example.com/path?q=1&b=2');
    });

    it('should handle empty list items', () => {
      const blocks = parser.parseBlocks('- \n- Item');
      expect(blocks[0].type).toBe('bulletList');
      expect(blocks[0].children.length).toBe(2);
    });
  });

  describe('toggle syntax', () => {
    it('should parse a basic toggle with content', () => {
      const md = `> Toggle text
  Stuff in toggle

  Still in toggle

  - list in toggle
    - with item inside`;

      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('toggle');
      expect(blocks[0].attrs.summary).toBe('Toggle text');
      expect(blocks[0].children.length).toBeGreaterThan(0);
    });

    it('should still parse regular blockquotes (> on every line)', () => {
      const md = '> This is a quote\n> More quote text';
      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('blockquote');
    });

    it('should parse standalone > line as a toggle (empty body)', () => {
      const md = '> Click to expand';
      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('toggle');
      expect(blocks[0].attrs.summary).toBe('Click to expand');
    });

    it('should parse > followed by blank then unindented text as toggle + paragraph', () => {
      const md = '> A toggle\n\nNext paragraph.';
      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('toggle');
      expect(blocks[0].attrs.summary).toBe('A toggle');
      expect(blocks[1].type).toBe('paragraph');
    });

    it('should parse nested toggle (toggle in toggle)', () => {
      const md = `> Outer toggle
  Some content

  > Inner toggle
    Nested content`;

      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('toggle');
      expect(blocks[0].attrs.summary).toBe('Outer toggle');
      const inner = blocks[0].children.find(
        (c: { type: string }) => c.type === 'toggle',
      );
      expect(inner).toBeDefined();
      expect(inner!.attrs.summary).toBe('Inner toggle');
    });

    it('should parse toggle in a list', () => {
      const md = `- list
  - item
    - nested
    - > toggle in list
      In toggle

      Still in toggle
    - next item in list`;

      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('bulletList');
      // Find the toggle in the nested structure
      const findToggle = (block: { type: string; children: { type: string; children: unknown[]; attrs: Record<string, unknown> }[] }): { type: string; attrs: Record<string, unknown>; children: unknown[] } | null => {
        if (block.type === 'toggle') return block;
        for (const child of block.children) {
          const found = findToggle(child as typeof block);
          if (found) return found;
        }
        return null;
      };
      const toggle = findToggle(blocks[0] as unknown as Parameters<typeof findToggle>[0]);
      expect(toggle).not.toBeNull();
      expect(toggle!.attrs.summary).toBe('toggle in list');
    });

    it('should parse toggle with next list item after single blank line', () => {
      const md = `- list
  - item
    - nested
    - > toggle in list
      In toggle

      Still in toggle

    - next item in list`;

      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('bulletList');
    });

    it('should end toggle after two blank lines', () => {
      const md = `- list
  - item
    - nested
    - > toggle in list
      In toggle

      Still in toggle


    - new indented list
    - because 2 empty lines ends the toggle`;

      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('bulletList');
    });

    it('should parse toggle with nested list content', () => {
      const md = `- list
  - item
    - nested
    - > toggle in list
      - nested
      - items
        - lol`;

      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('bulletList');
    });

    it('should parse h1 heading toggle', () => {
      const md = `> # h1 toggle
  Content inside h1 toggle`;

      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('toggle');
      expect(blocks[0].attrs.summary).toBe('# h1 toggle');
    });

    it('should parse h3 heading toggle', () => {
      const md = `> ### h3 toggle atx style
  Content inside`;

      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('toggle');
      expect(blocks[0].attrs.summary).toBe('### h3 toggle atx style');
    });

    it('should parse toggle with heading in list context', () => {
      const md = `- list
- with
  - nested items
  - > ## with a random heading!
    Content inside`;

      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('bulletList');
    });

    it('should roundtrip a basic toggle', () => {
      const md = `> Toggle text
  Stuff in toggle`;

      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('toggle');

      const serialized = parser.serializeBlocks(blocks);
      expect(serialized).toContain('> Toggle text');
      expect(serialized).toContain('  Stuff in toggle');
    });

    it('should roundtrip a toggle with multiple paragraphs', () => {
      const md = `> My Toggle
  First paragraph

  Second paragraph`;

      const blocks = parser.parseBlocks(md);
      expect(blocks[0].type).toBe('toggle');
      expect(blocks[0].attrs.summary).toBe('My Toggle');

      const serialized = parser.serializeBlocks(blocks);
      expect(serialized).toContain('> My Toggle');
      expect(serialized).toContain('First paragraph');
      expect(serialized).toContain('Second paragraph');
    });

    it('should serialize a toggle block with the new syntax', () => {
      const result = parser.serializeBlocks([
        {
          id: '1',
          type: 'toggle',
          content: '',
          attrs: { summary: 'Click me' },
          children: [
            { id: '2', type: 'paragraph', content: 'Hidden content', attrs: {}, children: [] },
          ],
        },
      ]);
      expect(result).toContain('> Click me');
      expect(result).toContain('  Hidden content');
      // Should NOT use cept:block comment syntax
      expect(result).not.toContain('<!-- cept:block');
    });

    it('should roundtrip a heading toggle', () => {
      const md = `> # Important Section
  Details here`;

      const blocks = parser.parseBlocks(md);
      const serialized = parser.serializeBlocks(blocks);
      expect(serialized).toContain('> # Important Section');
      expect(serialized).toContain('  Details here');
    });
  });
});
