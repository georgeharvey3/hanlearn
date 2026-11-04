import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { RootState } from '../types/store';
import { TabStatuses, loadTabStatuses } from '../services/sentenceTabsService';
import { reportError } from '../services/errorReporting';

/**
 * The status of the Comprehend and Compose tabs, for the dot on each tab and
 * the buttons of the finish screen of a study session. Null until it loads,
 * and for a visitor who is not signed in.
 *
 * It loads again each time the list stats change, because they change after
 * each session and each change to the words. While `enabled` is false it loads
 * nothing, so a running study session reads no more than it needs.
 */
export function useSentenceTabs(enabled = true): TabStatuses | null {
  const userId = useSelector((state: RootState) => state.auth.userId);
  const listStats = useSelector((state: RootState) => state.addWords.listStats);
  const [statuses, setStatuses] = useState<TabStatuses | null>(null);

  useEffect(() => {
    if (!userId) {
      setStatuses(null);
      return;
    }
    if (!enabled) return;
    let live = true;
    loadTabStatuses(userId, new Date())
      .then((next) => {
        if (live) setStatuses(next);
      })
      .catch((error) => {
        reportError(error, { feature: 'sentence-tabs', level: 'warning' });
      });
    return () => {
      live = false;
    };
  }, [enabled, userId, listStats]);

  return statuses;
}
