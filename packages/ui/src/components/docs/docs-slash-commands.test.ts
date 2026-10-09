import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultSlashCommands, filterSlashCommands } from '../editor/extensions/slash-command.js';
import { DOCS_CONTENT } from './docs-content.js';

const featuresGuide = readFileSync(
  resolve(__dirname, '../../../../../docs/content/guides/features.md'),
  'utf8',
);

/** The block and slash command of each docs table row that names one. */
function documentedSlashCommands(markdown: string): { block: string; query: string }[] {
  const rows: { block: string; query: string }[] = [];
  for (const line of markdown.split('\n')) {
    const cell = /^\|([^|]+)\|\s*`?\/([a-z0-9 -]+?)`?(?:\s+or\s[^|]*)?\s*\|/i.exec(line);
    if (cell?.[1] && cell[2]) rows.push({ block: cell[1].trim(), query: cell[2] });
  }
  return rows;
}

describe('documented slash commands', () => {
  const sources = {
    'in-app docs': Object.values(DOCS_CONTENT).join('\n'),
    'features.md': featuresGuide,
  };

  for (const [source, markdown] of Object.entries(sources)) {
    const rows = documentedSlashCommands(markdown);

    it(`${source} documents slash commands`, () => {
      expect(rows.length).toBeGreaterThan(10);
    });

    for (const { block, query } of rows) {
      it(`${source}: /${query} finds ${block}`, () => {
        // The editor's Suggestion plugin ends the query at a space, so a
        // documented command with one can never be typed.
        expect(query).not.toMatch(/\s/);
        // Docs names differ a little from menu titles ("To-do List" is
        // "To-do / Checkbox"), so match on the name's words, minus "list".
        const words = block
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w !== 'list');
        const titles = filterSlashCommands(defaultSlashCommands, query).map((c) => c.title);
        const found = titles.some((t) => words.every((w) => t.toLowerCase().includes(w)));
        expect(found, `${titles.join(', ')} has no ${block}`).toBe(true);
      });
    }
  }
});
