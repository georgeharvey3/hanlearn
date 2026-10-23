import React from 'react';
import { Box } from '@mui/material';

import { PlayButton, StudyCard, hanziSize, hanziSx } from '../Study/parts';
import { colors } from '../../../theme';
import { parseMeanings } from '../../../utils/meaningUtils';
import { toneMarks } from '../../../utils/pinyinMarks';
import { Word } from '../../../types/models';

interface WordCardProps {
  word: Word;
  charSet: 'simp' | 'trad';
  /** The Speak step shows a smaller card, so the heard syllables fit below it. */
  compact?: boolean;
  speak: () => void;
  loading: boolean;
  /** The character whose row is open: it and its syllable turn seal red, the others fade. */
  highlight?: number | null;
}

const highlightSx = (highlight: number | null, i: number) => ({
  color:
    highlight === null ? 'inherit' : highlight === i ? colors.primaryLight : colors.disabledText,
  transition: 'color 150ms ease',
});

/** The new word: its characters, pinyin and meaning, with the play button. */
const WordCard: React.FC<WordCardProps> = ({
  word,
  charSet,
  compact = false,
  speak,
  loading,
  highlight = null,
}) => (
  <StudyCard
    height={compact ? 150 : 200}
    sx={{ mt: compact ? 1.25 : 2, pt: 4, gap: compact ? 1 : 1.5 }}
    corner={
      <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
        <PlayButton size={44} loading={loading} onClick={speak} />
      </Box>
    }
  >
    <Box lang="zh" sx={hanziSx(hanziSize(word[charSet], compact ? 'small' : 'medium'))}>
      {word[charSet].split('').map((char, i) => (
        <Box component="span" key={i} sx={highlightSx(highlight, i)}>
          {char}
        </Box>
      ))}
    </Box>
    <Box lang="zh-Latn" sx={{ fontSize: 20, display: 'flex', gap: 0.75 }}>
      {word.pinyin.split(/\s+/).map((syllable, i) => (
        <Box component="span" key={i} sx={highlightSx(highlight, i)}>
          {toneMarks(syllable)}
        </Box>
      ))}
    </Box>
    <Box sx={{ fontSize: 16, color: colors.textSecondary }}>
      {parseMeanings(word.meaning).join(' · ')}
    </Box>
  </StudyCard>
);

export default WordCard;
