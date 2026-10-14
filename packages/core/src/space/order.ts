/**
 * Sibling order in the page tree (REQ-EDT-026, REQ-NTN-012).
 *
 * A page's `order` front matter key is its sort position among its siblings.
 * Pages with an `order` come first, ascending; pages without one follow, by
 * title (numbers compared numerically). Equal orders fall back to the title,
 * then the id, so the order is always total.
 *
 * Moving a page writes `order` into that page's own front matter only, using
 * values with room between them (sparse), so one move is one changed file.
 * Other siblings are written only when a move needs them (see {@link planReorder}).
 */

/** What sorting siblings needs of a page. */
export interface Orderable {
  id: string;
  /** Display title: the file name without extension, or the folder name. */
  name: string;
  order?: number;
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** `Array.prototype.sort` comparator for siblings: by `order`, then title, then id. */
export function compareSiblings(a: Orderable, b: Orderable): number {
  if (a.order !== undefined && b.order !== undefined && a.order !== b.order)
    return a.order < b.order ? -1 : 1;
  if ((a.order === undefined) !== (b.order === undefined)) return a.order === undefined ? 1 : -1;
  return collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** The gap between neighbouring orders when pages are numbered from scratch. */
export const ORDER_STEP = 1024;

/** The smallest gap between two orders worth splitting. */
const MIN_GAP = 1e-6;

/** A new `order` value for a page. */
export interface OrderPatch {
  id: string;
  order: number;
}

/**
 * The `order` values to write so that `movedId` ends up at `index` among its
 * siblings (`index` counts the siblings without it; past the end means last).
 * `siblings` are in the order they are shown, the moved page included.
 *
 * The cheap case writes only the moved page: every page before it already has
 * an `order` (otherwise it would sort after the moved page) and there is room
 * between its new neighbours, so it takes a value between them. Otherwise the
 * pages before it, it, and the ordered pages after it are numbered from zero in
 * steps of {@link ORDER_STEP}, writing only values that change. Pages after it
 * that have no `order` are left alone: they already sort after every ordered page.
 * Returns `[]` when the page is already there.
 */
export function planReorder(
  siblings: readonly { id: string; order?: number }[],
  movedId: string,
  index: number,
): OrderPatch[] {
  const moved = siblings.find((s) => s.id === movedId);
  if (!moved) return [];
  const rest = siblings.filter((s) => s.id !== movedId);
  const at = Math.min(Math.max(Math.trunc(index), 0), rest.length);
  if (siblings.findIndex((s) => s.id === movedId) === at) return [];

  const before = rest.slice(0, at);
  const after = rest.slice(at);

  if (before.every((s) => s.order !== undefined)) {
    const low = before.at(-1)?.order;
    const high = after[0]?.order;
    let order: number | undefined;
    if (low === undefined && high === undefined) order = 0;
    else if (low === undefined) order = high! - ORDER_STEP;
    else if (high === undefined) order = low + ORDER_STEP;
    else if (high - low > MIN_GAP) order = (low + high) / 2;
    if (order !== undefined) return [{ id: movedId, order }];
  }

  const patches: OrderPatch[] = [];
  const sequence = [...before, moved, ...after.filter((s) => s.order !== undefined)];
  sequence.forEach((s, position) => {
    const order = position * ORDER_STEP;
    if (s.order !== order) patches.push({ id: s.id, order });
  });
  return patches;
}
