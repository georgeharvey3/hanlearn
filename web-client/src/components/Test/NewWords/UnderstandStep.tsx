import React, { useMemo, useState } from 'react';
import { Box, ButtonBase, Collapse } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

import WordCard from './WordCard';
import { Overline, hanziSx } from '../Study/parts';
import { senses, useCharacterGlosses } from '../ComponentReview/useCharacterGlosses';
import { CharacterGloss } from '../ComponentReview/characterGloss';
import { useComponents } from '../ComponentReview/useComponents';
import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { toneMarks } from '../../../utils/pinyinMarks';
import { Word } from '../../../types/models';

const skeletonSx = { bgcolor: colors.skeleton, borderRadius: '3px' };

/** The first level of a character's parts. The strokes belong to the Write step. */
const Parts: React.FC<{ char: string }> = ({ char }) => {
  const [load, retry] = useComponents(char);

  if (load.status === 'loading') {
    return (
      <Box
        role="status"
        aria-label={copy.newWords.partsLoading}
        sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
      >
        {[96, 72].map((width) => (
          <Box key={width} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ ...skeletonSx, width: 28, height: 28 }} />
            <Box sx={{ ...skeletonSx, width, height: 12 }} />
          </Box>
        ))}
      </Box>
    );
  }
  if (load.status === 'failed') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box component="span" sx={{ fontSize: 14, color: colors.textSecondary }}>
          {copy.newWords.partsFailed}
        </Box>
        <ButtonBase
          onClick={retry}
          sx={{
            height: 44,
            px: 0.5,
            fontFamily: fonts.body,
            fontSize: 14,
            fontWeight: 600,
            color: colors.primaryDark,
          }}
        >
          {copy.newWords.tryAgain}
        </ButtonBase>
      </Box>
    );
  }
  if (load.components.length === 0) {
    return <Box sx={{ fontSize: 14, color: colors.textSecondary }}>{copy.newWords.noParts}</Box>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {load.components.map((part) => (
        <Box key={part.char} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box lang="zh" sx={hanziSx(26, { width: 30, color: colors.primaryLight })}>
            {part.char}
          </Box>
          <Box sx={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.3 }}>
            {part.pinyin && (
              <Box lang="zh-Latn" sx={{ color: colors.text }}>
                {part.pinyin}
              </Box>
            )}
            {part.meaning}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

interface CharRowProps {
  char: string;
  gloss: CharacterGloss | undefined;
  open: boolean;
  onToggle: () => void;
}

/** One character of the word. It opens in place, so the word card stays in view. */
const CharRow: React.FC<CharRowProps> = ({ char, gloss, open, onToggle }) => {
  const meaning = gloss?.failed
    ? copy.test.definitionFailed
    : gloss && gloss.meanings.length === 0
      ? copy.test.notInDictionary
      : gloss && senses(gloss);

  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: colors.card,
        border: `1px solid ${open ? colors.borderStrong : colors.divider}`,
        borderRadius: 1,
      }}
    >
      <ButtonBase
        onClick={onToggle}
        aria-expanded={open}
        sx={{
          width: '100%',
          display: 'flex',
          justifyContent: 'flex-start',
          gap: 2,
          textAlign: 'left',
          fontFamily: fonts.body,
          color: colors.text,
        }}
      >
        <Box lang="zh" sx={hanziSx(40, { width: 48, textAlign: 'center' })}>
          {char}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box lang="zh-Latn" sx={{ fontSize: 16 }}>
            {gloss?.pinyins.map(toneMarks).join(' / ')}
          </Box>
          <Box
            sx={{
              fontSize: 14,
              color: colors.textSecondary,
              ...(open
                ? {}
                : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
            }}
          >
            {meaning}
          </Box>
        </Box>
        <ExpandMoreRoundedIcon
          sx={{
            color: colors.textSecondary,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms ease',
          }}
        />
      </ButtonBase>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pt: 1.5, pl: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Overline>{copy.newWords.parts}</Overline>
          <Parts char={char} />
        </Box>
      </Collapse>
    </Box>
  );
};

interface UnderstandStepProps {
  word: Word;
  charSet: 'simp' | 'trad';
  speak: (text: string) => void;
  loading: boolean;
}

/** Step 1: the word, then each character with its pinyin, senses and parts. */
const UnderstandStep: React.FC<UnderstandStepProps> = ({ word, charSet, speak, loading }) => {
  const chars = useMemo(() => word[charSet].split(''), [word, charSet]);
  const glossOf = useCharacterGlosses(chars, charSet);
  const [openRow, setOpenRow] = useState<number | null>(null);

  return (
    <>
      <WordCard
        word={word}
        charSet={charSet}
        speak={() => speak(word[charSet])}
        loading={loading}
        highlight={openRow}
      />
      <Overline sx={{ mt: 3, mb: 1 }}>{copy.newWords.characters}</Overline>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {chars.map((char, i) => (
          <CharRow
            key={i}
            char={char}
            gloss={glossOf(char)}
            open={openRow === i}
            onToggle={() => {
              const opening = openRow !== i;
              setOpenRow(opening ? i : null);
              if (opening) speak(char);
            }}
          />
        ))}
      </Box>
    </>
  );
};

export default UnderstandStep;
