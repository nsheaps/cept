import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MobileToolbar } from './MobileToolbar.js';
import type { MobileToolbarAction } from './MobileToolbar.js';

const actions: MobileToolbarAction[] = [
  { id: 'bold', label: 'Bold', icon: 'B' },
  { id: 'italic', label: 'Italic', icon: 'I' },
  { id: 'link', label: 'Link', icon: '🔗', disabled: true },
];

describe('MobileToolbar', () => {
  it('renders all action buttons', () => {
    const { container } = render(
      <MobileToolbar actions={actions} onAction={() => {}} />,
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(3);
  });

  it('renders nothing when visible is false', () => {
    const { container } = render(
      <MobileToolbar actions={actions} onAction={() => {}} visible={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('calls onAction with correct id on click', () => {
    const onAction = vi.fn();
    const { container } = render(
      <MobileToolbar actions={actions} onAction={onAction} />,
    );
    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[0]);
    expect(onAction).toHaveBeenCalledWith('bold');
  });

  it('does not fire onAction for disabled buttons', () => {
    const onAction = vi.fn();
    const { container } = render(
      <MobileToolbar actions={actions} onAction={onAction} />,
    );
    const buttons = container.querySelectorAll('button');
    // The link button is disabled
    fireEvent.click(buttons[2]);
    // Disabled buttons don't fire click events in the DOM
    expect(onAction).not.toHaveBeenCalled();
  });

  it('sets aria-pressed for active actions', () => {
    const activeActions: MobileToolbarAction[] = [
      { id: 'bold', label: 'Bold', icon: 'B', active: true },
      { id: 'italic', label: 'Italic', icon: 'I', active: false },
    ];
    const { container } = render(
      <MobileToolbar actions={activeActions} onAction={() => {}} />,
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('has toolbar role with label', () => {
    const { container } = render(
      <MobileToolbar actions={actions} onAction={() => {}} />,
    );
    const toolbar = container.querySelector('[role="toolbar"]');
    expect(toolbar).toBeDefined();
    expect(toolbar!.getAttribute('aria-label')).toBe('Formatting');
  });

  it('renders action icons as button content', () => {
    const { container } = render(
      <MobileToolbar actions={actions} onAction={() => {}} />,
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].textContent).toBe('B');
    expect(buttons[1].textContent).toBe('I');
  });

  it('sets aria-label on each button', () => {
    const { container } = render(
      <MobileToolbar actions={actions} onAction={() => {}} />,
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].getAttribute('aria-label')).toBe('Bold');
    expect(buttons[1].getAttribute('aria-label')).toBe('Italic');
  });

  it('applies minimum touch target size', () => {
    const { container } = render(
      <MobileToolbar actions={actions} onAction={() => {}} />,
    );
    const btn = container.querySelector('button');
    expect(btn!.style.minWidth).toBe('44px');
    expect(btn!.style.minHeight).toBe('44px');
  });
});
