/**
 * When the Add Words search asks the dictionary (issue #425): from one Han
 * character, from two Latin letters, or from one syllable with a tone. A
 * shorter query filters the user's words only.
 */

// The same ranges as the server's, in functions/src/dictionarySearch.ts. The
// build target has no `u` flag, so U+20000 to U+2FFFF are surrogate pairs.
const HAN = /[㐀-䶿一-鿿豈-﫿]|[\ud840-\ud87f][\udc00-\udfff]/;

const TONE_MARK = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i;

const LETTER = new RegExp(`[a-zü]|${TONE_MARK.source}`, 'gi');

export type SearchKind = 'hanzi' | 'latin';

/** How the dictionary reads a query, or null when the query is too short to send. */
export function searchKind(text: string): SearchKind | null {
  if (HAN.test(text)) return 'hanzi';
  const letters = text.match(LETTER)?.length ?? 0;
  if (letters >= 2) return 'latin';
  if (letters === 1 && (TONE_MARK.test(text) || /[0-5]/.test(text))) return 'latin';
  return null;
}
