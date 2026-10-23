import React from 'react';
import { Box, Drawer, IconButton } from '@mui/material';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';

import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { toneMarks } from '../../../utils/pinyinMarks';
import { parseMeanings } from '../../../utils/meaningUtils';
import { SentenceWord } from '../../../utils/sentenceUtils';
import { StudyButton, hanziSx } from './parts';

interface WordSheetProps {
  word: SentenceWord | null;
  charSet: 'simp' | 'trad';
  /** Whether the word is in the learner's list already. */
  added: boolean;
  onClose: () => void;
  onSpeak: (text: string) => void;
  onAdd: (word: SentenceWord) => void;
}

/** The definition of a word tapped in a sentence, in a sheet at the foot. */
const WordSheet: React.FC<WordSheetProps> = ({ word, charSet, added, onClose, onSpeak, onAdd }) => (
  <Drawer
    anchor="bottom"
    open={word !== null}
    onClose={onClose}
    PaperProps={{
      role: 'dialog',
      'aria-label': word?.[charSet],
      sx: {
        m: 2,
        borderRadius: 1,
        p: 2.5,
        maxWidth: 408,
        mx: 'auto',
        width: 'calc(100% - 32px)',
        boxSizing: 'border-box',
        fontFamily: fonts.body,
        color: colors.text,
        boxShadow: '0 -4px 40px -12px rgba(70,50,30,0.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
      },
    }}
  >
    {word && (
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box lang="zh" sx={hanziSx(56)}>
            {word[charSet]}
          </Box>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
            <Box lang="zh-Latn" sx={{ fontSize: 20 }}>
              {word.pinyin ? toneMarks(word.pinyin) : ''}
            </Box>
            <Box sx={{ fontSize: 15, color: colors.textSecondary }}>
              {word.meaning ? parseMeanings(word.meaning).join(' · ') : copy.sentence.noDefinition}
            </Box>
          </Box>
          <IconButton
            aria-label={copy.test.playPronunciation}
            onClick={() => onSpeak(word[charSet])}
            sx={{
              width: 44,
              height: 44,
              border: `1px solid ${colors.borderStrong}`,
              color: colors.text,
            }}
          >
            <VolumeUpRoundedIcon sx={{ fontSize: 22 }} />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.25 }}>
          <StudyButton onClick={onClose}>{copy.sentence.close}</StudyButton>
          {word.id !== -1 && (
            <StudyButton
              variant="primary"
              disabled={added}
              onClick={() => onAdd(word)}
              sx={{ height: 48, fontSize: 16 }}
            >
              {added ? copy.sentence.added : copy.sentence.addToList}
            </StudyButton>
          )}
        </Box>
      </>
    )}
  </Drawer>
);

export default WordSheet;
