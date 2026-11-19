import React, { useState } from 'react';
import { Box, ButtonBase, IconButton } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import { Word } from '../../types/models';
import { toneMarks } from '../../utils/pinyinMarks';
import { isCustomWord, sensesOf } from '../../utils/wordPage';
import { hanziSx } from '../Test/Study/parts';
import * as ttsService from '../../services/ttsService';

type CharSet = 'simp' | 'trad';

/** A round button that plays a Chinese text with the learner's voice. */
export const SpeakButton: React.FC<{
  text: string;
  label: string;
  voice?: SpeechSynthesisVoice;
  lang?: string;
  size?: number;
}> = ({ text, label, voice, lang, size = 44 }) => {
  const [playing, setPlaying] = useState(false);
  const play = () => {
    ttsService.stopAll();
    setPlaying(true);
    ttsService.speak(text, {
      fallbackVoice: voice,
      fallbackLang: lang || 'zh-CN',
      onEnd: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
  };
  return (
    <IconButton
      onClick={play}
      disabled={playing}
      aria-label={label}
      sx={{
        width: size,
        height: size,
        flex: 'none',
        border: `1px solid ${colors.borderStrong}`,
        color: colors.text,
      }}
    >
      <VolumeUpOutlinedIcon sx={{ fontSize: size / 2 }} />
    </IconButton>
  );
};

/** The tag of a custom word, beside its pinyin. */
const OwnWordTag: React.FC = () => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      height: 22,
      px: 1,
      ml: 1,
      borderRadius: '11px',
      bgcolor: colors.warningSurface,
      color: colors.warningText,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: 600,
      verticalAlign: 'middle',
    }}
  >
    <EditNoteRoundedIcon aria-hidden sx={{ fontSize: 16 }} />
    {copy.wordPage.ownWord}
  </Box>
);

/** The two forms of the word, as a switch that sets the form of the whole page. */
const FormSwitch: React.FC<{ word: Word; value: CharSet; onChange: (set: CharSet) => void }> = ({
  word,
  value,
  onChange,
}) => (
  <Box
    role="radiogroup"
    sx={{
      display: 'inline-flex',
      p: '2px',
      border: `1px solid ${colors.borderStrong}`,
      borderRadius: '22px',
      bgcolor: colors.card,
    }}
  >
    {(['trad', 'simp'] as const).map((set) => (
      <ButtonBase
        key={set}
        role="radio"
        aria-checked={value === set}
        aria-label={set === 'trad' ? copy.wordPage.traditional : copy.wordPage.simplified}
        onClick={() => onChange(set)}
        sx={{
          height: 36,
          px: 1.5,
          gap: 0.75,
          borderRadius: '18px',
          bgcolor: value === set ? colors.text : 'transparent',
          color: value === set ? colors.white : colors.text,
          fontFamily: fonts.body,
        }}
      >
        <Box component="span" lang="zh" sx={hanziSx(16)}>
          {word[set]}
        </Box>
        <Box component="span" aria-hidden sx={{ fontSize: 11, opacity: 0.8 }}>
          {set === 'trad' ? copy.wordPage.trad : copy.wordPage.simp}
        </Box>
      </ButtonBase>
    ))}
  </Box>
);

const headerHanziSize = (text: string) => (text.length <= 2 ? 48 : text.length === 3 ? 40 : 32);

interface Props {
  word: Word;
  /** The learner's word, or null when the learner does not have the entry. */
  owned: Word | null;
  charSet: CharSet;
  onCharSet: (set: CharSet) => void;
  onAdd: () => void;
  adding: boolean;
  voice?: SpeechSynthesisVoice;
  lang?: string;
}

/**
 * The top of the word page: the hanzi, the pinyin, the meaning that the
 * learner studies, play, and Add for an entry that the learner does not have.
 */
const WordHeader: React.FC<Props> = ({
  word,
  owned,
  charSet,
  onCharSet,
  onAdd,
  adding,
  voice,
  lang,
}) => {
  const text = word[charSet];
  const meaning = owned?.ammended_meaning || sensesOf(word.meaning)[0] || '';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box component="h1" lang="zh" sx={hanziSx(headerHanziSize(text), { m: 0 })}>
          {text}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ fontSize: 17, fontWeight: 600, color: colors.primaryDark }}>
            <span lang="zh-Latn">{toneMarks(word.pinyin)}</span>
            {isCustomWord(word) && <OwnWordTag />}
          </Box>
          <Box
            sx={{
              fontSize: 13,
              color: colors.textSecondary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {meaning}
          </Box>
        </Box>
        <SpeakButton text={text} label={copy.wordPage.play} voice={voice} lang={lang} />
        {!owned && (
          <ButtonBase
            onClick={onAdd}
            disabled={adding}
            sx={{
              flex: 'none',
              height: 44,
              px: 2,
              gap: 0.5,
              borderRadius: 1,
              bgcolor: colors.primaryDark,
              color: colors.white,
              fontFamily: fonts.body,
              fontSize: 15,
              fontWeight: 600,
              '&:hover': { bgcolor: colors.primaryDarkHover },
              '&.Mui-disabled': { bgcolor: colors.divider, color: colors.textSecondary },
            }}
          >
            <AddRoundedIcon aria-hidden sx={{ fontSize: 16 }} />
            {copy.wordPage.add}
          </ButtonBase>
        )}
      </Box>
      {word.simp !== word.trad && (
        <Box sx={{ mt: 1.25 }}>
          <FormSwitch word={word} value={charSet} onChange={onCharSet} />
        </Box>
      )}
    </Box>
  );
};

export default WordHeader;
