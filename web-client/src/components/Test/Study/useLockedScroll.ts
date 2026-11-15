import { useEffect } from 'react';

/**
 * Lock the page while a study screen is open, so the session never scrolls.
 *
 * The screen is exactly one window tall, so the page has nothing to scroll.
 * iOS still moves the page to show a focused field above the keyboard and
 * leaves it there when the keyboard closes, which hides the top of the card
 * and pushes Continue off the foot. So the page goes back to the top whenever
 * a field loses focus or the visible area grows again.
 */
export const useLockedScroll = (active = true): void => {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const { body } = document;
    const before = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';

    const toTop = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
    };
    // Wait for the keyboard to finish closing before moving the page back.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const toTopSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(toTop, 100);
    };
    const viewport = window.visualViewport;
    let lastHeight = viewport?.height ?? 0;
    const onViewportResize = () => {
      if (!viewport) return;
      if (viewport.height > lastHeight) toTopSoon();
      lastHeight = viewport.height;
    };

    toTop();
    document.addEventListener('focusout', toTopSoon);
    viewport?.addEventListener('resize', onViewportResize);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusout', toTopSoon);
      viewport?.removeEventListener('resize', onViewportResize);
      html.style.overflow = before.htmlOverflow;
      body.style.overflow = before.bodyOverflow;
      html.style.overscrollBehavior = before.htmlOverscroll;
      body.style.overscrollBehavior = before.bodyOverscroll;
    };
  }, [active]);
};
