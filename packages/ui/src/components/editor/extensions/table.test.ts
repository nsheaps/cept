import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

function createEditorWithTable(content = '') {
  return new Editor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content,
  });
}

describe('Table extension', () => {
  it('registers table node type', () => {
    const editor = createEditorWithTable();
    const nodeTypes = Object.keys(editor.schema.nodes);
    expect(nodeTypes).toContain('table');
    expect(nodeTypes).toContain('tableRow');
    expect(nodeTypes).toContain('tableCell');
    expect(nodeTypes).toContain('tableHeader');
    editor.destroy();
  });

  it('inserts a table with insertTable command', () => {
    const editor = createEditorWithTable('<p>Hello</p>');
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });

    const html = editor.getHTML();
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('<td');
    editor.destroy();
  });

  it('inserts a table with specified dimensions', () => {
    const editor = createEditorWithTable('<p></p>');
    editor.commands.insertTable({ rows: 2, cols: 4, withHeaderRow: true });

    const html = editor.getHTML();
    // 1 header row + 1 data row = 2 rows
    const trCount = (html.match(/<tr>/g) ?? []).length;
    expect(trCount).toBe(2);
    // 4 header cells
    const thCount = (html.match(/<th/g) ?? []).length;
    expect(thCount).toBe(4);
    editor.destroy();
  });

  it('can parse table HTML back into the editor', () => {
    const tableHtml = `
      <table>
        <tr><th>Name</th><th>Value</th></tr>
        <tr><td>Alpha</td><td>100</td></tr>
        <tr><td>Beta</td><td>200</td></tr>
      </table>
    `;
    const editor = createEditorWithTable(tableHtml);
    const output = editor.getHTML();
    expect(output).toContain('<table');
    expect(output).toContain('Name');
    expect(output).toContain('Alpha');
    expect(output).toContain('200');
    editor.destroy();
  });

  it('supports addColumnAfter command', () => {
    const editor = createEditorWithTable('<p></p>');
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });

    // Focus into first cell
    editor.commands.focus();
    const canAdd = editor.can().addColumnAfter();
    expect(canAdd).toBe(true);
    editor.destroy();
  });

  it('supports addRowAfter command', () => {
    const editor = createEditorWithTable('<p></p>');
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });

    editor.commands.focus();
    const canAdd = editor.can().addRowAfter();
    expect(canAdd).toBe(true);
    editor.destroy();
  });

  it('supports deleteTable command', () => {
    const editor = createEditorWithTable('<p></p>');
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });

    const htmlBefore = editor.getHTML();
    expect(htmlBefore).toContain('<table');

    editor.commands.focus();
    editor.commands.deleteTable();

    const htmlAfter = editor.getHTML();
    expect(htmlAfter).not.toContain('<table');
    editor.destroy();
  });
});
