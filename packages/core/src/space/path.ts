/**
 * Path helpers for the space module.
 *
 * Path contract: paths are POSIX-style, `/`-separated and relative to the
 * space (or backend) root, the same form every `StorageBackend` uses. Leading,
 * trailing and repeated `/` and `.` segments are ignored, so `''`, `'/'` and
 * `'.'` all name the root. `\` is an ordinary filename character, not a
 * separator: callers holding native Windows paths convert them before calling
 * in. `..` segments are kept as they are; callers that must stay inside a root
 * check for them.
 */

/** The non-empty segments of `path`, without `.` segments. */
export function splitPath(path: string): string[] {
  return path.split('/').filter((s) => s !== '' && s !== '.');
}

/** Canonical relative form: `''` for the root, otherwise `a/b` (no leading or trailing `/`). */
export function normalizeFolder(folder: string): string {
  return splitPath(folder).join('/');
}

/** Join path pieces into canonical relative form. */
export function joinPath(...parts: string[]): string {
  return parts.flatMap(splitPath).join('/');
}

/** The parent of a canonical relative path, or `null` for the root. */
export function parentFolder(path: string): string | null {
  const segments = splitPath(path);
  if (segments.length === 0) return null;
  return segments.slice(0, -1).join('/');
}

/** The absolute form backends are called with: `'/'` for the root, otherwise `/a/b`. */
export function toBackendPath(path: string): string {
  return `/${normalizeFolder(path)}`;
}
