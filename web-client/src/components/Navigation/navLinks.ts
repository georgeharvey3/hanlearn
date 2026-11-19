/** The routes of the shell's links. */
export const routes = {
  home: '/',
  add: '/add-words',
  study: '/test-words',
  comprehend: '/comprehend',
  compose: '/compose',
  settings: '/settings',
} as const;

/** The route of the catalogue, or of one premade list of it. */
export const premadePath = (listId?: string): string =>
  listId ? `/add-words/premade/${listId}` : '/add-words/premade';

/** The route of the word page of one entry (#562). */
export const wordPath = (id: number): string => `/word/${id}`;

/** Home matches only itself; every other link also matches the pages below it. */
export const isActive = (pathname: string, to: string): boolean =>
  to === routes.home ? pathname === routes.home : pathname.startsWith(to);
