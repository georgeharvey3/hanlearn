import { useCallback, useEffect, useState } from 'react';

import { decomposeCharacter } from '../../../services/decompositionService';
import { reportError } from '../../../services/errorReporting';

export type Component = Awaited<ReturnType<typeof decomposeCharacter>>[number];

export type Load =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'done'; components: Component[] };

export const useComponents = (
  char: string,
  // Where the lookup ran, for the error report.
  phase: 'review' | 'new-words' = 'review',
): [Load, () => void] => {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    decomposeCharacter(char)
      .then((components) => !cancelled && setLoad({ status: 'done', components }))
      .catch((error) => {
        reportError(error, { feature: 'decomposition', context: { char, phase } });
        if (!cancelled) setLoad({ status: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [char, attempt, phase]);

  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return [load, retry];
};
