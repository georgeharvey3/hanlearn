import { useEffect, useState } from 'react';

import { searchWord } from '../../../services/dictionaryService';
import { reportError } from '../../../services/errorReporting';
import { CharacterGloss } from './characterGloss';
import { readGloss, writeGloss } from './glossCache';
import { copy } from '../../../copy';

/**
 * Look up each character of a word: the missed word of a review, or a new word.
 *
 * The answers of this word live in state keyed by the word, so a lookup that
 * lands after the session has moved on is dropped. A character with no answer
 * yet reads as `undefined`, which is what the spinner shows. A lookup that
 * fails is remembered for this word only, so the next question tries again.
 */
export const useCharacterGlosses = (
  chars: string[],
  charSet: 'simp' | 'trad',
  // Where the lookup ran, for the error report.
  phase: 'review' | 'new-words' = 'review',
): ((char: string) => CharacterGloss | undefined) => {
  const charsKey = chars.join('');
  const [fetched, setFetched] = useState<{
    key: string;
    glosses: Record<string, CharacterGloss>;
  }>({ key: charsKey, glosses: {} });

  useEffect(() => {
    let cancelled = false;

    const record = (char: string, gloss: CharacterGloss): void => {
      if (cancelled) return;
      setFetched((prev) => ({
        key: charsKey,
        glosses: { ...(prev.key === charsKey ? prev.glosses : {}), [char]: gloss },
      }));
    };

    Array.from(new Set(charsKey.split(''))).forEach(async (char) => {
      if (readGloss(char, charSet)) return;
      try {
        const results = await searchWord(char, charSet);
        const gloss: CharacterGloss = {
          pinyins: Array.from(new Set(results.map((result) => result.pinyin))),
          meanings: Array.from(new Set(results.map((result) => result.meaning))),
        };
        writeGloss(char, charSet, gloss);
        record(char, gloss);
      } catch (error) {
        // The learner only sees that the definition is unavailable, so the
        // cause has to go somewhere.
        reportError(error, { feature: 'character-lookup', context: { char, phase } });
        record(char, { pinyins: [], meanings: [], failed: true });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [charsKey, charSet, phase]);

  return (char: string): CharacterGloss | undefined => {
    const cached = readGloss(char, charSet);
    if (cached) return cached;
    return fetched.key === charsKey ? fetched.glosses[char] : undefined;
  };
};

/** The first few senses of a character, as one short line. */
const SENSES_SHOWN = 3;

export function senses(gloss: CharacterGloss): string {
  const all = gloss.meanings.flatMap((meaning) => meaning.split('/')).map((s) => s.trim());
  return Array.from(new Set(all.filter(Boolean)))
    .slice(0, SENSES_SHOWN)
    .join(' · ');
}

/** The line under a character: its first senses, or why there are none. */
export function glossLine(gloss: CharacterGloss | undefined): string | undefined {
  if (gloss?.failed) return copy.test.definitionFailed;
  if (gloss && gloss.meanings.length === 0) return copy.test.notInDictionary;
  return gloss && senses(gloss);
}
