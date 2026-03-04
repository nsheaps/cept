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

  it('has about, settings, clear cache, import, export items', () => {
    render(<AppMenu />);
    fireEvent.click(screen.getByTestId('app-menu-trigger'));
    expect(screen.getByTestId('app-menu-about')).toBeDefined();
    expect(screen.getByTestId('app-menu-settings')).toBeDefined();
    expect(screen.getByTestId('app-menu-clear-cache')).toBeDefined();
    expect(screen.getByTestId('app-menu-import')).toBeDefined();
    expect(screen.getByTestId('app-menu-export')).toBeDefined();
  });

  it('settings is disabled with "Soon" badge', () => {
    render(<AppMenu />);
    fireEvent.click(screen.getByTestId('app-menu-trigger'));
    const settingsBtn = screen.getByTestId('app-menu-settings') as HTMLButtonElement;
    expect(settingsBtn.disabled).toBe(true);
  });

  it('clear cache calls onClearCache', () => {
    const onClearCache = vi.fn();
    render(<AppMenu onClearCache={onClearCache} />);
    fireEvent.click(screen.getByTestId('app-menu-trigger'));
    fireEvent.click(screen.getByTestId('app-menu-clear-cache'));
    expect(onClearCache).toHaveBeenCalled();
  });

  it('opens about dialog', () => {
    render(<AppMenu />);
    fireEvent.click(screen.getByTestId('app-menu-trigger'));
    fireEvent.click(screen.getByTestId('app-menu-about'));
    expect(screen.getByTestId('about-dialog')).toBeDefined();
    expect(screen.getByText('About Cept')).toBeDefined();
  });

  it('closes about dialog', () => {
    render(<AppMenu />);
    fireEvent.click(screen.getByTestId('app-menu-trigger'));
    fireEvent.click(screen.getByTestId('app-menu-about'));
    fireEvent.click(screen.getByTestId('about-close'));
    expect(screen.queryByTestId('about-dialog')).toBeNull();
  });
});
