import { readFileSync } from 'node:fs';

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

/** Returns the `[tools]` lines of a mise config whose version is not an exact x.y.z. */
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
    const match = /^("[^"]+"|[\w@:/.-]+)\s*=\s*"([^"]*)"/.exec(line);
    if (!match || !EXACT_VERSION.test(match[2] ?? '')) unpinned.push(line);
  }
  return unpinned;
}

if (import.meta.main) {
  const file = process.argv[2] ?? '.mise.toml';
  const unpinned = findUnpinnedTools(readFileSync(file, 'utf8'));
  if (unpinned.length > 0) {
    console.error(`${file}: tools must be pinned to an exact x.y.z version:`);
    for (const line of unpinned) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(`${file}: all tools pinned exactly`);
}
