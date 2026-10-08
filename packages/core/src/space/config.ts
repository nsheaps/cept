/**
 * Space and folder configuration files (REQ-WS-002/003/004, D-3, D-30, D-41, D-47).
 *
 * - `space.cept.yaml` (or `.yml`) marks a space root and describes the space.
 * - `.cept.yaml` (or `.yml`) in any folder holds Cept configuration for that
 *   folder and everything below it. It is never a space marker.
 *
 * Everything here is pure: text in, typed results out. Parsers never throw on
 * user data; they return `{ ok: false, errors }`. All keys are camelCase (D-47).
 * See docs/content/reference/space-config.md for the user-facing description.
 */

import { dump, load } from 'js-yaml';
import ignore, { type Ignore } from 'ignore';
import { z } from 'zod';
import type { StorageBackend } from '../storage/backend.js';
import { normalizeFolder, splitPath, toBackendPath } from './path.js';

// ---------------------------------------------------------------------------
// File names and precedence
// ---------------------------------------------------------------------------

export const SPACE_MARKER_YAML = 'space.cept.yaml';
export const SPACE_MARKER_YML = 'space.cept.yml';
export const CEPT_CONFIG_YAML = '.cept.yaml';
export const CEPT_CONFIG_YML = '.cept.yml';

/** The only schema version this build understands. */
export const SPACE_CONFIG_VERSION = '1';

/** A config file picked from a directory listing. */
export interface PickedFile {
  name: string;
  warnings: string[];
}

function pickByExtension(names: Iterable<string>, yaml: string, yml: string): PickedFile | null {
  const set = new Set(names);
  if (set.has(yaml)) {
    const warnings = set.has(yml)
      ? [`Both ${yaml} and ${yml} exist; using ${yaml} and ignoring ${yml}.`]
      : [];
    return { name: yaml, warnings };
  }
  if (set.has(yml)) return { name: yml, warnings: [] };
  return null;
}

/**
 * Pick the space marker from the file names in one directory. `.yaml` wins over
 * `.yml` when both exist, and a warning is reported (REQ-WS-003).
 */
export function pickSpaceMarker(fileNames: Iterable<string>): PickedFile | null {
  return pickByExtension(fileNames, SPACE_MARKER_YAML, SPACE_MARKER_YML);
}

/** Same rule as {@link pickSpaceMarker}, for the per-folder `.cept.yaml`/`.cept.yml`. */
export function pickCeptConfigFile(fileNames: Iterable<string>): PickedFile | null {
  return pickByExtension(fileNames, CEPT_CONFIG_YAML, CEPT_CONFIG_YML);
}

/**
 * List `dir` on a backend and pick its space marker. Read-only.
 *
 * `dir` follows the module's path contract (see `space/path.ts`): `/`-separated,
 * relative to the backend root, with `''`, `'/'` and `'.'` all naming the root.
 * It is normalized to the backend's absolute form (`'/notes'`, `'/'`) before
 * listing, so every backend sees the same spelling.
 */
export async function findSpaceMarker(
  backend: Pick<StorageBackend, 'listDirectory'>,
  dir: string,
): Promise<PickedFile | null> {
  const entries = await backend.listDirectory(toBackendPath(dir));
  return pickSpaceMarker(entries.filter((e) => e.isFile).map((e) => e.name));
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export type ParseResult<T> = { ok: true; config: T } | { ok: false; errors: string[] };

function fail(errors: string[]): { ok: false; errors: string[] } {
  return { ok: false, errors };
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) =>
    i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message,
  );
}

/** Parse YAML text; `undefined` means an empty document. */
function loadYaml(text: string): { ok: true; value: unknown } | { ok: false; errors: string[] } {
  // js-yaml 5 rejects a document with no content; for us that is just "empty".
  if (text.split('\n').every((line) => /^\s*(#.*)?$/.test(line)))
    return { ok: true, value: undefined };
  try {
    return { ok: true, value: load(text) };
  } catch (err) {
    return fail([`Invalid YAML: ${err instanceof Error ? err.message : String(err)}`]);
  }
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Dump with known keys first (in order), then every other key in original order. */
function dumpOrdered(obj: Record<string, unknown>, knownOrder: readonly string[]): string {
  const ordered: Record<string, unknown> = {};
  for (const key of knownOrder) {
    if (obj[key] !== undefined) ordered[key] = obj[key];
  }
  for (const [key, value] of Object.entries(obj)) {
    if (!(key in ordered) && value !== undefined) ordered[key] = value;
  }
  return dump(ordered, { lineWidth: -1, noRefs: true });
}

// ---------------------------------------------------------------------------
// space.cept.yaml
// ---------------------------------------------------------------------------

const SLUG_PATTERN = /^(?:[a-z0-9][a-z0-9-]{0,61}[a-z0-9]|[a-z0-9])$/;

/**
 * `version` is the string `'1'`. An unquoted YAML `1` is read as a number and
 * normalized to `'1'`; anything else (including future versions) is an error.
 */
const versionSchema = z.preprocess(
  (v) => (typeof v === 'number' ? String(v) : v),
  z.literal(SPACE_CONFIG_VERSION, {
    error: (iss) =>
      iss.input === undefined
        ? 'version is required'
        : `unsupported version ${JSON.stringify(iss.input)}; this version of Cept understands version "${SPACE_CONFIG_VERSION}"`,
  }),
);

/** Schema for `space.cept.yaml`. Unknown keys are preserved (loose object). */
export const spaceConfigSchema = z.looseObject({
  version: versionSchema,
  name: z.string({ error: 'name is required' }).min(1, 'name must not be empty'),
  slug: z
    .string({ error: 'slug is required' })
    .regex(
      SLUG_PATTERN,
      'slug must be 1-63 characters of lowercase a-z, 0-9 and "-", not starting or ending with "-"',
    ),
  branch: z.string().min(1, 'branch must not be empty').optional(),
});

export type SpaceConfig = z.infer<typeof spaceConfigSchema>;

/** Parse the text of a `space.cept.yaml`. Never throws on user data. */
export function parseSpaceConfig(text: string): ParseResult<SpaceConfig> {
  const yaml = loadYaml(text);
  if (!yaml.ok) return yaml;
  if (!isMapping(yaml.value))
    return fail(['space.cept.yaml must be a YAML mapping (key: value pairs)']);
  const parsed = spaceConfigSchema.safeParse(yaml.value);
  return parsed.success ? { ok: true, config: parsed.data } : fail(formatIssues(parsed.error));
}

/** Serialize a space config. Known keys come first; unknown keys are kept. */
export function serializeSpaceConfig(config: SpaceConfig): string {
  return dumpOrdered(config, ['version', 'name', 'slug', 'branch']);
}

/** Stringify with keys sorted at every level, to compare parsed YAML. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    isMapping(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/**
 * Change `name` and/or `slug` in the text of a `space.cept.yaml` (REQ-WS-024).
 * Each changed key's line is replaced in place, so comments on other lines,
 * key order and other keys stay as they were; a missing key is added at the
 * end. A comment at the end of a replaced line is dropped. When an in-place
 * edit cannot express the change (a multi-line value), the file is written
 * again from its parsed content, which drops its comments. The result must be
 * a valid space config.
 */
export function updateSpaceConfigText(
  text: string,
  changes: { name?: string; slug?: string },
): { ok: true; text: string } | { ok: false; errors: string[] } {
  const yaml = loadYaml(text);
  if (!yaml.ok) return yaml;
  if (yaml.value !== undefined && !isMapping(yaml.value))
    return fail(['space.cept.yaml must be a YAML mapping (key: value pairs)']);
  const wanted: Record<string, unknown> = { ...(yaml.value ?? {}) };
  const lines = text.split('\n');
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    wanted[key] = value;
    const line = `${key}: ${dump(value, { lineWidth: -1 }).trimEnd()}`;
    const at = lines.findIndex((l) => new RegExp(`^${key}\\s*:`).test(l));
    if (at >= 0) lines[at] = line;
    else if (lines.at(-1) === '') lines.splice(lines.length - 1, 0, line);
    else lines.push(line);
  }
  let out = lines.join('\n');
  const edited = loadYaml(out);
  if (!edited.ok || canonical(edited.value) !== canonical(wanted)) {
    out = dumpOrdered(wanted, ['version', 'name', 'slug', 'branch']);
  }
  const check = parseSpaceConfig(out);
  return check.ok ? { ok: true, text: out } : check;
}

// ---------------------------------------------------------------------------
// .cept.yaml
// ---------------------------------------------------------------------------

const patternList = z.preprocess(
  (v) => (v === null ? undefined : v),
  z.array(z.string(), { error: 'must be a list of strings' }).optional(),
);

const ceptConfigInputSchema = z.looseObject({ ignore: patternList, hide: patternList });

/** Parsed per-folder config: `ignore` is always present; `hide` is folded into it. */
export type CeptFolderConfig = { ignore: string[] } & Record<string, unknown>;

/**
 * Parse the text of a `.cept.yaml`. An empty file is an empty config. `hide:`
 * is an alias of `ignore:`; if both are present the lists are concatenated
 * (`ignore` first, then `hide`) and de-duplicated. The result only has `ignore`.
 */
export function parseCeptConfig(text: string): ParseResult<CeptFolderConfig> {
  const yaml = loadYaml(text);
  if (!yaml.ok) return yaml;
  const value = yaml.value === undefined || yaml.value === null ? {} : yaml.value;
  if (!isMapping(value)) return fail(['.cept.yaml must be a YAML mapping (key: value pairs)']);
  const parsed = ceptConfigInputSchema.safeParse(value);
  if (!parsed.success) return fail(formatIssues(parsed.error));
  const { ignore: ig, hide, ...rest } = parsed.data;
  const ignoreList = [...new Set([...(ig ?? []), ...(hide ?? [])])];
  return { ok: true, config: { ignore: ignoreList, ...rest } };
}

/** Serialize a per-folder config; an empty `ignore` list is omitted. */
export function serializeCeptConfig(config: CeptFolderConfig): string {
  const { ignore: ig, ...rest } = config;
  return dumpOrdered({ ignore: ig.length > 0 ? ig : undefined, ...rest }, ['ignore']);
}

// ---------------------------------------------------------------------------
// Merging from the space root down
// ---------------------------------------------------------------------------

/** One parsed `.cept.yaml` and the folder (relative to the space root, '' for the root) that holds it. */
export interface ConfigLayer {
  folder: string;
  config: CeptFolderConfig;
}

export interface MergedFolderConfig {
  /** Every key except `ignore`: the nearest layer that sets a key wins. */
  settings: Record<string, unknown>;
  /** Non-empty ignore lists, root to leaf, each relative to its own folder. */
  ignore: { folder: string; patterns: string[] }[];
}

/**
 * Merge layers ordered root to leaf. Scalar and structured settings use
 * nearest-wins per key. `ignore` is not replaced: every layer's patterns are
 * kept and apply to that layer's own subtree (see {@link createIgnoreMatcher}).
 */
export function mergeFolderConfigs(layers: readonly ConfigLayer[]): MergedFolderConfig {
  const settings: Record<string, unknown> = {};
  const ignoreLayers: MergedFolderConfig['ignore'] = [];
  for (const { folder, config } of layers) {
    const { ignore: patterns, ...rest } = config;
    Object.assign(settings, rest);
    if (patterns.length > 0) ignoreLayers.push({ folder: normalizeFolder(folder), patterns });
  }
  return { settings, ignore: ignoreLayers };
}

// ---------------------------------------------------------------------------
// Hidden paths and gitignore-style matching
// ---------------------------------------------------------------------------

/**
 * Paths hidden without any configuration: any dotfile or dotfolder (which
 * includes `.git/`, `.cept/` and `.cept.yaml`) at any depth. Config cannot
 * re-include them. Paths are relative to the space root.
 */
export function isDefaultHidden(path: string): boolean {
  return splitPath(path).some((s) => s.startsWith('.'));
}

export interface IgnoreMatcher {
  /**
   * Whether a path (relative to the space root) is hidden from the page tree,
   * search, backlinks and the graph. A path is hidden if it, or any ancestor
   * folder, is hidden. Paths outside the space (`..`) are hidden.
   */
  isHidden(path: string, options?: { isDirectory?: boolean }): boolean;
}

/**
 * Build a matcher from layers ordered root to leaf.
 *
 * Semantics (gitignore-like): each layer's patterns are evaluated relative to
 * the folder holding that `.cept.yaml` and apply only to paths below it. For a
 * path, applicable layers are consulted root to leaf and the deepest layer with
 * a matching pattern decides (so a deeper `!pattern` can re-include what an
 * ancestor ignored). Inside one layer the last matching pattern wins, and a
 * file inside an ignored directory cannot be re-included. Default-hidden paths
 * always stay hidden.
 */
export function createIgnoreMatcher(layers: readonly ConfigLayer[]): IgnoreMatcher {
  const compiled: { folder: string; ig: Ignore }[] = layers
    .filter(({ config }) => config.ignore.length > 0)
    .map(({ folder, config }) => ({
      folder: normalizeFolder(folder),
      ig: ignore().add(config.ignore),
    }));

  const hiddenByLayers = (segments: string[], isDirectory: boolean): boolean => {
    const path = segments.join('/');
    let hidden = false;
    for (const { folder, ig } of compiled) {
      let rel: string;
      if (folder === '') rel = path;
      else if (path.startsWith(`${folder}/`)) rel = path.slice(folder.length + 1);
      else continue;
      const result = ig.test(isDirectory ? `${rel}/` : rel);
      if (result.ignored) hidden = true;
      else if (result.unignored) hidden = false;
    }
    return hidden;
  };

  return {
    isHidden(path, options) {
      const segments = splitPath(path);
      if (segments.includes('..')) return true;
      for (let i = 1; i <= segments.length; i++) {
        const prefix = segments.slice(0, i);
        const isLast = i === segments.length;
        if (prefix[i - 1]!.startsWith('.')) return true;
        if (hiddenByLayers(prefix, isLast ? (options?.isDirectory ?? false) : true)) return true;
      }
      return false;
    },
  };
}
