import { describe, expect, it } from 'vitest';
import { parseMarkdownDocument, serializeMarkdownDocument } from './document.js';
import {
  claimFencedBlocks,
  fencedBlockNode,
  releaseFencedBlocks,
  type FencedBlockPlugin,
} from './fenced-blocks.js';
import type { PmNode } from './prosemirror.js';

const shout: FencedBlockPlugin = { name: 'shout', claims: (language) => language === 'shout' };
const plugins = [shout];

/** Load a page for the editor, let `edit` change its document, and save it. */
function roundTrip(markdown: string, edit: (doc: PmNode) => PmNode = (doc) => doc): string {
  const parsed = parseMarkdownDocument(markdown);
  const edited = edit(claimFencedBlocks(parsed.doc, plugins));
  return serializeMarkdownDocument(releaseFencedBlocks(edited, plugins), parsed);
}

const setSource = (doc: PmNode, source: string): PmNode => ({
  ...doc,
  content: doc.content?.map((block) =>
    block.type === 'shout' ? { ...block, attrs: { ...block.attrs, source } } : block,
  ),
});

describe('claimFencedBlocks', () => {
  it('loads a claimed fence as the plugin node and leaves the others', () => {
    const { doc } = parseMarkdownDocument('```shout title\nhey\n```\n\n```js\nx\n```\n');
    expect(claimFencedBlocks(doc, plugins).content).toEqual([
      {
        type: 'shout',
        attrs: { language: 'shout', meta: 'title', fence: '```', source: 'hey' },
      },
      {
        type: 'codeBlock',
        attrs: { language: 'js', fence: '```' },
        content: [{ type: 'text', text: 'x' }],
      },
    ]);
  });

  it('passes the meta string to the plugin', () => {
    const titled: FencedBlockPlugin = { name: 'titled', claims: (_, meta) => meta === 'yes' };
    const { doc } = parseMarkdownDocument('```any yes\na\n```\n\n```any\nb\n```\n');
    expect(claimFencedBlocks(doc, [titled]).content?.map((block) => block.type)).toEqual([
      'titled',
      'codeBlock',
    ]);
  });

  it('claims fences nested in other blocks', () => {
    const { doc } = parseMarkdownDocument('> ```shout\n> hey\n> ```\n');
    expect(claimFencedBlocks(doc, plugins).content?.[0]?.content?.[0]?.type).toBe('shout');
  });
});

describe('fenced-block round trip', () => {
  it('saves an unedited plugin block byte for byte', () => {
    for (const source of [
      '```shout\nhey\n```\n',
      '~~~~shout  title\nhey\n~~~~\n\nText\n',
      '```shout\n```\n',
    ]) {
      expect(roundTrip(source)).toBe(source);
    }
  });

  it('writes an edited plugin block back to the same fence', () => {
    expect(roundTrip('~~~shout title\nhey\n~~~\n', (doc) => setSource(doc, 'HEY\nyou'))).toBe(
      '~~~shout title\nHEY\nyou\n~~~\n',
    );
  });

  it('writes a new plugin block as a backtick fence', () => {
    expect(
      serializeMarkdownDocument(
        releaseFencedBlocks(
          { type: 'doc', content: [fencedBlockNode(shout, 'shout', 'new')] },
          plugins,
        ),
      ),
    ).toBe('```shout\nnew\n```\n');
  });

  it('ignores editor defaults for meta (null) when matching the source', () => {
    const source = '```shout\nhey\n```\n\nText\n';
    expect(
      roundTrip(source, (doc) => ({
        ...doc,
        content: doc.content?.map((block) =>
          block.type === 'shout' ? { ...block, attrs: { ...block.attrs, meta: null } } : block,
        ),
      })),
    ).toBe(source);
  });
});
