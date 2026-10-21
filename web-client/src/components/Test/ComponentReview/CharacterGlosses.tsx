import React, { useEffect, useState } from 'react';

import { Box, CircularProgress } from '@mui/material';

import { searchWord } from '../../../services/dictionaryService';
import { reportError } from '../../../services/errorReporting';
import { CharacterGloss } from './characterGloss';
import { readGloss, writeGloss } from './glossCache';
import { copy } from '../../../copy';
import { colors } from '../../../theme';
import { toneMarks } from '../../../utils/pinyinMarks';
import { hanziSx } from '../Study/parts';

/**
 * Look up each character of the missed word.
 *
 * The answers of this word live in state keyed by the word, so a lookup that
 * lands after the session has moved on is dropped. A character with no answer
 * yet reads as `undefined`, which is what the spinner shows. A lookup that
 * fails is remembered for this word only, so the next question tries again.
 */
const useCharacterGlosses = (
  chars: string[],
  charSet: 'simp' | 'trad',
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
        reportError(error, { feature: 'character-lookup', context: { char, phase: 'review' } });
        record(char, { pinyins: [], meanings: [], failed: true });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [charsKey, charSet]);

  return (char: string): CharacterGloss | undefined => {
    const cached = readGloss(char, charSet);
    if (cached) return cached;
    return fetched.key === charsKey ? fetched.glosses[char] : undefined;
  };
};

interface CharacterGlossRowProps {
  char: string;
  gloss: CharacterGloss | undefined;
  last: boolean;
  /** The breakdown of this character, rendered under its gloss when open. */
  children?: React.ReactNode;
}

/** The first few senses of a character, as one short line. */
const SENSES_SHOWN = 3;

function senses(gloss: CharacterGloss): string {
  const all = gloss.meanings.flatMap((meaning) => meaning.split('/')).map((s) => s.trim());
  return Array.from(new Set(all.filter(Boolean)))
    .slice(0, SENSES_SHOWN)
    .join(' · ');
}

const CharacterGlossRow: React.FC<CharacterGlossRowProps> = ({ char, gloss, last, children }) => {
  const meaning = gloss?.failed
    ? copy.test.definitionFailed
    : gloss && gloss.meanings.length === 0
      ? copy.test.notInDictionary
      : gloss && senses(gloss);

  return (
    <Box
      data-testid={`character-gloss-${char}`}
      sx={{
        px: 1.75,
        py: 1.25,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        borderBottom: last ? 'none' : `1px solid ${colors.divider}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
        <Box lang="zh" sx={hanziSx(30)}>
          {char}
        </Box>
        {/* minWidth 0 lets the text column shrink below its longest line, and
            overflowWrap breaks a meaning such as 'sharp/favorable/advantage',
            which has no spaces to wrap at, instead of spilling past the card. */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {gloss === undefined ? (
            <CircularProgress size={16} aria-label={copy.test.definitionLoading(char)} />
          ) : (
            <>
              {gloss.pinyins.length > 0 && (
                <Box
                  lang="zh-Latn"
                  sx={{ fontSize: 15, fontWeight: 600, color: colors.primaryDark }}
                >
                  {gloss.pinyins.map(toneMarks).join(' / ')}
                </Box>
              )}
              <Box
                sx={{
                  fontSize: 14,
                  color: gloss.failed ? colors.disabledText : colors.textSecondary,
                }}
              >
                {meaning}
              </Box>
            </>
          )}
        </Box>
      </Box>
      {children}
    </Box>
  );
};

interface CharacterGlossesProps {
  chars: string[];
  charSet: 'simp' | 'trad';
  /** The breakdown to nest under a character, when the learner asked for it. */
  renderBreakdown?: (char: string) => React.ReactNode;
}

/**
 * The pinyin and meaning of every character of the word, one row each.
 *
 * A learner who missed the meaning of a word gets most of the way back to it
 * from the characters it is built from, so these are shown without asking.
 */
const CharacterGlosses: React.FC<CharacterGlossesProps> = ({ chars, charSet, renderBreakdown }) => {
  const glossFor = useCharacterGlosses(chars, charSet);

  return (
    <Box
      sx={{
        textAlign: 'left',
        bgcolor: colors.card,
        border: `1px solid ${colors.divider}`,
        borderRadius: 1,
      }}
    >
      {chars.map((char, index) => (
        <CharacterGlossRow
          key={`${char}-${index}`}
          char={char}
          gloss={glossFor(char)}
          last={index === chars.length - 1}
        >
          {renderBreakdown?.(char)}
        </CharacterGlossRow>
      ))}
    </Box>
  );
};

export default CharacterGlosses;
