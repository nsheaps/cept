import { Extension } from '@tiptap/core';

/**
 * Attributes the Markdown pipeline (`@cept/core` markdown bridge) puts on
 * nodes and marks to remember how a construct was written: a `~~~` fence, a
 * `+` bullet, `_` emphasis, a setext heading, an autolink. ProseMirror drops
 * attributes a schema does not declare, so the editor declares them all here
 * and an edited block is saved the way it was written (EDT-005).
 *
 * They default to `undefined`, so a block made in the editor has none of
 * them in its JSON and the bridge picks its default style. They are not
 * rendered to HTML.
 */
const PIPELINE_ATTRIBUTES: Record<string, string[]> = {
  heading: ['setext'],
  horizontalRule: ['marker'],
  codeBlock: ['meta', 'fence'],
  bulletList: ['spread', 'bullet'],
  orderedList: ['spread', 'delimiter'],
  taskList: ['spread', 'bullet', 'start', 'delimiter', 'ordered'],
  listItem: ['spread'],
  taskItem: ['spread'],
  table: ['align'],
  imageBlock: ['title'],
  mathBlock: ['meta'],
  hardBreak: ['spaces'],
  bold: ['marker'],
  italic: ['marker'],
  link: ['title', 'autolink'],
};

export const MarkdownAttributes = Extension.create({
  name: 'markdownAttributes',

  addGlobalAttributes() {
    return Object.entries(PIPELINE_ATTRIBUTES).map(([type, names]) => ({
      types: [type],
      attributes: Object.fromEntries(
        names.map((name) => [name, { default: undefined, rendered: false, keepOnSplit: true }]),
      ),
    }));
  },
});
