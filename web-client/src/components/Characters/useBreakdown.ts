import { useCallback, useEffect, useState } from 'react';

import { Breakdown, breakdownOf } from '../../services/breakdownService';
import { reportError } from '../../services/errorReporting';
import { loadCharData } from '../../utils/charDataLoader';

/** The outlines of the strokes of a character, from the Hanzi Writer data. */
interface StrokeData {
  strokes: string[];
}

export type BreakdownLoad =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'done'; breakdown: Breakdown; strokes: string[] };

const strokesOf = (char: string) =>
  new Promise<string[]>((resolve, reject) =>
    loadCharData(char, (data) => resolve((data as StrokeData).strokes), reject),
  );

/**
 * The breakdown file of a character and its stroke outlines. A character that
 * does not split needs no strokes, so its strokes are not fetched.
 */
export const useBreakdown = (char: string): [BreakdownLoad, () => void] => {
  const [load, setLoad] = useState<BreakdownLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    breakdownOf(char)
      .then(async (breakdown) => {
        const strokes = breakdown.p ? await strokesOf(char) : [];
        if (!cancelled) setLoad({ status: 'done', breakdown, strokes });
      })
      .catch((error) => {
        reportError(error, { feature: 'breakdown', context: { char } });
        if (!cancelled) setLoad({ status: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [char, attempt]);

  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return [load, retry];
};
