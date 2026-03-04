import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CeptEditor } from './CeptEditor.js';

describe('CeptEditor — text blocks', () => {
  describe('Code block', () => {
    it('renders code block with language', async () => {
      render(
        <CeptEditor
          content='<pre class="cept-code-block"><code class="language-javascript">const x = 1;</code></pre>'
        />
      );
      await waitFor(() => {
        const editor = screen.getByTestId('cept-editor');
        expect(editor.querySelector('pre')).toBeTruthy();
        expect(editor.textContent).toContain('const x = 1;');
      });
    });

    it('renders code block without language', async () => {
      render(
        <CeptEditor
          content='<pre class="cept-code-block"><code>plain code</code></pre>'
        />
      );
      await waitFor(() => {
        const editor = screen.getByTestId('cept-editor');
        expect(editor.querySelector('pre')).toBeTruthy();
        expect(editor.textContent).toContain('plain code');
      });
    });
  });

  describe('Blockquote', () => {
    it('renders blockquote content', async () => {
      render(
        <CeptEditor content="<blockquote><p>A wise quote</p></blockquote>" />
      );
      await waitFor(() => {
        const editor = screen.getByTestId('cept-editor');
        expect(editor.querySelector('blockquote')).toBeTruthy();
        expect(editor.textContent).toContain('A wise quote');
      });
    });

    it('renders nested blockquote content', async () => {
      render(
        <CeptEditor content="<blockquote><p>Line one</p><p>Line two</p></blockquote>" />
      );
      await waitFor(() => {
        const editor = screen.getByTestId('cept-editor');
        const bq = editor.querySelector('blockquote');
        expect(bq).toBeTruthy();
        expect(bq?.textContent).toContain('Line one');
        expect(bq?.textContent).toContain('Line two');
      });
    });
  });

  describe('Callout', () => {
    it('renders callout block with icon and content', async () => {
      render(
        <CeptEditor
          content='<div data-type="callout" data-icon="\uD83D\uDCA1" data-color="blue"><p>Important info</p></div>'
        />
      );
      await waitFor(() => {
        const editor = screen.getByTestId('cept-editor');
        const callout = editor.querySelector('[data-type="callout"]');
        expect(callout).toBeTruthy();
        expect(editor.textContent).toContain('Important info');
      });
    });

    it('renders callout with default icon', async () => {
      render(
        <CeptEditor
          content='<div data-type="callout"><p>Default callout</p></div>'
        />
      );
      await waitFor(() => {
        const editor = screen.getByTestId('cept-editor');
        const callout = editor.querySelector('[data-type="callout"]');
        expect(callout).toBeTruthy();
        expect(editor.textContent).toContain('Default callout');
      });
    });
  });

  describe('Toggle', () => {
    it('renders toggle block with summary', async () => {
      render(
        <CeptEditor
          content='<details data-type="toggle"><summary>Click me</summary><div><p>Hidden content</p></div></details>'
        />
      );
      await waitFor(() => {
        const editor = screen.getByTestId('cept-editor');
        const toggle = editor.querySelector('[data-type="toggle"]');
        expect(toggle).toBeTruthy();
        expect(editor.textContent).toContain('Click me');
      });
    });
  });

  describe('Horizontal rule / divider', () => {
    it('renders horizontal rule between paragraphs', async () => {
      render(
        <CeptEditor content="<p>Above</p><hr><p>Below</p>" />
      );
      await waitFor(() => {
        const editor = screen.getByTestId('cept-editor');
        expect(editor.querySelector('hr')).toBeTruthy();
        expect(editor.textContent).toContain('Above');
        expect(editor.textContent).toContain('Below');
      });
    });
  });

  describe('Mixed content', () => {
    it('renders combination of text blocks', async () => {
      render(
        <CeptEditor
          content={`
            <h1>Document Title</h1>
            <p>Introduction paragraph.</p>
            <blockquote><p>A relevant quote</p></blockquote>
            <pre class="cept-code-block"><code class="language-typescript">const y: number = 42;</code></pre>
            <hr>
            <p>Conclusion.</p>
          `}
        />
      );
      await waitFor(() => {
        const editor = screen.getByTestId('cept-editor');
        expect(editor.querySelector('h1')?.textContent).toBe('Document Title');
        expect(editor.querySelector('blockquote')).toBeTruthy();
        expect(editor.querySelector('pre')).toBeTruthy();
        expect(editor.querySelector('hr')).toBeTruthy();
        expect(editor.textContent).toContain('Conclusion');
      });
    });
  });
});
