import React from 'react';
import { Box, IconButton } from '@mui/material';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import { copy } from '../../../copy';
import { colors } from '../../../theme';
import { toneMarks } from '../../../utils/pinyinMarks';
import { parseMeanings } from '../../../utils/meaningUtils';
import { SentenceWord } from '../../../utils/sentenceUtils';
import { hanziSx } from './parts';

interface WordGlossPanelProps {
  word: SentenceWord | null;
  charSet: 'simp' | 'trad';
  /** Whether the word is in the learner's list already. */
  added: boolean;
  onSpeak: (text: string) => void;
  /** With no handler, the panel has no add button: the New words step adds nothing. */
  onAdd?: (word: SentenceWord) => void;
}

const iconButtonSx = {
  width: 44,
  height: 44,
  flex: 'none',
  border: `1px solid ${colors.borderStrong}`,
  color: colors.text,
};

/**
 * The meaning of a word tapped in a sentence, in a row under the sentence
 * (#503). It has the style of the hint panel of Compose. It has no close
 * button and no backdrop, so the sentence stays readable and tappable: a tap
 * on the open word closes it.
 */
const WordGlossPanel: React.FC<WordGlossPanelProps> = ({
  word,
  charSet,
  added,
  onSpeak,
  onAdd,
}) => {
  if (!word) return null;
  return (
    <Box
      role="group"
      aria-label={word[charSet]}
      sx={{
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        borderTop: `1px solid ${colors.divider}`,
        pt: 1.25,
        px: 0.25,
        textAlign: 'left',
      }}
    >
      <Box lang="zh" sx={hanziSx(30, { minWidth: 64, flex: 'none' })}>
        {word[charSet]}
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
        <Box lang="zh-Latn" sx={{ fontSize: 15 }}>
          {word.pinyin ? toneMarks(word.pinyin) : ''}
        </Box>
        <Box sx={{ fontSize: 14, color: colors.textSecondary }}>
          {word.meaning ? parseMeanings(word.meaning).join(' · ') : copy.sentence.noDefinition}
        </Box>
      </Box>
      <IconButton
        aria-label={copy.test.playPronunciation}
        onClick={() => onSpeak(word[charSet])}
        sx={iconButtonSx}
      >
        <VolumeUpRoundedIcon sx={{ fontSize: 20 }} />
      </IconButton>
      {onAdd && (
        <IconButton
          aria-label={added ? copy.sentence.added : copy.sentence.addToList}
          disabled={added}
          onClick={() => onAdd(word)}
          sx={{ ...iconButtonSx, '&.Mui-disabled': { color: colors.primaryDark } }}
        >
          {added ? (
            <CheckRoundedIcon sx={{ fontSize: 20 }} />
          ) : (
            <AddRoundedIcon sx={{ fontSize: 20 }} />
          )}
        </IconButton>
      )}
    </Box>
  );
};

export default WordGlossPanel;
