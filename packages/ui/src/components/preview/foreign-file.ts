/**
 * How a file that is not a page is shown (REQ-EDT-027, phase-1 plan PR 54b).
 * Files are previewed read-only from their bytes; nothing here writes.
 */

import { imageMimeType } from '../editor/page-links.js';

export type PreviewKind = 'image' | 'pdf' | 'text' | 'download';

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'bmp',
  'ico',
  'svg',
]);
const TEXT_EXTENSIONS = new Set([
  'txt',
  'json',
  'yaml',
  'yml',
  'toml',
  'csv',
  'tsv',
  'log',
  'xml',
  'html',
  'css',
  'js',
  'ts',
  'sh',
  'py',
  'ini',
  'env',
]);

/** Text previews stop here; the rest is reachable by downloading. */
export const TEXT_PREVIEW_LIMIT = 512 * 1024;

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Whether the start of a file looks like text: no NUL byte. */
function looksLikeText(bytes: Uint8Array): boolean {
  return !bytes.subarray(0, 8000).includes(0);
}

/** The preview kind for a file, from its name and (for unknown extensions) its bytes. */
export function previewKind(name: string, bytes: Uint8Array): PreviewKind {
  const ext = extensionOf(name);
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  return ext === '' && looksLikeText(bytes) && bytes.length > 0 ? 'text' : 'download';
}

/** The media type for a blob of this file. */
export function mimeTypeOf(name: string, kind: PreviewKind): string {
  if (kind === 'image') return imageMimeType(name);
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'text') return 'text/plain';
  return 'application/octet-stream';
}

/** The text to show for a text file, and whether it was cut at {@link TEXT_PREVIEW_LIMIT}. */
export function previewText(bytes: Uint8Array): { text: string; truncated: boolean } {
  const truncated = bytes.length > TEXT_PREVIEW_LIMIT;
  const text = new TextDecoder('utf-8').decode(
    truncated ? bytes.subarray(0, TEXT_PREVIEW_LIMIT) : bytes,
  );
  return { text, truncated };
}
