import { useEffect, useState } from 'react';

import { searchWord } from '../../services/dictionaryService';
import { reportError } from '../../services/errorReporting';
import { Word } from '../../types/models';
import { CharacterReadings, readingsInWord, syllablesOf } from '../../utils/wordPage';

/** The readings of one character, or `failed` when its lookup failed. */
export type ReadingsLoad = CharacterReadings | 'failed' | undefined;

/**
 * The lookups of this session, by character set and character. A promise, so
 * that two characters of one word share a lookup. A failed lookup leaves the
 * map, so the next page tries again.
 */
const lookups = new Map<string, Promise<Word[]>>();

function entriesOf(char: string, charSet: 'simp' | 'trad'): Promise<Word[]> {
  const key = `${charSet}:${char}`;
  let lookup = lookups.get(key);
  if (!lookup) {
    // The exact lookup falls back to the other set; keep only the entries of this form.
    lookup = searchWord(char, charSet).then((entries) =>
      entries.filter((entry) => entry[charSet] === char),
    );
    lookups.set(key, lookup);
    lookup.catch(() => lookups.delete(key));
  }
  return lookup;
}

/** Forget the lookups, for the tests. */
export const clearReadingLookups = (): void => lookups.clear();

/**
 * The readings of each character of the word, with the reading that the word
 * uses first. The result reads by the place of the character in `chars`.
 */
export const useCharacterReadings = (
  word: Word,
  chars: string[],
  charSet: 'simp' | 'trad',
): ((index: number) => ReadingsLoad) => {
  const key = `${charSet}:${chars.join('')}:${word.pinyin}`;
  const [loaded, setLoaded] = useState<{ key: string; byIndex: ReadingsLoad[] }>({
    key,
    byIndex: [],
  });

  useEffect(() => {
    let cancelled = false;
    const syllables = syllablesOf(word, chars.length);
    const record = (index: number, value: ReadingsLoad) => {
      if (cancelled) return;
      setLoaded((prev) => {
        const byIndex = prev.key === key ? [...prev.byIndex] : [];
        byIndex[index] = value;
        return { key, byIndex };
      });
    };
    chars.forEach((char, index) => {
      entriesOf(char, charSet)
        .then((entries) => record(index, readingsInWord(entries, syllables[index])))
        .catch((error) => {
          reportError(error, { feature: 'character-lookup', context: { char, phase: 'word-page' } });
          record(index, 'failed');
        });
    });
    return () => {
      cancelled = true;
    };
    // `key` holds the characters, the set and the pinyin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (index) => (loaded.key === key ? loaded.byIndex[index] : undefined);
};
