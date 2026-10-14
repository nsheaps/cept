import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import type { Editor } from '@tiptap/core';
import { expect } from 'vitest';
import { CeptEditor } from '@cept/ui';

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

const feature = await loadFeature('features/editor/slash-commands.feature');

type EditorDom = HTMLElement & { editor: Editor };

async function openEditor(): Promise<Editor> {
  render(<CeptEditor content="" />);
  const dom = await waitFor(() => {
    const el = screen
      .getByTestId('cept-editor')
      .querySelector<HTMLElement & { editor?: Editor }>('.tiptap');
    if (!el?.editor) throw new Error('editor not ready');
    return el as EditorDom;
  });
  return dom.editor;
}

/** Send a key to the editor the way the browser would (the slash menu handles it). */
function press(editor: Editor, key: string): void {
  act(() => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, event));
  });
}

const menu = () => screen.queryByTestId('slash-command-menu');

describeFeature(feature, ({ Background, Scenario, AfterEachScenario }) => {
  let editor: Editor;

  AfterEachScenario(() => cleanup());

  Background(({ Given }) => {
    Given('I have a workspace with a page open in the editor', async () => {
      editor = await openEditor();
    });
  });

  const typeText = async (text: string) => {
    act(() => {
      editor
        .chain()
        .setTextSelection(editor.state.doc.content.size - 1)
        .insertContent(text)
        .run();
    });
  };

  Scenario('Opening the slash menu', ({ When, Then, And }) => {
    When('I type "/" on an empty line', () => typeText('/'));

    Then('I should see the slash command menu', async () => {
      expect(await screen.findByTestId('slash-command-menu')).toBeTruthy();
    });

    And('the menu should contain at least 20 block types', async () => {
      const items = await screen.findAllByTestId(/^slash-item-/);
      expect(items.length).toBeGreaterThanOrEqual(20);
    });

    And('the menu should be grouped by category', () => {
      const categories = document.querySelectorAll('.cept-slash-menu-category');
      expect(categories.length).toBeGreaterThan(1);
    });
  });

  Scenario('Filtering slash menu by typing', ({ When, Then, And }) => {
    When('I type "/mer"', () => typeText('/mer'));

    Then('I should see the slash command menu filtered to "Mermaid"', async () => {
      expect(await screen.findByTestId('slash-item-mermaid-diagram')).toBeTruthy();
    });

    And('only matching items should be visible', async () => {
      const items = await screen.findAllByTestId(/^slash-item-/);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) expect(item.textContent?.toLowerCase()).toContain('mer');
    });
  });

  Scenario('Inserting a heading via slash command', ({ When, And, Then }) => {
    When('I type "/large"', () => typeText('/large'));

    And('I press Enter', async () => {
      await screen.findByTestId('slash-command-menu');
      press(editor, 'Enter');
    });

    Then('the current block should become a Heading 1', async () => {
      await waitFor(() => expect(editor.isActive('heading', { level: 1 })).toBe(true));
    });

    And('the slash menu should close', async () => {
      await waitFor(() => expect(menu()).toBeNull());
    });
  });

  Scenario('Dismissing the slash menu', ({ When, And, Then }) => {
    When('I type "/"', () => typeText('/'));

    And('I press Escape', async () => {
      await screen.findByTestId('slash-command-menu');
      press(editor, 'Escape');
    });

    Then('the slash menu should close', async () => {
      await waitFor(() => expect(menu()).toBeNull());
    });

    And('the "/" character should remain in the text', () => {
      expect(editor.getText()).toContain('/');
    });
  });

  Scenario('Keyboard navigation in slash menu', ({ When, And, Then }) => {
    let titles: string[] = [];

    When('I type "/"', () => typeText('/'));

    And('I press the down arrow 3 times', async () => {
      const items = await screen.findAllByTestId(/^slash-item-/);
      titles = items.map((item) => item.querySelector('.cept-slash-menu-title')!.textContent!);
      for (let i = 0; i < 3; i++) press(editor, 'ArrowDown');
    });

    And('I press Enter', () => press(editor, 'Enter'));

    Then('the third item in the menu should be inserted', async () => {
      // Three presses from the first row land on the fourth entry; the scenario's
      // "third item" counts the moves, not the starting row. Pin that entry and prove
      // it is the one that ran, so a 2- or 4-step bug fails here.
      expect(titles[3]).toBe('Code Block');
      await waitFor(() => expect(menu()).toBeNull());
      expect(editor.getText()).not.toContain('/');
      expect(editor.getHTML()).toContain('<pre');
    });
  });

  Scenario('No database blocks', ({ When, Then }) => {
    When('I type "/database"', () => typeText('/database'));

    Then('the slash menu should show "No results"', async () => {
      expect((await screen.findByText('No results')).textContent).toBe('No results');
    });
  });
});
