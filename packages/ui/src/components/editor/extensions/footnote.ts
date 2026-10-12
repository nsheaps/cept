import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * GFM footnotes (EDT-015, EDT-016). The Markdown pipeline loads `[^id]` as a
 * `footnoteReference` and `[^id]: ...` as a `footnoteDefinition` holding its
 * blocks. A definition is stated once and every reference to its identifier
 * shares it, so editing the definition changes what every reference points
 * at. Numbers are not stored: they follow the order of each identifier's
 * first reference, as GitHub numbers them, and are drawn by decorations.
 */
const identityAttributes = {
  identifier: {
    default: '',
    parseHTML: (element: HTMLElement) => element.getAttribute('data-identifier') ?? '',
    renderHTML: (attributes: Record<string, unknown>) => ({
      'data-identifier': String(attributes.identifier ?? ''),
    }),
  },
  label: {
    default: '',
    parseHTML: (element: HTMLElement) => element.getAttribute('data-label') ?? '',
    renderHTML: (attributes: Record<string, unknown>) => ({
      'data-label': String(attributes.label ?? ''),
    }),
  },
};

export const FootnoteReference = Node.create({
  name: 'footnoteReference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return identityAttributes;
  },

  parseHTML() {
    return [{ tag: 'sup[data-type="footnote-reference"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'footnote-reference',
        class: 'cept-footnote-ref',
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [footnotePlugin];
  },
});

export const FootnoteDefinition = Node.create({
  name: 'footnoteDefinition',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return identityAttributes;
  },

  parseHTML() {
    return [{ tag: 'div[data-type="footnote-definition"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'footnote-definition',
        class: 'cept-footnote-def',
      }),
      0,
    ];
  },
});

/** Each referenced identifier's number: the order of its first reference. */
export function footnoteNumbers(doc: ProseMirrorNode): Map<string, number> {
  const numbers = new Map<string, number>();
  doc.descendants((node) => {
    if (node.type.name !== 'footnoteReference') return;
    const identifier = String(node.attrs.identifier);
    if (!numbers.has(identifier)) numbers.set(identifier, numbers.size + 1);
  });
  return numbers;
}

function decorate(doc: ProseMirrorNode): DecorationSet {
  const numbers = footnoteNumbers(doc);
  const uses = new Map<string, number>();
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    const identifier = String(node.attrs.identifier ?? '');
    if (node.type.name === 'footnoteReference') {
      const use = (uses.get(identifier) ?? 0) + 1;
      uses.set(identifier, use);
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          'data-footnote-number': String(numbers.get(identifier)),
          'data-footnote-use': String(use),
        }),
      );
    } else if (node.type.name === 'footnoteDefinition') {
      const number = numbers.get(identifier);
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          'data-footnote-number': number === undefined ? '' : String(number),
        }),
      );
    }
  });
  // Back-references go at the end of each definition, once every use is counted.
  doc.descendants((node, pos) => {
    if (node.type.name !== 'footnoteDefinition') return;
    const identifier = String(node.attrs.identifier);
    const count = uses.get(identifier) ?? 0;
    if (count === 0) return;
    decorations.push(
      Decoration.widget(pos + node.nodeSize - 1, () => backReferences(identifier, count), {
        side: 1,
        key: `footnote-backrefs:${identifier}:${count}`,
        ignoreSelection: true,
      }),
    );
  });
  return DecorationSet.create(doc, decorations);
}

function backReferences(identifier: string, count: number): HTMLElement {
  const span = document.createElement('span');
  span.className = 'cept-footnote-backrefs';
  span.contentEditable = 'false';
  for (let use = 1; use <= count; use++) {
    const link = document.createElement('a');
    link.className = 'cept-footnote-backref';
    link.href = '#';
    link.textContent = count === 1 ? '↩' : `↩${use}`;
    link.setAttribute('aria-label', `Back to reference ${use}`);
    link.dataset.footnoteBackref = identifier;
    link.dataset.footnoteUse = String(use);
    span.append(link);
  }
  return span;
}

function find(root: ParentNode, selector: string, match: (element: HTMLElement) => boolean) {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).find(match);
}

export const footnotePluginKey = new PluginKey<DecorationSet>('footnotes');

const footnotePlugin = new Plugin<DecorationSet>({
  key: footnotePluginKey,
  state: {
    init: (_, state) => decorate(state.doc),
    apply: (tr, previous) => (tr.docChanged ? decorate(tr.doc) : previous),
  },
  props: {
    decorations: (state) => footnotePluginKey.getState(state),
    handleDOMEvents: {
      // A reference jumps to its definition; a back-reference jumps back.
      click(view, event) {
        const target = event.target instanceof HTMLElement ? event.target : null;
        const backref = target?.closest<HTMLElement>('[data-footnote-backref]');
        const reference = target?.closest<HTMLElement>('.cept-footnote-ref');
        let destination: HTMLElement | undefined;
        if (backref) {
          destination = find(
            view.dom,
            '.cept-footnote-ref',
            (element) =>
              element.dataset.identifier === backref.dataset.footnoteBackref &&
              element.dataset.footnoteUse === backref.dataset.footnoteUse,
          );
        } else if (reference) {
          destination = find(
            view.dom,
            '.cept-footnote-def',
            (element) => element.dataset.identifier === reference.dataset.identifier,
          );
        }
        if (!destination) return false;
        event.preventDefault();
        destination.scrollIntoView?.({ block: 'center' });
        return true;
      },
    },
  },
});
