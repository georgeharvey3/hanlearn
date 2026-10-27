/** The routes of the shell's links. */
export const routes = {
  home: '/',
  add: '/add-words',
  study: '/test-words',
  settings: '/settings',
} as const;

/** The route of the catalogue, or of one premade list of it. */
export const premadePath = (listId?: string): string =>
  listId ? `/add-words/premade/${listId}` : '/add-words/premade';

/** Home matches only itself; every other link also matches the pages below it. */
export const isActive = (pathname: string, to: string): boolean =>
  to === routes.home ? pathname === routes.home : pathname.startsWith(to);
