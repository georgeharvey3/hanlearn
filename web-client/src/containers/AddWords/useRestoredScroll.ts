import { useLayoutEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';

// The last scroll position of each Add Words URL, for the life of the page.
const positions = new Map<string, number>();

/**
 * Keeps the scroll position of the page under `search`, the location search
 * string that the page writes, and gives it back when the learner returns
 * with back. The position comes back once `ready` is true, that is once the
 * list or the results are drawn, because a shorter page cannot scroll to it.
 */
export function useRestoredScroll(search: string, ready: boolean): void {
  const history = useHistory();
  const pathname = useRef(history.location.pathname);
  const key = useRef(search);
  const pending = useRef(
    history.action === 'POP' ? positions.get(history.location.search) : undefined,
  );

  // A new search string, as a row opens, keeps the position the page has now.
  useLayoutEffect(() => {
    key.current = search;
    positions.set(search, window.scrollY);
  }, [search]);

  // A layout effect, so its cleanup runs before the next page is drawn: a
  // scroll event of the shorter next page must not overwrite the position.
  useLayoutEffect(() => {
    const record = () => {
      // The location changes before the page unmounts. A scroll then belongs
      // to the next page.
      if (history.location.pathname !== pathname.current) return;
      positions.set(key.current, window.scrollY);
    };
    window.addEventListener('scroll', record, { passive: true });
    return () => window.removeEventListener('scroll', record);
  }, [history]);

  useLayoutEffect(() => {
    if (!ready || pending.current === undefined) return;
    window.scrollTo(0, pending.current);
    pending.current = undefined;
  }, [ready]);
}

/** Forget every kept position. For tests. */
export function resetScrollPositions(): void {
  positions.clear();
}
