// The scroll-driven motion the landing sections share: where a section is in
// the viewport, and the easing that turns that into movement.
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { TOP_BAR_HEIGHT } from '../../Navigation/Toolbar/Toolbar';

/** Gutter of Layout's <main>, which a full-bleed section cancels. */
export const useGutter = () => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  return {
    phone,
    gutter: phone ? 16 : 32,
    topBar: phone ? TOP_BAR_HEIGHT.phone : TOP_BAR_HEIGHT.desktop,
  };
};

/**
 * How much to enlarge a section's content on a big screen. The sections are
 * laid out for a 1440 by 900 window; a 4K monitor at 100% is more than twice
 * that, and the content sat small in the middle of empty paper. The scale
 * follows the narrower of width and height, so nothing outgrows the screen.
 */
export const useStageScale = () => {
  const { phone, topBar } = useGutter();
  const measure = React.useCallback(
    () =>
      phone
        ? 1
        : Math.min(
            2.5,
            Math.max(1, Math.min(window.innerWidth / 1440, (window.innerHeight - topBar) / 820)),
          ),
    [phone, topBar],
  );
  const [scale, setScale] = useState(measure);
  useEffect(() => {
    const onResize = () => setScale(measure());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);
  return scale;
};

export const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Progress of `p` through the window [a, b], clamped to 0..1. */
export const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Scroll progress of a tall section through the viewport: 0 when its top
 * reaches `offset`, 1 when its bottom reaches the bottom of the viewport.
 */
export const useSectionProgress = (offset = 0) => {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(prefersReducedMotion() ? 1 : 0);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const distance = rect.height - (window.innerHeight - offset);
      setProgress(distance > 0 ? clamp01((offset - rect.top) / distance) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [offset]);

  return { ref, progress };
};
