import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { expandToNode, Sidebar, type PageTreeNode } from '@cept/ui';
import { cleanup, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';

const feature = await loadFeature('features/navigation/sidebar.feature');

const page = (id: string, title: string, children: PageTreeNode[] = []): PageTreeNode => ({
  id,
  title,
  children,
});

/** Flip `isExpanded` on one node, the way the app does when a toggle is clicked. */
function toggled(nodes: PageTreeNode[], id: string): PageTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    ...(node.id === id ? { isExpanded: !node.isExpanded } : {}),
    children: toggled(node.children, id),
  }));
}

/** Move `id` to `index` among the root pages, the way the app applies a reorder. */
function reordered(nodes: PageTreeNode[], id: string, index: number): PageTreeNode[] {
  const moved = nodes.find((n) => n.id === id);
  if (!moved) return nodes;
  const rest = nodes.filter((n) => n.id !== id);
  return [...rest.slice(0, index), moved, ...rest.slice(index)];
}

/** The sidebar with the state the app keeps for it: the tree, its expanded nodes and the order. */
function Harness({ initial, selectedId }: { initial: PageTreeNode[]; selectedId?: string }) {
  // Opening a page expands the path to it (App does the same with expandToNode).
  const [pages, setPages] = useState(() =>
    selectedId ? expandToNode(initial, selectedId) : initial,
  );
  return (
    <Sidebar
      pages={pages}
      {...(selectedId ? { selectedPageId: selectedId } : {})}
      onPageToggle={(id) => setPages((prev) => toggled(prev, id))}
      onPageReorder={(id, index) => setPages((prev) => reordered(prev, id, index))}
    />
  );
}

const button = (id: string) => screen.getByTestId(`page-tree-button-${id}`);
const toggle = (id: string) => screen.getByTestId(`page-tree-toggle-${id}`);
const present = (id: string) => screen.queryByTestId(`page-tree-item-${id}`) !== null;
/** The titles of the rows in the page tree, top to bottom. */
const rows = () =>
  within(screen.getByTestId('page-tree'))
    .getAllByTestId(/^page-tree-button-/)
    .map((el) => el.querySelector('.cept-sidebar-title')!.textContent);

// jsdom's drag events carry no coordinates, so set clientY on the event itself; rows are
// 0 high at y = 0, so clientY < 0 is the upper half of a row ("before").
const dragAt = (type: 'dragOver' | 'drop', el: HTMLElement, dataTransfer: object, y: number) => {
  const event = createEvent[type](el, { dataTransfer });
  Object.defineProperty(event, 'clientY', { value: y });
  fireEvent(el, event);
};

describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  AfterEachScenario(() => cleanup());

  Scenario('Sidebar shows page tree', ({ Given, Then, And }) => {
    Given('I have a workspace with nested pages', () => {
      render(
        <Harness
          initial={[
            page('home.md', 'Home'),
            page('projects', 'Projects', [
              page('projects/alpha.md', 'Alpha'),
              page('projects/beta.md', 'Beta'),
            ]),
            page('notes.md', 'Notes'),
          ]}
        />,
      );
    });

    Then('the sidebar should show a tree of all pages', () => {
      expect(rows()).toEqual(['Home', 'Projects', 'Notes']);
      // The nested pages are in the tree too, once their parent is open.
      fireEvent.click(toggle('projects'));
      expect(rows()).toEqual(['Home', 'Projects', 'Alpha', 'Beta', 'Notes']);
      fireEvent.click(toggle('projects'));
      expect(rows()).toEqual(['Home', 'Projects', 'Notes']);
    });

    And('pages with children should have expand/collapse controls', () => {
      // Only a page with children shows a control; the others keep the space but hide it.
      expect(toggle('projects').classList.contains('invisible')).toBe(false);
      expect(toggle('home.md').classList.contains('invisible')).toBe(true);
      expect(toggle('projects').textContent).toBe('▶');
      fireEvent.click(toggle('projects'));
      expect(toggle('projects').textContent).toBe('▼');
      expect(present('projects/alpha.md')).toBe(true);
    });
  });

  Scenario('Current page is highlighted', ({ Given, Then, And }) => {
    Given('I am viewing a page nested 3 levels deep', () => {
      render(
        <Harness
          selectedId="guides/setup/install.md"
          initial={[
            page('guides', 'Guides', [
              page('guides/setup', 'Setup', [
                page('guides/setup/install.md', 'Install'),
                page('guides/setup/config.md', 'Config'),
              ]),
            ]),
            page('archive', 'Archive', [page('archive/old.md', 'Old')]),
          ]}
        />,
      );
    });

    Then('that page should be highlighted in the sidebar', () => {
      expect(button('guides/setup/install.md').classList.contains('is-selected')).toBe(true);
      expect(button('guides/setup/config.md').classList.contains('is-selected')).toBe(false);
    });

    And('all ancestor pages should be auto-expanded', () => {
      expect(toggle('guides').textContent).toBe('▼');
      expect(toggle('guides/setup').textContent).toBe('▼');
      expect(rows()).toEqual(['Guides', 'Setup', 'Install', 'Config', 'Archive']);
      // Pages that are not on the way stay as they were.
      expect(present('archive/old.md')).toBe(false);
    });
  });

  Scenario('Drag to reorder pages', ({ Given, When, Then }) => {
    Given('I have two sibling pages "Page A" and "Page B"', () => {
      render(<Harness initial={[page('a.md', 'Page A'), page('b.md', 'Page B')]} />);
      expect(rows()).toEqual(['Page A', 'Page B']);
    });

    When('I drag "Page B" above "Page A"', () => {
      const dataTransfer = { setData: () => undefined, effectAllowed: '', dropEffect: '' };
      fireEvent.dragStart(button('b.md'), { dataTransfer });
      dragAt('dragOver', button('a.md'), dataTransfer, -1);
      expect(button('a.md').getAttribute('data-drop')).toBe('before');
      dragAt('drop', button('a.md'), dataTransfer, -1);
    });

    Then('"Page B" should appear before "Page A" in the sidebar', () => {
      expect(rows()).toEqual(['Page B', 'Page A']);
    });
  });
});
