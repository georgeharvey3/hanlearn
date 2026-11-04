import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { RootState } from '../types/store';
import { TabStatuses, loadTabStatuses } from '../services/sentenceTabsService';
import { reportError } from '../services/errorReporting';

/**
 * One load of the tab status, shared by every caller that asks for the same
 * learner, the same list stats and the same version. The sidebar and the
 * finish screen of a session can be on screen together, and each load reads
 * every word.
 */
let shared: {
  userId: string;
  listStats: unknown;
  version: number;
  promise: Promise<TabStatuses>;
} | null = null;
let version = 0;
const listeners = new Set<() => void>();

/**
 * Load the tab status again, for example at the end of a set: a sentence grade
 * does not change the list stats, but it can clear the dot of a tab.
 */
export function refreshSentenceTabs(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

function statusesFor(userId: string, listStats: unknown): Promise<TabStatuses> {
  if (
    !shared ||
    shared.userId !== userId ||
    shared.listStats !== listStats ||
    shared.version !== version
  ) {
    shared = { userId, listStats, version, promise: loadTabStatuses(userId, new Date()) };
    // A failed load is not kept, so the next caller tries again.
    const failed = shared;
    failed.promise.catch(() => {
      if (shared === failed) shared = null;
    });
  }
  return shared.promise;
}

/**
 * The status of the Comprehend and Compose tabs, for the dot on each tab and
 * the buttons of the finish screen of a study session. Null until it loads,
 * and for a visitor who is not signed in.
 *
 * It loads again each time the list stats change, because they change after
 * each session and each change to the words, and after `refreshSentenceTabs`.
 * While `enabled` is false this caller loads nothing.
 */
export function useSentenceTabs(enabled = true): TabStatuses | null {
  const userId = useSelector((state: RootState) => state.auth.userId);
  const listStats = useSelector((state: RootState) => state.addWords.listStats);
  const [statuses, setStatuses] = useState<TabStatuses | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((prev) => prev + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setStatuses(null);
      return;
    }
    if (!enabled) return;
    let live = true;
    statusesFor(userId, listStats)
      .then((next) => {
        if (live) setStatuses(next);
      })
      .catch((error) => {
        reportError(error, { feature: 'sentence-tabs', level: 'warning' });
      });
    return () => {
      live = false;
    };
  }, [enabled, userId, listStats, tick]);

  return statuses;
}
