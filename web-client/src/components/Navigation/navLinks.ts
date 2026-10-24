/** The routes of the shell's links. */
export const routes = {
  home: '/',
  add: '/add-words',
  study: '/test-words',
  stats: '/stats',
  settings: '/settings',
} as const;

/** Home matches only itself; every other link also matches the pages below it. */
export const isActive = (pathname: string, to: string): boolean =>
  to === routes.home ? pathname === routes.home : pathname.startsWith(to);
