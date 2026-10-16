/**
 * Load the stroke data for one character, for HanziWriter's `charDataLoader`.
 *
 * HanziWriter's own loader asks the CDN once. On a patchy mobile connection
 * that request can drop, and the writer is then left with no character to
 * draw: the quiz box stays blank and the outline hint throws. This loader asks
 * the same URL, and asks once more if the network dropped the request (Sentry
 * issues JAVASCRIPT-REACT-8 and JAVASCRIPT-REACT-9).
 */

import { reportError } from '../services/errorReporting';
import { retryTransient } from './retry';

// The data version HanziWriter 2.2 reads by default.
const CHAR_DATA_URL = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/';

export const loadCharData = (
  char: string,
  onLoad: (data: object) => void,
  onError: (error: unknown) => void,
): void => {
  retryTransient(async () => {
    const response = await fetch(`${CHAR_DATA_URL}${char}.json`);
    if (!response.ok) throw new Error(`Stroke data for ${char} returned ${response.status}`);
    return (await response.json()) as object;
  }).then(onLoad, onError);
};

/**
 * Report a load that failed even after the retry. Passing this to HanziWriter
 * also stops it from throwing the failure as an unhandled rejection.
 */
export const onCharDataError = (error: unknown): void => {
  reportError(error, { feature: 'hanzi-writer' });
};
