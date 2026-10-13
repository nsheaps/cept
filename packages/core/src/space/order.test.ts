import { describe, it, expect } from 'vitest';
import { compareSiblings, planReorder } from './order.js';

const page = (name: string, order?: number) => ({
  id: `${name}.md`,
  name,
  ...(order !== undefined ? { order } : {}),
});

const sorted = (pages: ReturnType<typeof page>[]) =>
  [...pages].sort(compareSiblings).map((p) => p.name);

describe('compareSiblings', () => {
  it('sorts by order, then by title', () => {
    expect(sorted([page('b', 2), page('a', 2), page('z', 1)])).toEqual(['z', 'a', 'b']);
  });

  it('puts pages without an order after those with one, then by title', () => {
    expect(sorted([page('a'), page('c', 5), page('b'), page('d', -3)])).toEqual([
      'd',
      'c',
      'a',
      'b',
    ]);
  });

  it('compares numbers in titles numerically when nothing has an order', () => {
    expect(sorted([page('10-b'), page('2-a')])).toEqual(['2-a', '10-b']);
  });

  it('is stable for pages with the same title and order, by id', () => {
    const a = { id: 'a/x.md', name: 'x' };
    const b = { id: 'b/x.md', name: 'x' };
    expect([b, a].sort(compareSiblings)).toEqual([a, b]);
  });
});

describe('planReorder', () => {
  const list = (...entries: Array<[string, number?]>) =>
    entries.map(([id, order]) => ({ id, ...(order !== undefined ? { order } : {}) }));

  it('writes nothing when the page stays where it is', () => {
    expect(planReorder(list(['a', 1024], ['b', 2048], ['c']), 'b', 1)).toEqual([]);
  });

  it('writes only the moved page when there is room between its new neighbours', () => {
    expect(planReorder(list(['a', 1024], ['b', 2048], ['c', 3072]), 'c', 1)).toEqual([
      { id: 'c', order: 1536 },
    ]);
  });

  it('puts a page first by going below the first order', () => {
    expect(planReorder(list(['a', 1024], ['b', 2048]), 'b', 0)).toEqual([{ id: 'b', order: 0 }]);
  });

  it('puts a page last by going above the last order', () => {
    expect(planReorder(list(['a', 1024], ['b', 2048]), 'a', 1)).toEqual([{ id: 'a', order: 3072 }]);
  });

  it('orders a page first among pages that have no order, leaving them alone', () => {
    expect(planReorder(list(['a'], ['b'], ['c']), 'c', 0)).toEqual([{ id: 'c', order: 0 }]);
  });

  it('gives an order to the pages before the moved page when they have none', () => {
    // a, b, c unordered; c moves between a and b → a, c, b. a needs an order so c can follow it.
    expect(planReorder(list(['a'], ['b'], ['c']), 'c', 1)).toEqual([
      { id: 'a', order: 0 },
      { id: 'c', order: 1024 },
    ]);
  });

  it('renumbers the siblings that need it when two orders leave no room', () => {
    const plan = planReorder(list(['a', 1], ['b', 1], ['c', 5]), 'c', 1);
    expect(plan).toEqual([
      { id: 'a', order: 0 },
      { id: 'c', order: 1024 },
      { id: 'b', order: 2048 },
    ]);
  });

  it('keeps ordered pages after the moved page behind it', () => {
    const plan = planReorder(list(['a'], ['b', 10], ['c']), 'c', 1);
    const orders = new Map([
      ['a', undefined as number | undefined],
      ['b', 10],
      ['c', undefined],
    ]);
    for (const { id, order } of plan) orders.set(id, order);
    expect(orders.get('a')).toBeLessThan(orders.get('c')!);
    expect(orders.get('c')).toBeLessThan(orders.get('b')!);
  });

  it('clamps an index past the end', () => {
    expect(planReorder(list(['a', 1024], ['b', 2048]), 'a', 99)).toEqual([
      { id: 'a', order: 3072 },
    ]);
  });

  it('every plan sorts the pages into the requested order', () => {
    const cases = [
      list(['a'], ['b'], ['c'], ['d']),
      list(['a', 1], ['b', 1], ['c', 1], ['d', 1]),
      list(['a', 0], ['b', 0.0000001], ['c', 0.0000002], ['d']),
      list(['a', 5], ['b'], ['c', 2], ['d', 9]),
    ];
    for (const raw of cases) {
      // planReorder takes the siblings in the order they are shown.
      const siblings = [...raw].sort((a, b) =>
        compareSiblings({ ...a, name: a.id }, { ...b, name: b.id }),
      );
      for (const moved of siblings) {
        for (let index = 0; index < siblings.length; index++) {
          const want = [...siblings.filter((s) => s.id !== moved.id)];
          want.splice(index, 0, moved);
          const plan = new Map(planReorder(siblings, moved.id, index).map((p) => [p.id, p.order]));
          const after = siblings.map((s) => ({
            id: s.id,
            name: s.id,
            ...(plan.has(s.id) || s.order !== undefined
              ? { order: plan.get(s.id) ?? s.order }
              : {}),
          }));
          const got = [...after].sort(compareSiblings).map((s) => s.id);
          const expected = want.map((s) => s.id);
          // A plan for the page's own position changes nothing and may leave ties to the title.
          if (siblings.map((s) => s.id).join() === expected.join()) continue;
          expect(got).toEqual(expected);
        }
      }
    }
  });
});
