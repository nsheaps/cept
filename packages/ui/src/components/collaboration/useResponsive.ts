/**
 * useResponsive — Hook for responsive layout detection.
 *
 * Provides viewport breakpoint info, touch detection, and
 * safe area insets for mobile-adaptive layouts.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface ResponsiveState {
  /** Current breakpoint */
  breakpoint: Breakpoint;
  /** Viewport width */
  width: number;
  /** Viewport height */
  height: number;
  /** Is a touch device */
  isTouch: boolean;
  /** Is mobile breakpoint */
  isMobile: boolean;
  /** Is tablet breakpoint */
  isTablet: boolean;
  /** Is desktop breakpoint */
  isDesktop: boolean;
  /** Is in landscape orientation */
  isLandscape: boolean;
}

export interface BreakpointConfig {
  /** Mobile max width. Default: 640 */
  mobile: number;
  /** Tablet max width. Default: 1024 */
  tablet: number;
}

const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  mobile: 640,
  tablet: 1024,
};

function getBreakpoint(width: number, config: BreakpointConfig): Breakpoint {
  if (width <= config.mobile) return 'mobile';
  if (width <= config.tablet) return 'tablet';
  return 'desktop';
}

function detectTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function useResponsive(config?: Partial<BreakpointConfig>): ResponsiveState {
  const breakpoints = useMemo(
    () => ({ ...DEFAULT_BREAKPOINTS, ...config }),
    [config],
  );

  const [state, setState] = useState<ResponsiveState>(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const height = typeof window !== 'undefined' ? window.innerHeight : 768;
    const bp = getBreakpoint(width, breakpoints);
    return {
      breakpoint: bp,
      width,
      height,
      isTouch: detectTouch(),
      isMobile: bp === 'mobile',
      isTablet: bp === 'tablet',
      isDesktop: bp === 'desktop',
      isLandscape: width > height,
    };
  });

  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const bp = getBreakpoint(width, breakpoints);
    setState({
      breakpoint: bp,
      width,
      height,
      isTouch: detectTouch(),
      isMobile: bp === 'mobile',
      isTablet: bp === 'tablet',
      isDesktop: bp === 'desktop',
      isLandscape: width > height,
    });
  }, [breakpoints]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  return state;
}

export { getBreakpoint, detectTouch, DEFAULT_BREAKPOINTS };
