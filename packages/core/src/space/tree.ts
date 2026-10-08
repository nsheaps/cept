/**
 * Read and write a space as a folder tree (REQ-WS-001, REQ-WS-018, D-41, D-42).
 *
 * A space is a folder. Its Markdown files are its pages, and its folders are
 * pages that hold other pages:
 *
 * - **Page ids are paths** relative to the space root. A file page's id is its
 *   file path, extension included (`guides/setup.md`); a folder page's id is
 *   the folder path (`guides`). The space root is the folder page `''`. A file
 *   and a folder can never share a path, so ids never collide.
 * - **Folder pages.** A folder's own content is its `index.md`, or else its
 *   `README.md` (matched case-insensitively). When both exist, `index.md` is
 *   the folder page and `README.md` stays a child page. A folder with neither
 *   shows a generated listing of its children (`file: null`).
 * - **What is in the tree.** `.md` and `.markdown` files, and folders that hold
 *   at least one of them at any depth. Other files (images, attachments) are
 *   not pages. Paths hidden by default (dotfiles, `.git/`, `.cept/`) or by an
 *   `ignore:` list in a `.cept.yaml` are left out (see `config.ts`). A folder
 *   holding its own `space.cept.yaml` is a separate space: it is left out and
 *   reported as a warning (nested spaces are deferred, REQ-WS-005).
 * - **Order.** Children are sorted by name, numbers compared numerically.
 *
 * Reading only calls `listDirectory` and `readFile`, so opening a folder never
 * changes it (REQ-WS-019). Writes create or change only the page files named,
 * plus the files moved by a rename; no other file is touched. Paths follow the
 * contract in `space/path.ts`.
 */

import type { StorageBackend } from '../storage/backend.js';
import {
  createIgnoreMatcher,
  parseCeptConfig,
  pickCeptConfigFile,
  pickSpaceMarker,
  type ConfigLayer,
} from './config.js';
import { joinPath, normalizeFolder, parentFolder, splitPath, toBackendPath } from './path.js';

/** The read-only part of a backend the reader uses. */
export type TreeReadBackend = Pick<StorageBackend, 'listDirectory' | 'readFile'>;

export interface PageNode {
  /** Path-based id, relative to the space root: `a/b.md` for a file, `a/b` for a folder, `''` for the root. */
  id: string;
  kind: 'file' | 'folder';
  /** Display name: the file name without its extension, or the folder name (`''` for the root). */
  name: string;
  /** The file holding the page content, relative to the space root; `null` for a folder shown as a listing. */
  file: string | null;
  children: PageNode[];
}

export interface SpaceTree {
  root: PageNode;
  warnings: string[];
}

const PAGE_EXTENSIONS = ['.md', '.markdown'];

/** Whether a file name is a Markdown page. */
export function isPageFile(name: string): boolean {
  const lower = name.toLowerCase();
  return PAGE_EXTENSIONS.some((ext) => lower.endsWith(ext) && lower.length > ext.length);
}

function stripExtension(name: string): string {
  const lower = name.toLowerCase();
  const ext = PAGE_EXTENSIONS.find((e) => lower.endsWith(e));
  return ext ? name.slice(0, -ext.length) : name;
}

/**
 * Pick a folder's page file from its file names: `index.md` first, then
 * `README.md`, each matched case-insensitively (`.md` only). When a name exists
 * in several cases, the first in code-point order wins.
 */
export function pickFolderPage(fileNames: Iterable<string>): string | null {
  const sorted = [...fileNames].sort();
  for (const wanted of ['index.md', 'readme.md']) {
    const hit = sorted.find((n) => n.toLowerCase() === wanted);
    if (hit) return hit;
  }
  return null;
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function byName(a: PageNode, b: PageNode): number {
  return collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** UTF-8 decoding that keeps a byte-order mark, so text round-trips byte for byte. */
const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
const encoder = new TextEncoder();

/**
 * Read the page tree of the space rooted at `root` (relative to the backend
 * root; `''` is the backend root). Never throws on user data: an unreadable
 * or invalid `.cept.yaml` is reported as a warning and ignored.
 */
export async function readSpaceTree(backend: TreeReadBackend, root = ''): Promise<SpaceTree> {
  const spaceRoot = normalizeFolder(root);
  const warnings: string[] = [];

  async function walk(folder: string, layers: ConfigLayer[]): Promise<PageNode | null> {
    const entries = await backend.listDirectory(toBackendPath(joinPath(spaceRoot, folder)));
    const fileNames = entries.filter((e) => e.isFile).map((e) => e.name);

    const ownLayers = [...layers];
    const configFile = pickCeptConfigFile(fileNames);
    if (configFile) {
      const configPath = joinPath(folder, configFile.name);
      warnings.push(...configFile.warnings.map((w) => `${configPath}: ${w}`));
      const bytes = await backend.readFile(toBackendPath(joinPath(spaceRoot, configPath)));
      const parsed = bytes ? parseCeptConfig(decoder.decode(bytes)) : null;
      if (parsed?.ok) ownLayers.push({ folder, config: parsed.config });
      else
        warnings.push(
          `${configPath}: ignored (${parsed ? parsed.errors.join('; ') : 'could not be read'})`,
        );
    }
    const matcher = createIgnoreMatcher(ownLayers);

    const visibleFiles = fileNames.filter(
      (name) => isPageFile(name) && !matcher.isHidden(joinPath(folder, name)),
    );
    const folderPage = pickFolderPage(visibleFiles);

    const children: PageNode[] = [];
    for (const name of visibleFiles) {
      if (name === folderPage) continue;
      const id = joinPath(folder, name);
      children.push({ id, kind: 'file', name: stripExtension(name), file: id, children: [] });
    }
    for (const entry of entries) {
      if (!entry.isDirectory) continue;
      const sub = joinPath(folder, entry.name);
      if (matcher.isHidden(sub, { isDirectory: true })) continue;
      const subEntries = await backend.listDirectory(toBackendPath(joinPath(spaceRoot, sub)));
      const marker = pickSpaceMarker(subEntries.filter((e) => e.isFile).map((e) => e.name));
      if (marker) {
        warnings.push(`${sub}: holds ${marker.name}, so it is a separate space and is left out`);
        continue;
      }
      const node = await walk(sub, ownLayers);
      if (node) children.push(node);
    }
    children.sort(byName);

    if (folder !== '' && !folderPage && children.length === 0) return null;
    return {
      id: folder,
      kind: 'folder',
      name: splitPath(folder).at(-1) ?? '',
      file: folderPage ? joinPath(folder, folderPage) : null,
      children,
    };
  }

  const tree = await walk('', []);
  return { root: tree!, warnings };
}

/** Find a node by id, or `null`. */
export function findPage(tree: SpaceTree | PageNode, id: string): PageNode | null {
  const target = normalizeFolder(id);
  const stack: PageNode[] = ['root' in tree ? tree.root : tree];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.id === target) return node;
    stack.push(...node.children);
  }
  return null;
}

/** Read a page's content as text (byte-order mark kept), or `null` when it has no file. */
export async function readPageText(
  backend: TreeReadBackend,
  root: string,
  page: PageNode,
): Promise<string | null> {
  if (page.file === null) return null;
  const bytes = await backend.readFile(toBackendPath(joinPath(root, page.file)));
  return bytes ? decoder.decode(bytes) : null;
}

type TreeWriteBackend = Pick<
  StorageBackend,
  'listDirectory' | 'readFile' | 'writeFile' | 'deleteFile' | 'exists'
>;

/** The file a new folder page gets when it has none. */
export const NEW_FOLDER_PAGE = 'index.md';

/**
 * Write a page's content. A file page writes its own file; a folder page writes
 * its page file, creating `index.md` when the folder had none. Returns the path
 * written, relative to the space root. Touches no other file.
 */
export async function writePageText(
  backend: Pick<StorageBackend, 'writeFile'>,
  root: string,
  page: Pick<PageNode, 'id' | 'kind' | 'file'>,
  text: string,
): Promise<string> {
  const file = page.file ?? joinPath(page.id, NEW_FOLDER_PAGE);
  await backend.writeFile(toBackendPath(joinPath(root, file)), encoder.encode(text));
  return file;
}

/** A path rename caused by a write: every page id under `from` now lives under `to`. */
export interface Moved {
  from: string;
  to: string;
}

function assertSafeName(name: string): void {
  if (name === '' || name === '.' || name === '..' || name.includes('/') || name.startsWith('.'))
    throw new Error(`Invalid page name: ${JSON.stringify(name)}`);
}

/** Every file below `dir` (relative to the backend), depth first. */
async function listFilesDeep(backend: TreeWriteBackend, dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await backend.listDirectory(toBackendPath(dir))) {
    const path = joinPath(dir, entry.name);
    if (entry.isDirectory) out.push(...(await listFilesDeep(backend, path)));
    else out.push(path);
  }
  return out;
}

/**
 * Move a file or a folder (with everything in it) from `from` to `to`, both
 * relative to the space root. Refuses to overwrite anything at `to`. Backends
 * have no rename, so this copies then deletes the source.
 */
async function movePath(
  backend: TreeWriteBackend,
  root: string,
  from: string,
  to: string,
  isFolder: boolean,
): Promise<void> {
  const src = joinPath(root, from);
  const dst = joinPath(root, to);
  if (await backend.exists(toBackendPath(dst)))
    throw new Error(`Cannot move ${from} to ${to}: ${to} already exists`);
  const files = isFolder ? await listFilesDeep(backend, src) : [src];
  for (const file of files) {
    const bytes = await backend.readFile(toBackendPath(file));
    if (bytes === null) throw new Error(`Cannot read ${file}`);
    await backend.writeFile(toBackendPath(dst + file.slice(src.length)), bytes);
  }
  await backend.deleteFile(toBackendPath(src));
}

/**
 * Create a page named `name` under `parentId` with `text`. Under a folder page
 * it is the file `<parent>/<name>.md`. Under a file page `a/b.md`, the parent
 * first becomes a folder page: `a/b.md` moves to `a/b/index.md`, and the
 * result reports that move. Refuses to overwrite an existing page.
 */
export async function createPage(
  backend: TreeWriteBackend,
  root: string,
  parent: Pick<PageNode, 'id' | 'kind'>,
  name: string,
  text: string,
): Promise<{ id: string; moved: Moved[] }> {
  assertSafeName(name);
  const moved: Moved[] = [];
  let folder = parent.id;
  if (parent.kind === 'file') {
    folder = joinPath(parentFolder(parent.id) ?? '', stripExtension(splitPath(parent.id).at(-1)!));
    if (await backend.exists(toBackendPath(joinPath(root, folder))))
      throw new Error(`Cannot turn ${parent.id} into a folder page: ${folder} already exists`);
    await movePath(backend, root, parent.id, joinPath(folder, NEW_FOLDER_PAGE), false);
    moved.push({ from: parent.id, to: folder });
  }
  const id = joinPath(folder, isPageFile(name) ? name : `${name}.md`);
  if (await backend.exists(toBackendPath(joinPath(root, id))))
    throw new Error(`Cannot create ${id}: it already exists`);
  await backend.writeFile(toBackendPath(joinPath(root, id)), encoder.encode(text));
  return { id, moved };
}

/**
 * Move or rename a page to `newParent` (a folder page id) with `newName`. A
 * file page keeps its extension when `newName` has none; a folder page moves
 * with everything inside it. Refuses to overwrite, to move the root, or to
 * move a folder into itself. Returns the new id.
 */
export async function movePage(
  backend: TreeWriteBackend,
  root: string,
  page: Pick<PageNode, 'id' | 'kind'>,
  newParent: string,
  newName: string,
): Promise<{ id: string; moved: Moved[] }> {
  assertSafeName(newName);
  if (page.id === '') throw new Error('Cannot move the space root');
  const parent = normalizeFolder(newParent);
  let name = newName;
  if (page.kind === 'file' && !isPageFile(newName)) {
    const old = splitPath(page.id).at(-1)!;
    name = newName + old.slice(stripExtension(old).length);
  }
  const id = joinPath(parent, name);
  if (id === page.id) return { id, moved: [] };
  if (page.kind === 'folder' && (parent === page.id || parent.startsWith(`${page.id}/`)))
    throw new Error(`Cannot move ${page.id} into itself`);
  await movePath(backend, root, page.id, id, page.kind === 'folder');
  return { id, moved: [{ from: page.id, to: id }] };
}

/** Apply a list of moves to a page id: the new id it lives at. */
export function applyMoves(id: string, moved: readonly Moved[]): string {
  let current = normalizeFolder(id);
  for (const { from, to } of moved) {
    if (current === from) current = to;
    else if (current.startsWith(`${from}/`)) current = to + current.slice(from.length);
  }
  return current;
}
