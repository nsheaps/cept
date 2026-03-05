import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CeptEditor } from './CeptEditor.js';

describe('CeptEditor — table blocks', () => {
  it('renders a table from markdown content', async () => {
    render(
      <CeptEditor
        content={`| Name | Age |
| --- | --- |
| Alice | 30 |
| Bob | 25 |`}
      />
    );
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      expect(editor.querySelector('table')).toBeTruthy();
      expect(editor.textContent).toContain('Name');
      expect(editor.textContent).toContain('Alice');
      expect(editor.textContent).toContain('Bob');
    });
  });

  it('renders header cells as th elements', async () => {
    render(
      <CeptEditor
        content={`| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |`}
      />
    );
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      const headers = editor.querySelectorAll('th');
      expect(headers.length).toBe(2);
      expect(headers[0].textContent).toContain('Header 1');
      expect(headers[1].textContent).toContain('Header 2');
    });
  });

  it('renders data cells as td elements', async () => {
    render(
      <CeptEditor
        content={`| Col A | Col B |
| --- | --- |
| Data A | Data B |`}
      />
    );
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      const cells = editor.querySelectorAll('td');
      expect(cells.length).toBe(2);
      expect(cells[0].textContent).toContain('Data A');
      expect(cells[1].textContent).toContain('Data B');
    });
  });

  it('renders a table with multiple rows', async () => {
    render(
      <CeptEditor
        content={`| ID | Name | Status |
| --- | --- | --- |
| 1 | Task A | Done |
| 2 | Task B | In Progress |
| 3 | Task C | Pending |`}
      />
    );
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      const rows = editor.querySelectorAll('tr');
      expect(rows.length).toBe(4); // 1 header + 3 data rows
      expect(editor.textContent).toContain('In Progress');
    });
  });

  it('renders table alongside other content', async () => {
    render(
      <CeptEditor
        content={`## Project Status

Here is the current task breakdown:

| Task | Status |
| --- | --- |
| Design | Complete |

More details below.`}
      />
    );
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      expect(editor.querySelector('h2')?.textContent).toBe('Project Status');
      expect(editor.querySelector('table')).toBeTruthy();
      expect(editor.textContent).toContain('Design');
      expect(editor.textContent).toContain('More details below');
    });
  });

  it('preserves table structure on roundtrip', async () => {
    render(
      <CeptEditor
        content={`| X | Y |
| --- | --- |
| 1 | 2 |`}
      />
    );
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      expect(editor.querySelector('table')).toBeTruthy();
    });
    const editor = screen.getByTestId('cept-editor');
    const table = editor.querySelector('table');
    expect(table).toBeTruthy();
    expect(table?.querySelectorAll('th').length).toBe(2);
    expect(table?.querySelectorAll('td').length).toBe(2);
  });
});
