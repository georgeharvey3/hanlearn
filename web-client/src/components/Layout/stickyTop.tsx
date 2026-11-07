import { createContext, useContext } from 'react';

/**
 * The CSS `top` at which a page row sticks: directly below the top bar when
 * it shows, at the top of the viewport when it does not. The layout owns the
 * rule for the top bar, so a page reads the offset here and keeps no copy of
 * the bar's height. A notched phone's inset adds to the offset.
 */
export const stickyTopFor = (topBarHeight: number): string =>
  `calc(${topBarHeight}px + env(safe-area-inset-top))`;

const StickyTopContext = createContext<string>(stickyTopFor(0));

/** The `top` for a `position: sticky` row of the page. */
export const useStickyTop = (): string => useContext(StickyTopContext);

export const StickyTopProvider = StickyTopContext.Provider;
