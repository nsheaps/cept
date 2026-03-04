import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { LoadingSpinner, EmptyState } from './LoadingSpinner.js';

describe('LoadingSpinner', () => {
  it('renders with status role', () => {
    const { container } = render(<LoadingSpinner />);
    const el = container.querySelector('[role="status"]');
    expect(el).toBeDefined();
  });

  it('has accessible label', () => {
    const { container } = render(<LoadingSpinner label="Saving" />);
    const el = container.querySelector('[role="status"]');
    expect(el!.getAttribute('aria-label')).toBe('Saving');
  });

  it('renders SVG spinner', () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('uses default label', () => {
    const { container } = render(<LoadingSpinner />);
    const el = container.querySelector('[role="status"]');
    expect(el!.getAttribute('aria-label')).toBe('Loading');
  });

  it('applies custom size', () => {
    const { container } = render(<LoadingSpinner size={48} />);
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('width')).toBe('48');
    expect(svg!.getAttribute('height')).toBe('48');
  });
});

describe('EmptyState', () => {
  it('renders title', () => {
    const { container } = render(<EmptyState title="No items" />);
    expect(container.textContent).toContain('No items');
  });

  it('renders description', () => {
    const { container } = render(
      <EmptyState title="Empty" description="Create your first item" />,
    );
    expect(container.textContent).toContain('Create your first item');
  });

  it('renders icon', () => {
    const { container } = render(
      <EmptyState title="Empty" icon="📭" />,
    );
    expect(container.textContent).toContain('📭');
  });

  it('renders action button', () => {
    const onAction = vi.fn();
    const { container } = render(
      <EmptyState title="Empty" actionLabel="Create" onAction={onAction} />,
    );
    const btn = container.querySelector('button');
    expect(btn).toBeDefined();
    expect(btn!.textContent).toBe('Create');
    fireEvent.click(btn!);
    expect(onAction).toHaveBeenCalled();
  });

  it('does not render button without actionLabel', () => {
    const { container } = render(<EmptyState title="Empty" />);
    const btn = container.querySelector('button');
    expect(btn).toBeNull();
  });

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBe(0);
  });
});
