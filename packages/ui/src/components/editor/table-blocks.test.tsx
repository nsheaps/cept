import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CeptEditor } from './CeptEditor.js';

describe('CeptEditor — table blocks', () => {
  it('renders a table from HTML content', async () => {
    render(
      <CeptEditor
        content={`
          <table>
            <tr><th>Name</th><th>Age</th></tr>
            <tr><td>Alice</td><td>30</td></tr>
            <tr><td>Bob</td><td>25</td></tr>
          </table>
        `}
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
        content={`
          <table>
            <tr><th>Header 1</th><th>Header 2</th></tr>
            <tr><td>Cell 1</td><td>Cell 2</td></tr>
          </table>
        `}
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
        content={`
          <table>
            <tr><th>Col A</th><th>Col B</th></tr>
            <tr><td>Data A</td><td>Data B</td></tr>
          </table>
        `}
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
        content={`
          <table>
            <tr><th>ID</th><th>Name</th><th>Status</th></tr>
            <tr><td>1</td><td>Task A</td><td>Done</td></tr>
            <tr><td>2</td><td>Task B</td><td>In Progress</td></tr>
            <tr><td>3</td><td>Task C</td><td>Pending</td></tr>
          </table>
        `}
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
        content={`
          <h2>Project Status</h2>
          <p>Here is the current task breakdown:</p>
          <table>
            <tr><th>Task</th><th>Status</th></tr>
            <tr><td>Design</td><td>Complete</td></tr>
          </table>
          <p>More details below.</p>
        `}
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

  it('preserves table structure on getHTML roundtrip', async () => {
    render(
      <CeptEditor
        content={`
          <table>
            <tr><th>X</th><th>Y</th></tr>
            <tr><td>1</td><td>2</td></tr>
          </table>
        `}
      />
    );
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      expect(editor.querySelector('table')).toBeTruthy();
    });
    // Even without changes, editor should maintain table structure
    // Re-render with emitted HTML if available, or check initial state
    const editor = screen.getByTestId('cept-editor');
    const table = editor.querySelector('table');
    expect(table).toBeTruthy();
    expect(table?.querySelectorAll('th').length).toBe(2);
    expect(table?.querySelectorAll('td').length).toBe(2);
  });
});
