// PROTOTYPE (#413) variant C, "Guided steps": one thing per screen. Each
// word is a short run of steps: hear the word, meet each character (its
// strokes play, its parts sit under it), then trace the word once. The
// trace is practice only; it records nothing. Throwaway.
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Box, ButtonBase, CircularProgress } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import StudyTop from '../../Study/StudyTop';
import StudyScreen from '../../Study/StudyScreen';
import {
  Overline,
  PlayButton,
  Prompt,
  StudyButton,
  StudyCard,
  hanziSize,
  hanziSx,
} from '../../Study/parts';
import { colors } from '../../../../theme';
import { Word } from '../../../../types/models';
import {
  Strokes,
  marks,
  meanings,
  protoCopy,
  useCharInfos,
  useCharSet,
  useParts,
  useSpeak,
} from './shared';

type Step =
  | { kind: 'word'; w: number }
  | { kind: 'char'; w: number; c: number }
  | { kind: 'trace'; w: number };

const PartsRow: React.FC<{ char: string }> = ({ char }) => {
  const parts = useParts(char);
  if (parts === null) return <CircularProgress size={18} sx={{ alignSelf: 'center' }} />;
  if (parts.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
      {parts.map((p) => (
        <Box key={p.char} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box lang="zh" sx={hanziSx(26, { color: colors.primaryLight })}>
            {p.char}
          </Box>
          <Box sx={{ fontSize: 13, color: colors.textSecondary }}>{p.meaning}</Box>
        </Box>
      ))}
    </Box>
  );
};

const TraceStep: React.FC<{ chars: string[]; onDone: () => void }> = ({ chars, onDone }) => {
  const [at, setAt] = useState(0);
  const finished = at >= chars.length;
  useEffect(() => {
    if (finished) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);
  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 2 }}>
        {chars.map((c, i) => (
          <Box
            key={i}
            sx={{
              ...hanziSx(28),
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 1,
              color: i < at ? colors.primaryDark : i === at ? colors.text : colors.disabledText,
              bgcolor: i < at ? colors.successSurface : 'transparent',
            }}
          >
            {c}
          </Box>
        ))}
      </Box>
      <Box sx={{ alignSelf: 'center' }}>
        {finished ? (
          <Box
            sx={{
              width: 260,
              height: 260,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              color: colors.primaryDark,
              fontWeight: 600,
            }}
          >
            <CheckRoundedIcon sx={{ fontSize: 48 }} />
            {protoCopy.traced}
          </Box>
        ) : (
          <Strokes
            key={at}
            char={chars[at]}
            size={260}
            mode="quiz"
            onQuizDone={() => setAt((n) => n + 1)}
          />
        )}
      </Box>
    </>
  );
};

interface Props {
  words: Word[];
  startTest?: () => void;
}

const VariantC: React.FC<Props> = ({ words, startTest }) => {
  const history = useHistory();
  const charSet = useCharSet();
  const steps = useMemo<Step[]>(
    () =>
      words.flatMap((word, w) => [
        { kind: 'word' as const, w },
        ...word[charSet].split('').map((_, c) => ({ kind: 'char' as const, w, c })),
        { kind: 'trace' as const, w },
      ]),
    [words, charSet],
  );
  const [at, setAt] = useState(0);
  const [replay, setReplay] = useState(0);
  const [traced, setTraced] = useState(false);
  const step = steps[at];
  const word = words[step.w];
  const chars = useMemo(() => word[charSet].split(''), [word, charSet]);
  const infos = useCharInfos(chars, charSet);
  const { speak, loading } = useSpeak();
  const last = at === steps.length - 1;

  useEffect(() => {
    setTraced(false);
    if (step.kind === 'word') speak(word[charSet]);
    if (step.kind === 'char') speak(chars[step.c]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  const next = () => (last ? startTest?.() : setAt(at + 1));

  return (
    <StudyScreen>
      <StudyTop
        stage={protoCopy.wordOf(step.w + 1, words.length)}
        done={at}
        position={at + 1}
        total={steps.length}
        onEnd={() => history.push('/')}
      />

      {step.kind === 'word' && (
        <>
          <Prompt>{protoCopy.stage}</Prompt>
          <StudyCard height={320}>
            <Box lang="zh" sx={hanziSx(hanziSize(word[charSet]))}>
              {word[charSet]}
            </Box>
            <Box lang="zh-Latn" sx={{ fontSize: 22 }}>
              {marks(word.pinyin)}
            </Box>
            <Box sx={{ fontSize: 17, color: colors.textSecondary }}>
              {meanings(word.meaning).join(' · ')}
            </Box>
            <PlayButton size={64} loading={loading} onClick={() => speak(word[charSet])} />
          </StudyCard>
        </>
      )}

      {step.kind === 'char' && (
        <>
          <Prompt>
            {word[charSet].split('').map((c, i) => (
              <Box
                component="span"
                key={i}
                lang="zh"
                sx={hanziSx(20, {
                  color: i === step.c ? colors.primaryLight : colors.disabledText,
                })}
              >
                {c}
              </Box>
            ))}
          </Prompt>
          <StudyCard seal={false} sx={{ py: 3 }}>
            <ButtonBase onClick={() => setReplay((n) => n + 1)} aria-label={protoCopy.replay}>
              <Strokes char={chars[step.c]} size={200} replayKey={replay} />
            </ButtonBase>
            <Box lang="zh-Latn" sx={{ fontSize: 22 }}>
              {infos[step.c]?.pinyins.join(' / ')}
            </Box>
            <Box sx={{ fontSize: 15, color: colors.textSecondary }}>
              {infos[step.c]?.meanings.join(' · ')}
            </Box>
            <Box sx={{ width: '100%', pt: 1.5, borderTop: `1px solid ${colors.divider}` }}>
              <Overline sx={{ textAlign: 'center', mb: 1 }}>{protoCopy.parts}</Overline>
              <PartsRow char={chars[step.c]} />
            </Box>
          </StudyCard>
        </>
      )}

      {step.kind === 'trace' && (
        <>
          <Prompt>
            {protoCopy.trace}: <em>{meanings(word.meaning)[0]}</em>
          </Prompt>
          <TraceStep key={at} chars={chars} onDone={() => setTraced(true)} />
        </>
      )}

      <Box sx={{ flex: 1, minHeight: 24 }} />
      <Box sx={{ display: 'flex', gap: 1.25 }}>
        {step.kind === 'trace' && !traced && (
          <StudyButton onClick={next} sx={{ flex: '0 0 35%' }}>
            {protoCopy.skip}
          </StudyButton>
        )}
        <StudyButton variant="primary" disabled={step.kind === 'trace' && !traced} onClick={next}>
          {last ? protoCopy.start : protoCopy.continue}
        </StudyButton>
      </Box>
    </StudyScreen>
  );
};

export default VariantC;
