/**
 * Whether the running bundle is the one that is deployed.
 *
 * Vite hashes the asset filenames, so a deploy invalidates the JS and CSS by
 * name. What it cannot invalidate is `index.html`, which names those files: a
 * client that holds its own copy of that page keeps loading the bundle the copy
 * names, however many deploys have happened since. Firebase serves it
 * `no-cache`, which asks the browser to revalidate, and an iOS home-screen app
 * does not always ask. Swiping the app away is not enough either, and the
 * learner has no way to tell that the app they are looking at is old.
 *
 * So the app checks for itself. `/version.json` is written by the same build
 * that baked `__BUILD_ID__` into the bundle, and it is fetched with the cache
 * bypassed. Two different ids mean this page came from an earlier build than
 * the one deployed, and the page reloads.
 */

/** The build the running bundle came from. */
export const BUILD_ID = __BUILD_ID__;

/** Where the last reload attempt is remembered, so a stuck cache cannot loop. */
export const VERSION_RELOAD_KEY = 'versionReloadAttempt';

/**
 * The deployed build id, or null when it cannot be read.
 *
 * Null is the answer for the dev server, which serves no `version.json`, and
 * for an offline client. Neither is a reason to reload.
 */
export async function fetchDeployedBuildId(): Promise<string | null> {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const buildId = (body as { buildId?: unknown }).buildId;
    return typeof buildId === 'string' && buildId ? buildId : null;
  } catch {
    return null;
  }
}

/**
 * Whether to reload the page.
 *
 * `attempted` is the deployed id that a reload was already tried for. A reload
 * that leaves the page on the same old bundle means the copy of `index.html`
 * did not budge, and reloading again would spin: the app stays where it is
 * until the next deploy gives it a new id to try.
 */
export function shouldReload(
  running: string,
  deployed: string | null,
  attempted: string | null,
): boolean {
  if (deployed === null || deployed === running) return false;
  return attempted !== deployed;
}

export function readReloadAttempt(): string | null {
  try {
    return sessionStorage.getItem(VERSION_RELOAD_KEY);
  } catch {
    return null;
  }
}

export function writeReloadAttempt(deployed: string): void {
  try {
    sessionStorage.setItem(VERSION_RELOAD_KEY, deployed);
  } catch {
    // Storage can be unavailable. The check then repeats on the next
    // foreground, which is the behaviour that existed before this file.
  }
}
