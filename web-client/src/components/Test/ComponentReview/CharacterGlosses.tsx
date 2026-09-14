import React, { useEffect, useState } from 'react';

import { Box, CircularProgress, Typography } from '@mui/material';

import { searchWord } from '../../../services/dictionaryService';
import { reportError } from '../../../services/errorReporting';
import { CharacterGloss } from './characterGloss';
import { readGloss, writeGloss } from './glossCache';

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
        // The learner only sees 'Definition unavailable', so the cause has to
        // go somewhere.
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
  /** The breakdown of this character, rendered under its gloss when open. */
  children?: React.ReactNode;
}

const CharacterGlossRow: React.FC<CharacterGlossRowProps> = ({ char, gloss, children }) => {
  const meaning = gloss?.failed
    ? 'Definition unavailable'
    : gloss && gloss.meanings.length === 0
      ? 'Not in the dictionary'
      : gloss?.meanings.join(' / ');

  return (
    <Box
      data-testid={`character-gloss-${char}`}
      sx={{
        p: '10px 12px',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2.5,
        mb: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography
          lang="zh"
          sx={{
            fontSize: '2em',
            fontWeight: 500,
            color: 'text.primary',
            minWidth: 48,
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          {char}
        </Typography>
        <Box sx={{ flex: 1 }}>
          {gloss === undefined ? (
            <CircularProgress size={16} aria-label={`Loading the definition of ${char}`} />
          ) : (
            <>
              {gloss.pinyins.length > 0 && (
                <Typography
                  lang="zh-Latn"
                  sx={{ fontSize: '1em', color: 'primary.dark', fontWeight: 500 }}
                >
                  {gloss.pinyins.join(' / ')}
                </Typography>
              )}
              <Typography
                sx={{
                  fontSize: '0.85em',
                  color: gloss.failed ? 'text.disabled' : 'text.secondary',
                  mt: 0.25,
                }}
              >
                {meaning}
              </Typography>
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
    <Box sx={{ mt: 1, textAlign: 'left' }}>
      {chars.map((char, index) => (
        <CharacterGlossRow key={`${char}-${index}`} char={char} gloss={glossFor(char)}>
          {renderBreakdown?.(char)}
        </CharacterGlossRow>
      ))}
    </Box>
  );
};

export default CharacterGlosses;
