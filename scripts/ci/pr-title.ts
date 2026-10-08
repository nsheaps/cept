import { readFileSync } from 'node:fs';

/** Longest title accepted; GitHub truncates longer squash-commit subjects in most views. */
export const MAX_LENGTH = 100;

const TITLE = /^(?<type>[a-z]+)(?:\((?<scope>[^()]*)\))?(?<breaking>!)?: (?<subject>.*)$/;
const SCOPE = /^[a-z0-9][a-z0-9._/-]*$/;

export type TitleCheck = { ok: true } | { ok: false; reason: string };

/**
 * Checks a PR title against Conventional Commits: `type(scope)!: subject`,
 * where `type` is one of `types`, the scope and `!` are optional, and the
 * subject is non-empty with no leading or trailing whitespace.
 */
export function checkPrTitle(title: string, types: readonly string[]): TitleCheck {
  if (title.length > MAX_LENGTH) {
    return { ok: false, reason: `title is ${title.length} characters; the limit is ${MAX_LENGTH}` };
  }
  const match = TITLE.exec(title);
  if (!match?.groups) {
    return { ok: false, reason: 'title must look like "type(scope): subject" or "type: subject"' };
  }
  const { type = '', scope, subject = '' } = match.groups;
  if (!types.includes(type)) {
    return { ok: false, reason: `type "${type}" is not one of: ${types.join(', ')}` };
  }
  if (scope !== undefined && !SCOPE.test(scope)) {
    return {
      ok: false,
      reason: `scope "${scope}" must be lowercase letters, digits, ".", "_", "/" or "-"`,
    };
  }
  if (subject.trim() === '' || subject !== subject.trim()) {
    return { ok: false, reason: 'subject must be non-empty with no leading or trailing spaces' };
  }
  return { ok: true };
}

interface ReleaseItConfig {
  plugins: Record<string, { preset?: { types?: { type: string }[] } }>;
}

/** The commit types release-it knows about, read from `.release-it.json`. */
export function releaseTypes(configText: string): string[] {
  const config = JSON.parse(configText) as ReleaseItConfig;
  const types = config.plugins['@release-it/conventional-changelog']?.preset?.types ?? [];
  if (types.length === 0) throw new Error('.release-it.json lists no conventional-changelog types');
  return types.map((t) => t.type);
}

if (import.meta.main) {
  const title = process.env.PR_TITLE ?? process.argv[2];
  if (title === undefined) {
    console.error('usage: PR_TITLE="<title>" bun scripts/ci/pr-title.ts');
    process.exit(2);
  }
  const result = checkPrTitle(title, releaseTypes(readFileSync('.release-it.json', 'utf8')));
  if (!result.ok) {
    console.error(`::error title=PR title::${result.reason}: ${JSON.stringify(title)}`);
    process.exit(1);
  }
  console.log(`PR title is a valid Conventional Commit: ${title}`);
}
