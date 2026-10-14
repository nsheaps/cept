import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { KnowledgeGraphView, type KnowledgeGraphViewProps } from '@cept/ui';
import { buildGraphData } from '../../packages/ui/src/components/knowledge-graph/graph-types.js';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const feature = await loadFeature('features/graph/global-graph.feature');

type Page = Parameters<typeof buildGraphData>[0][number];

/** The view draws with the real D3, so nodes and edges are real SVG elements. */
function viewGraph(pages: Page[], onNodeClick?: KnowledgeGraphViewProps['onNodeClick']) {
  render(
    <KnowledgeGraphView data={buildGraphData(pages)} {...(onNodeClick ? { onNodeClick } : {})} />,
  );
}

const nodes = () => Array.from(document.querySelectorAll<SVGGElement>('.cept-graph-node'));
const nodeFor = (title: string) => {
  const found = nodes().find((n) => n.textContent === title);
  if (!found) throw new Error(`no node titled ${title}`);
  return found;
};
const radiusOf = (title: string) =>
  Number(nodeFor(title).querySelector('circle')!.getAttribute('r'));

describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  AfterEachScenario(() => cleanup());

  Scenario('Display global graph', ({ Given, When, Then, And }) => {
    // Ten pages in a chain, plus two shortcuts: 11 links between them.
    const pages: Page[] = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      title: `Page ${i}`,
      links: [
        ...(i < 9 ? [`p${i + 1}`] : []),
        ...(i === 0 ? ['p5'] : []),
        ...(i === 2 ? ['p8'] : []),
      ],
    }));
    const linkCount = pages.reduce((total, page) => total + (page.links?.length ?? 0), 0);

    Given('I have a workspace with 10 pages and links between them', () => {
      expect(pages).toHaveLength(10);
      expect(linkCount).toBe(11);
    });

    When('I open the global graph view', () => viewGraph(pages));

    Then('I should see nodes for all 10 pages', () => {
      expect(screen.getByTestId('graph-mode-global').className).toContain('is-active');
      expect(nodes().map((n) => n.textContent)).toEqual(pages.map((p) => p.title));
    });

    And('I should see edges for all links between pages', () => {
      expect(document.querySelectorAll('.cept-graph-link')).toHaveLength(linkCount);
    });
  });

  Scenario('Click node to navigate', ({ Given, When, Then }) => {
    // A plain recorder: each step is its own test, and a vi.fn() history does not carry over.
    let opened: string[] = [];
    const onNodeClick = (id: string) => opened.push(id);

    Given('I am viewing the global graph', () => {
      opened = [];
      viewGraph(
        [
          { id: 'home.md', title: 'Home', links: ['roadmap.md'] },
          { id: 'roadmap.md', title: 'Project Roadmap', links: ['home.md'] },
          { id: 'notes.md', title: 'Notes' },
        ],
        onNodeClick,
      );
      expect(nodes()).toHaveLength(3);
    });

    When('I click on a node representing "Project Roadmap"', () => {
      fireEvent.click(nodeFor('Project Roadmap'));
    });

    Then('I should navigate to the "Project Roadmap" page', async () => {
      // The page opens by its id; the graph also focuses the node it was asked about.
      expect(opened).toEqual(['roadmap.md']);
      await waitFor(() =>
        expect(screen.getByTestId('graph-focus-label').textContent).toContain('Project Roadmap'),
      );
    });
  });

  Scenario('Node size reflects connections', ({ Given, And, When, Then }) => {
    const pages: Page[] = [
      { id: 'hub', title: 'Hub' },
      { id: 'side', title: 'Side' },
      ...['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, title: id.toUpperCase(), links: ['hub'] })),
    ];
    pages[2] = { ...pages[2]!, links: ['hub', 'side'] };

    Given('I have a page with 5 incoming links', () => {
      expect(pages.filter((p) => p.links?.includes('hub'))).toHaveLength(5);
    });

    And('another page with 1 incoming link', () => {
      expect(pages.filter((p) => p.links?.includes('side'))).toHaveLength(1);
    });

    When('I view the global graph', () => viewGraph(pages));

    Then('the well-connected page should have a larger node', () => {
      expect(radiusOf('Hub')).toBeGreaterThan(radiusOf('Side'));
      expect(radiusOf('Side')).toBeGreaterThan(radiusOf('E'));
    });
  });
});
