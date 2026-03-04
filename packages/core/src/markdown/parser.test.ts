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

    it('should parse blockquotes', () => {
      const blocks = parser.parseBlocks('> This is a quote');
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
});
