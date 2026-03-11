import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewToast } from './PreviewToast.js';

describe('PreviewToast', () => {
  const defaultProps = {
    prNumber: '42',
    repoUrl: 'https://github.com/nsheaps/cept',
    productionUrl: 'https://nsheaps.github.io/cept/app/',
  };

  it('renders nothing when prNumber is empty', () => {
    const { container } = render(
      <PreviewToast prNumber="" repoUrl="" productionUrl="" />,
    );
    expect(container.querySelector('[data-testid="preview-toast"]')).toBeNull();
  });

  it('shows PR number and links to PR when visible', () => {
    render(<PreviewToast {...defaultProps} />);
    const link = screen.getByText('PR #42');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe(
      'https://github.com/nsheaps/cept/pull/42',
    );
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('shows production link', () => {
    render(<PreviewToast {...defaultProps} />);
    const link = screen.getByText('View production');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe(
      'https://nsheaps.github.io/cept/app/',
    );
  });

  it('hides production link when productionUrl is empty', () => {
    render(<PreviewToast {...defaultProps} productionUrl="" />);
    expect(screen.queryByText('View production')).toBeNull();
  });

  it('dismisses when close button is clicked', () => {
    render(<PreviewToast {...defaultProps} />);
    expect(screen.getByTestId('preview-toast')).toBeTruthy();

    const button = screen.getByLabelText('Dismiss notification');
    fireEvent.click(button);

    expect(screen.queryByTestId('preview-toast')).toBeNull();
  });

  it('has accessible role and aria-live', () => {
    render(<PreviewToast {...defaultProps} />);
    const el = screen.getByRole('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });
});
