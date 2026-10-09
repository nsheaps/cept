import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultSlashCommands, filterSlashCommands } from '../editor/extensions/slash-command.js';
import { DOCS_CONTENT } from './docs-content.js';

const featuresGuide = readFileSync(
  resolve(__dirname, '../../../../../docs/content/guides/features.md'),
  'utf8',
);

/** Slash commands named in the "Slash Command" column of a docs table row. */
function documentedSlashCommands(markdown: string): string[] {
  const queries: string[] = [];
  for (const line of markdown.split('\n')) {
    const cell = /^\|[^|]+\|\s*`?\/([a-z0-9 -]+?)`?(?:\s+or\s[^|]*)?\s*\|/i.exec(line);
    if (cell?.[1]) queries.push(cell[1]);
  }
  return queries;
}

describe('documented slash commands', () => {
  const sources = {
    'in-app docs': Object.values(DOCS_CONTENT).join('\n'),
    'features.md': featuresGuide,
  };

  for (const [source, markdown] of Object.entries(sources)) {
    const queries = documentedSlashCommands(markdown);

    it(`${source} documents slash commands`, () => {
      expect(queries.length).toBeGreaterThan(10);
    });

    for (const query of queries) {
      it(`${source}: /${query} finds a block`, () => {
        expect(filterSlashCommands(defaultSlashCommands, query)).not.toEqual([]);
      });
    }
  }
});
