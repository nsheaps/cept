/**
 * CodeColorSwatch — TipTap extension that renders a small color swatch
 * next to inline code elements whose text content is a valid CSS color value.
 *
 * Works like Chrome DevTools: if inline code text looks like a color
 * (hex, rgb, hsl, named colors, etc.), a tiny colored square appears
 * to the left of the code text.
 *
 * No special authoring syntax required — standard `#ff0000` inline code
 * gets a swatch automatically.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { detectCSSColor } from './color-utils.js';

export const colorSwatchPluginKey = new PluginKey('colorSwatch');

export const CodeColorSwatch = Extension.create({
  name: 'codeColorSwatch',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: colorSwatchPluginKey,
        state: {
          init(_, state) {
            return buildDecorations(state.doc);
          },
          apply(tr, oldDecorations) {
            if (!tr.docChanged) return oldDecorations;
            return buildDecorations(tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

function buildDecorations(doc: import('@tiptap/pm/model').Node): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    // We only care about text nodes that carry the "code" mark
    if (!node.isText) return;

    const codeMark = node.marks.find((m) => m.type.name === 'code');
    if (!codeMark) return;

    const text = node.text ?? '';
    const color = detectCSSColor(text);
    if (!color) return;

    // Sanitise the color value for use in a style attribute.
    // Only allow characters valid in CSS color values.
    const safeColor = color.replace(/[^a-zA-Z0-9#(),.\s/%°\-+]/g, '');

    // Create a widget decoration placed at the start of the code text.
    const widget = Decoration.widget(pos, () => {
      const swatch = document.createElement('span');
      swatch.className = 'cept-color-swatch';
      swatch.style.backgroundColor = safeColor;
      swatch.setAttribute('aria-hidden', 'true');
      swatch.contentEditable = 'false';
      return swatch;
    }, { side: -1, key: `swatch-${pos}-${safeColor}` });

    decorations.push(widget);
  });

  return DecorationSet.create(doc, decorations);
}
