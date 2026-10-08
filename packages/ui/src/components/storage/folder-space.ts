/**
 * Spaces kept as a folder tree (REQ-WS-001, D-42).
 *
 * A space whose root holds `space.cept.yaml` is read with the folder reader
 * from `@cept/core` (`readSpaceTree`): its Markdown files are its pages, its
 * folders are pages that hold other pages, and page ids are paths relative to
 * the space root. A space without the marker keeps the older flat layout
 * (`pages/<id>.md` plus a page tree in the state file) until it is migrated.
 *
 * This module turns the folder tree into the sidebar's page tree and runs the
 * page operations the app offers (add, rename, move to the root, duplicate,
 * read, write, delete) as file operations. Each operation that renames files
 * reports the moves, so callers can carry page ids they hold over to the new
 * paths with `applyMoves`.
 */

import {
  createPage,
  findPage,
  findSpaceMarker,
  isPageFile,
  movePage,
  NEW_FOLDER_PAGE,
  pickFolderPage,
  readSpaceTree,
  serializeSpaceConfig,
  SPACE_CONFIG_VERSION,
  SPACE_MARKER_YAML,
} from '@cept/core';
import type { Moved, PageNode, SpaceTree, StorageBackend } from '@cept/core';
import type { PageTreeNode } from '../sidebar/PageTreeItem.js';

/** The result of a page operation: the page's id afterwards and the paths that moved. */
export interface FolderChange {
  pageId: string;
  moved: Moved[];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const segments = (path: string) => path.split('/').filter(Boolean);
const join = (...parts: string[]) => parts.flatMap(segments).join('/');
const parentOf = (path: string) => segments(path).slice(0, -1).join('/');
const baseName = (path: string) => segments(path).at(-1) ?? '';
const at = (path: string) => `/${join(path)}`;

function stripExtension(name: string): string {
  return name.replace(/\.(md|markdown)$/i, '');
}

/** Whether the space in `backend` uses the folder layout (its root holds `space.cept.yaml`). */
export async function isFolderSpace(backend: StorageBackend): Promise<boolean> {
  return (await findSpaceMarker(backend, '')) !== null;
}

/** A space slug made from its name: lowercase a-z, 0-9 and `-`, at most 63 characters. */
export function slugFor(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 63)
    .replace(/^-+|-+$/g, '');
  return slug || 'space';
}

/** Mark the space in `backend` as a folder space by writing its `space.cept.yaml`. */
export async function initFolderSpace(backend: StorageBackend, name: string): Promise<void> {
  if (await isFolderSpace(backend)) return;
  const config = serializeSpaceConfig({ version: SPACE_CONFIG_VERSION, name, slug: slugFor(name) });
  await backend.writeFile(at(SPACE_MARKER_YAML), encoder.encode(config));
}

export function readFolderTree(backend: StorageBackend): Promise<SpaceTree> {
  return readSpaceTree(backend);
}

function flatten(nodes: readonly PageTreeNode[], into = new Map<string, PageTreeNode>()) {
  for (const node of nodes) {
    into.set(node.id, node);
    flatten(node.children, into);
  }
  return into;
}

/**
 * The sidebar tree for a folder space. The root's own page (`README.md` or
 * `index.md` at the root) comes first, then the root's children. Icons,
 * covers and expanded state are kept from `previous` by id; pages in `hidden`
 * (the trash) are left out with everything under them.
 */
export function toPageTree(
  tree: SpaceTree,
  previous: readonly PageTreeNode[] = [],
  hidden: ReadonlySet<string> = new Set(),
): PageTreeNode[] {
  const kept = flatten(previous);
  const convert = (id: string, title: string, children: readonly PageNode[]): PageTreeNode => {
    const old = kept.get(id);
    return {
      id,
      title,
      ...(old?.icon !== undefined ? { icon: old.icon } : {}),
      ...(old?.cover !== undefined ? { cover: old.cover } : {}),
      ...(old?.isExpanded !== undefined ? { isExpanded: old.isExpanded } : {}),
      children: children
        .filter((c) => !hidden.has(c.id))
        .map((c) => convert(c.id, c.name, c.children)),
    };
  };
  const top = convert('', '', tree.root.children).children;
  const rootFile = tree.root.file;
  if (rootFile && !hidden.has(rootFile))
    top.unshift(convert(rootFile, stripExtension(rootFile), []));
  return top;
}

/** The node for a sidebar id. The root's own page is a file page under the root. */
function nodeFor(tree: SpaceTree, id: string): PageNode {
  if (id !== '' && id === tree.root.file)
    return { id, kind: 'file', name: stripExtension(id), file: id, children: [] };
  const node = id === '' ? null : findPage(tree, id);
  if (!node) throw new Error(`Page not found: ${id}`);
  return node;
}

/**
 * The file holding a page's content: the file itself for a file page, the
 * folder's `index.md` or `README.md` for a folder page (`index.md` when it has
 * neither, which a write creates). `null` when there is no such page.
 */
async function pageFileOf(backend: StorageBackend, id: string): Promise<string | null> {
  if (segments(id).length === 0) return null;
  const entry = (await backend.listDirectory(at(parentOf(id)))).find(
    (e) => e.name === baseName(id),
  );
  if (!entry) return null;
  if (entry.isFile) return isPageFile(entry.name) ? join(id) : null;
  const inner = await backend.listDirectory(at(id));
  return join(
    id,
    pickFolderPage(inner.filter((e) => e.isFile).map((e) => e.name)) ?? NEW_FOLDER_PAGE,
  );
}

export async function readFolderPage(backend: StorageBackend, id: string): Promise<string | null> {
  const file = await pageFileOf(backend, id);
  const bytes = file ? await backend.readFile(at(file)) : null;
  return bytes ? decoder.decode(bytes) : null;
}

/** Write a page's content. A page that no longer exists (renamed or deleted since) is left alone. */
export async function writeFolderPage(
  backend: StorageBackend,
  id: string,
  text: string,
): Promise<void> {
  const file = await pageFileOf(backend, id);
  if (file) await backend.writeFile(at(file), encoder.encode(text));
}

/** Every file below `dir`, depth first. */
async function filesUnder(backend: StorageBackend, dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await backend.listDirectory(at(dir))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory) out.push(...(await filesUnder(backend, path)));
    else out.push(path);
  }
  return out;
}

/**
 * Delete a page for good: its file, or for a folder page every page file in
 * the folder. Other files (images, attachments, config) are never deleted.
 */
export async function deleteFolderPage(backend: StorageBackend, id: string): Promise<void> {
  const entry = segments(id).length
    ? (await backend.listDirectory(at(parentOf(id)))).find((e) => e.name === baseName(id))
    : undefined;
  if (!entry) return;
  const files = entry.isFile ? [join(id)] : await filesUnder(backend, id);
  for (const file of files.filter((f) => isPageFile(baseName(f))))
    await backend.deleteFile(at(file));
}

/** Make a page name safe as a file name: no path separators or leading dots. */
export function pageNameFromTitle(title: string): string {
  return title.replace(/[/\\]/g, '-').trim().replace(/^\.+/, '').trim();
}

/** The first of `base`, `base 2`, `base 3`, … free as both `<name>.md` and a folder in `folder`. */
async function freeName(backend: StorageBackend, folder: string, base: string): Promise<string> {
  const taken = new Set((await backend.listDirectory(at(folder))).map((e) => e.name.toLowerCase()));
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base} ${n}`;
    if (!taken.has(name.toLowerCase()) && !taken.has(`${name}.md`.toLowerCase())) return name;
  }
}

/**
 * Add a page named after `title` (`Untitled` by default, numbered when taken)
 * under `parentId`, or at the root. A file page parent becomes a folder page
 * first, which the result reports as a move.
 */
export async function addFolderPage(
  backend: StorageBackend,
  parentId: string | undefined,
  title = 'Untitled',
  text = '',
): Promise<FolderChange> {
  const tree = await readSpaceTree(backend);
  let parent = parentId ? nodeFor(tree, parentId) : tree.root;
  if (parent.id === tree.root.file) parent = tree.root;
  const base = pageNameFromTitle(title) || 'Untitled';
  const name = parent.kind === 'folder' ? await freeName(backend, parent.id, base) : base;
  const { id, moved } = await createPage(backend, '', parent, name, text);
  return { pageId: id, moved };
}

/** Rename a page's file or folder after `title`. An empty title changes nothing. */
export async function renameFolderPage(
  backend: StorageBackend,
  id: string,
  title: string,
): Promise<FolderChange> {
  const name = pageNameFromTitle(title);
  if (!name) return { pageId: id, moved: [] };
  const page = nodeFor(await readSpaceTree(backend), id);
  const { id: pageId, moved } = await movePage(backend, '', page, parentOf(id), name);
  return { pageId, moved };
}

/** Move a page (with everything under it) to the space root, keeping its name. */
export async function moveFolderPageToRoot(
  backend: StorageBackend,
  id: string,
): Promise<FolderChange> {
  const page = nodeFor(await readSpaceTree(backend), id);
  const { id: pageId, moved } = await movePage(backend, '', page, '', baseName(id));
  return { pageId, moved };
}

/** Copy a page's own content (not its children) to a new sibling page `<name> (copy)`. */
export async function duplicateFolderPage(
  backend: StorageBackend,
  id: string,
): Promise<FolderChange> {
  const page = nodeFor(await readSpaceTree(backend), id);
  const text = (await readFolderPage(backend, id)) ?? '';
  const folder = parentOf(id);
  const name = await freeName(backend, folder, `${page.name} (copy)`);
  const created = await createPage(backend, '', { id: folder, kind: 'folder' }, name, text);
  return { pageId: created.id, moved: created.moved };
}
