import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppMenu } from './AppMenu.js';

describe('AppMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trigger button', () => {
    render(<AppMenu />);
    expect(screen.getByTestId('app-menu-trigger')).toBeDefined();
  });

  it('opens menu on click', () => {
    render(<AppMenu />);
    fireEvent.click(screen.getByTestId('app-menu-trigger'));
    expect(screen.getByTestId('app-menu')).toBeDefined();
  });

  it('has settings and about items', () => {
    render(<AppMenu />);
    fireEvent.click(screen.getByTestId('app-menu-trigger'));
    expect(screen.getByTestId('app-menu-settings')).toBeDefined();
    expect(screen.getByTestId('app-menu-about')).toBeDefined();
  });

  it('settings item calls onOpenSettings with settings tab', () => {
    const onOpenSettings = vi.fn();
    render(<AppMenu onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByTestId('app-menu-trigger'));
    fireEvent.click(screen.getByTestId('app-menu-settings'));
    expect(onOpenSettings).toHaveBeenCalledWith('settings');
  });

  it('about item calls onOpenSettings with about tab', () => {
    const onOpenSettings = vi.fn();
    render(<AppMenu onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByTestId('app-menu-trigger'));
    fireEvent.click(screen.getByTestId('app-menu-about'));
    expect(onOpenSettings).toHaveBeenCalledWith('about');
  });
});
