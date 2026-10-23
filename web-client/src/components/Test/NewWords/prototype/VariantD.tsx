// PROTOTYPE (#413) variant D, "Card and rows": variant A, but a tap on a
// character row opens it in place, with no sheet. The open row shows the
// strokes and the parts, and a Trace button turns the stroke box into the
// tracing quiz of variant C. The trace records nothing. Throwaway.
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Box, ButtonBase, CircularProgress, Collapse } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

import StudyTop from '../../Study/StudyTop';
import StudyScreen from '../../Study/StudyScreen';
import {
  Overline,
  PillToggle,
  PlayButton,
  StudyButton,
  StudyCard,
  hanziSize,
  hanziSx,
} from '../../Study/parts';
import { colors, fonts } from '../../../../theme';
import { Word } from '../../../../types/models';
import {
  CharInfo,
  Strokes,
  marks,
  meanings,
  protoCopy,
  useCharInfos,
  useCharSet,
  useParts,
  useSpeak,
} from './shared';

const Parts: React.FC<{ char: string }> = ({ char }) => {
  const parts = useParts(char);
  if (parts === null) return <CircularProgress size={18} />;
  if (parts.length === 0)
    return <Box sx={{ fontSize: 14, color: colors.textSecondary }}>{protoCopy.noParts}</Box>;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {parts.map((p) => (
        <Box key={p.char} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box lang="zh" sx={hanziSx(26, { color: colors.primaryLight, width: 30 })}>
            {p.char}
          </Box>
          <Box sx={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.3 }}>
            {p.pinyin && <Box sx={{ color: colors.text }}>{p.pinyin}</Box>}
            {p.meaning}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

/** The open part of a row: the stroke box with Replay and Trace, and the parts. */
const RowDetail: React.FC<{ char: string }> = ({ char }) => {
  const [mode, setMode] = useState<'animate' | 'quiz'>('animate');
  const [run, setRun] = useState(0);
  const [traced, setTraced] = useState(false);

  const trace = () => {
    setTraced(false);
    setMode('quiz');
    setRun((n) => n + 1);
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, pt: 1.5, alignItems: 'flex-start' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
        <Box sx={{ position: 'relative' }}>
          <Strokes
            char={char}
            size={160}
            mode={mode}
            replayKey={run}
            onQuizDone={() => setTraced(true)}
          />
          {traced && (
            <Box
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: 13,
                fontWeight: 600,
                color: colors.primaryDark,
              }}
            >
              <CheckRoundedIcon sx={{ fontSize: 16 }} />
              {protoCopy.traced}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <PillToggle
            pressed={mode === 'animate'}
            onClick={() => {
              setTraced(false);
              setMode('animate');
              setRun((n) => n + 1);
            }}
          >
            {protoCopy.replay}
          </PillToggle>
          <PillToggle pressed={mode === 'quiz'} onClick={trace}>
            {protoCopy.trace}
          </PillToggle>
        </Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <Overline sx={{ mb: 1 }}>{protoCopy.parts}</Overline>
        <Parts char={char} />
      </Box>
    </Box>
  );
};

const CharRow: React.FC<{
  char: string;
  info?: CharInfo;
  open: boolean;
  onToggle: () => void;
}> = ({ char, info, open, onToggle }) => (
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
      }}
    >
      <Box lang="zh" sx={hanziSx(40, { width: 48, textAlign: 'center' })}>
        {char}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box lang="zh-Latn" sx={{ fontSize: 16, color: colors.text }}>
          {info?.pinyins.join(' / ')}
        </Box>
        <Box
          sx={{
            fontSize: 14,
            color: colors.textSecondary,
            ...(open ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
          }}
        >
          {info?.meanings.join(' · ')}
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
      <RowDetail char={char} />
    </Collapse>
  </Box>
);

interface Props {
  words: Word[];
  startTest?: () => void;
}

const VariantD: React.FC<Props> = ({ words, startTest }) => {
  const history = useHistory();
  const charSet = useCharSet();
  const [index, setIndex] = useState(0);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const word = words[index];
  const chars = useMemo(() => word[charSet].split(''), [word, charSet]);
  const infos = useCharInfos(chars, charSet);
  const { speak, loading } = useSpeak();
  const last = index === words.length - 1;

  useEffect(() => {
    setOpenRow(null);
    speak(word[charSet]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);

  return (
    <StudyScreen>
      <StudyTop
        stage={protoCopy.stage}
        done={index}
        position={index + 1}
        total={words.length}
        onEnd={() => history.push('/')}
      />
      <StudyCard
        height={220}
        sx={{ mt: 3, pt: 5 }}
        corner={
          <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
            <PlayButton size={44} loading={loading} onClick={() => speak(word[charSet])} />
          </Box>
        }
      >
        <Box lang="zh" sx={hanziSx(hanziSize(word[charSet], 'medium'))}>
          {word[charSet]}
        </Box>
        <Box lang="zh-Latn" sx={{ fontSize: 20 }}>
          {marks(word.pinyin)}
        </Box>
        <Box sx={{ fontSize: 16, color: colors.textSecondary }}>
          {meanings(word.meaning).join(' · ')}
        </Box>
      </StudyCard>

      <Overline sx={{ mt: 3, mb: 1 }}>{protoCopy.characters}</Overline>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {chars.map((char, i) => (
          <CharRow
            key={`${index}-${i}`}
            char={char}
            info={infos[i]}
            open={openRow === i}
            onToggle={() => {
              const opening = openRow !== i;
              setOpenRow(opening ? i : null);
              if (opening) speak(char);
            }}
          />
        ))}
      </Box>

      <Box sx={{ flex: 1, minHeight: 24 }} />
      <Box sx={{ display: 'flex', gap: 1.25 }}>
        {index > 0 && (
          <StudyButton onClick={() => setIndex(index - 1)} sx={{ flex: '0 0 35%' }}>
            {protoCopy.back}
          </StudyButton>
        )}
        <StudyButton variant="primary" onClick={() => (last ? startTest?.() : setIndex(index + 1))}>
          {last ? protoCopy.start : protoCopy.next}
        </StudyButton>
      </Box>
    </StudyScreen>
  );
};

export default VariantD;
