import React from 'react';

import { Box, CircularProgress } from '@mui/material';

import { CharacterGloss } from './characterGloss';
import { senses, useCharacterGlosses } from './useCharacterGlosses';
import { copy } from '../../../copy';
import { colors } from '../../../theme';
import { toneMarks } from '../../../utils/pinyinMarks';
import { hanziSx } from '../Study/parts';

interface CharacterGlossRowProps {
  char: string;
  gloss: CharacterGloss | undefined;
  last: boolean;
  /** The breakdown of this character, rendered under its gloss when open. */
  children?: React.ReactNode;
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
