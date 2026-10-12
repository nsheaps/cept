import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Markdown the pipeline does not model (unknown HTML, link reference
 * definitions, unbalanced container tags) is loaded as a raw node holding the
 * source and saved back unchanged (EDT-023). The editor shows the source and
 * does not edit it.
 */
const markdownAttribute = {
  markdown: {
    default: '',
    parseHTML: (element: HTMLElement) => element.getAttribute('data-markdown') ?? '',
    renderHTML: (attributes: Record<string, unknown>) => ({
      'data-markdown': String(attributes.markdown ?? ''),
    }),
  },
};

export const RawBlock = Node.create({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return markdownAttribute;
  },

  parseHTML() {
    return [{ tag: 'pre[data-type="raw-block"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'pre',
      mergeAttributes(HTMLAttributes, { 'data-type': 'raw-block', class: 'cept-raw-block' }),
      String(node.attrs.markdown ?? ''),
    ];
  },
});

export const RawInline = Node.create({
  name: 'rawInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return markdownAttribute;
  },

  parseHTML() {
    return [{ tag: 'code[data-type="raw-inline"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'code',
      mergeAttributes(HTMLAttributes, { 'data-type': 'raw-inline', class: 'cept-raw-inline' }),
      String(node.attrs.markdown ?? ''),
    ];
  },
});
