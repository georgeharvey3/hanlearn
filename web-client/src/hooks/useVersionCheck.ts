import { useEffect } from 'react';

import {
  BUILD_ID,
  fetchDeployedBuildId,
  readReloadAttempt,
  shouldReload,
  writeReloadAttempt,
} from '../utils/appVersion';

/**
 * Reload the page when a newer build has been deployed.
 *
 * The check runs on mount, which catches the page a cache restored from an
 * earlier build, and again whenever the app comes back to the foreground, which
 * is when a phone that has been in a pocket since the deploy notices.
 *
 * A reload can land mid-session. That costs nothing but the tap: the session is
 * saved to localStorage as it goes, and the app offers it back on the next
 * visit. See docs/adr/0014-resume-an-unfinished-session.md.
 */
export function useVersionCheck(): void {
  useEffect(() => {
    let cancelled = false;

    const check = async (): Promise<void> => {
      const deployed = await fetchDeployedBuildId();
      if (cancelled) return;
      if (!shouldReload(BUILD_ID, deployed, readReloadAttempt())) return;

      writeReloadAttempt(deployed!);
      window.location.reload();
    };

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void check();
    };

    void check();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
