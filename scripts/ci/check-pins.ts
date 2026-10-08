import { readFileSync } from 'node:fs';

// An exact semver version: x.y.z with an optional prerelease and build tail.
// Ranges, partial versions (`1`, `1.4`), `latest` and backend prefixes are rejected.
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const TOOL_LINE = /^("[^"]+"|[\w@:/.-]+)\s*=\s*(.+)$/;
const STRING_VALUE = /^"([^"]*)"/;
const INLINE_TABLE_VERSION = /^\{.*\bversion\s*=\s*"([^"]*)".*\}/;

/**
 * Returns the `[tools]` lines of a mise config whose version is not exact.
 * Accepts `tool = "x.y.z"` and `tool = { version = "x.y.z", ... }`; any other
 * value form (arrays, single-quoted strings) is reported as unpinned.
 */
export function findUnpinnedTools(toml: string): string[] {
  const unpinned: string[] = [];
  let inTools = false;
  for (const raw of toml.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      inTools = line === '[tools]';
      continue;
    }
    if (!inTools || line === '' || line.startsWith('#')) continue;
    const value = TOOL_LINE.exec(line)?.[2]?.trim() ?? '';
    const version = (STRING_VALUE.exec(value) ?? INLINE_TABLE_VERSION.exec(value))?.[1];
    if (version === undefined || !EXACT_VERSION.test(version)) unpinned.push(line);
  }
  return unpinned;
}

if (import.meta.main) {
  const file = process.argv[2] ?? '.mise.toml';
  const unpinned = findUnpinnedTools(readFileSync(file, 'utf8'));
  if (unpinned.length > 0) {
    console.error(
      `${file}: tools must be pinned to an exact version, as "x.y.z" or { version = "x.y.z" }:`,
    );
    for (const line of unpinned) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(`${file}: all tools pinned exactly`);
}
