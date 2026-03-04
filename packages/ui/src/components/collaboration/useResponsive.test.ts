import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResponsive } from './useResponsive.js';

describe('useResponsive', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
  });

  function setViewport(width: number, height: number) {
    Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: height, writable: true });
  }

  it('detects mobile breakpoint', () => {
    setViewport(400, 800);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.breakpoint).toBe('mobile');
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it('detects tablet breakpoint', () => {
    setViewport(768, 1024);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.breakpoint).toBe('tablet');
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it('detects desktop breakpoint', () => {
    setViewport(1280, 800);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.breakpoint).toBe('desktop');
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
  });

  it('reports viewport dimensions', () => {
    setViewport(1024, 768);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.width).toBe(1024);
    expect(result.current.height).toBe(768);
  });

  it('detects landscape orientation', () => {
    setViewport(1024, 600);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isLandscape).toBe(true);
  });

  it('detects portrait orientation', () => {
    setViewport(600, 1024);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isLandscape).toBe(false);
  });

  it('accepts custom breakpoint config', () => {
    setViewport(500, 800);
    const { result } = renderHook(() => useResponsive({ mobile: 320 }));
    // 500 > 320, so should be tablet not mobile
    expect(result.current.breakpoint).toBe('tablet');
  });

  it('updates on resize', () => {
    setViewport(1280, 800);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isDesktop).toBe(true);

    act(() => {
      setViewport(400, 800);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.isMobile).toBe(true);
    expect(result.current.breakpoint).toBe('mobile');
  });

  it('cleans up resize listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useResponsive());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('boundary: mobile max is inclusive', () => {
    setViewport(640, 800);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.breakpoint).toBe('mobile');
  });

  it('boundary: tablet starts at mobile+1', () => {
    setViewport(641, 800);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.breakpoint).toBe('tablet');
  });

  it('boundary: tablet max is inclusive', () => {
    setViewport(1024, 800);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.breakpoint).toBe('tablet');
  });

  it('boundary: desktop starts at tablet+1', () => {
    setViewport(1025, 800);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.breakpoint).toBe('desktop');
  });
});

describe('getBreakpoint', () => {
  it('is exported for direct use', async () => {
    const mod = await import('./useResponsive.js');
    expect(typeof mod.getBreakpoint).toBe('function');
    expect(mod.getBreakpoint(400, { mobile: 640, tablet: 1024 })).toBe('mobile');
    expect(mod.getBreakpoint(800, { mobile: 640, tablet: 1024 })).toBe('tablet');
    expect(mod.getBreakpoint(1200, { mobile: 640, tablet: 1024 })).toBe('desktop');
  });
});

describe('detectTouch', () => {
  it('is exported for direct use', async () => {
    const mod = await import('./useResponsive.js');
    expect(typeof mod.detectTouch).toBe('function');
    // Just verify it returns a boolean (jsdom environment may vary)
    expect(typeof mod.detectTouch()).toBe('boolean');
  });
});

describe('DEFAULT_BREAKPOINTS', () => {
  it('has expected values', async () => {
    const mod = await import('./useResponsive.js');
    expect(mod.DEFAULT_BREAKPOINTS.mobile).toBe(640);
    expect(mod.DEFAULT_BREAKPOINTS.tablet).toBe(1024);
  });
});
