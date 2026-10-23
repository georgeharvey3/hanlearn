// PROTOTYPE (#413) variant E, "Guided word": each new word walks through
// three steps that echo the test's directions. Understand: the word, then each
// character and its parts. Say: hear the word, then speak it. Write:
// trace each character. Every step can be skipped, and so can the rest of
// the introduction. Nothing here records a result. Throwaway.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, ButtonBase } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { pinyin } from 'pinyin-pro';

import StudyTop from '../../Study/StudyTop';
import StudyScreen from '../../Study/StudyScreen';
import {
  MicButton,
  Overline,
  PlayButton,
  StatusLine,
  StatusTone,
  StudyButton,
  StudyCard,
  hanziSize,
  hanziSx,
} from '../../Study/parts';
import { colors, fonts } from '../../../../theme';
import { RootState } from '../../../../types/store';
import { Word } from '../../../../types/models';
import { CharRow } from './VariantD';
import { Strokes, marks, meanings, protoCopy, useCharInfos, useCharSet, useSpeak } from './shared';

type StepKey = 'understand' | 'say' | 'write';
const STEPS: { key: StepKey; label: string }[] = [
  { key: 'understand', label: 'Understand' },
  { key: 'say', label: 'Say' },
  { key: 'write', label: 'Write' },
];

const eCopy = {
  skipStep: 'Skip',
  skipAll: 'Skip to test',
  sayPrompt: 'Say the word',
  writePrompt: 'Trace the word',
  heardNothing: 'Heard nothing. Try again.',
  listening: 'Listening…',
  wellSaid: 'Well said',
  checkTones: 'Check the tones',
  tryAgain: 'Not quite. Try again.',
  noSpeech: 'Speech input is not available here',
  heard: 'Heard',
};

/** The three steps of the word, as a rail: done, current, to come. */
const StepRail: React.FC<{ at: number; done: boolean[]; onPick: (i: number) => void }> = ({
  at,
  done,
  onPick,
}) => (
  <Box sx={{ display: 'flex', gap: 0.75, mt: 2 }}>
    {STEPS.map((s, i) => {
      const current = i === at;
      return (
        <ButtonBase
          key={s.key}
          onClick={() => onPick(i)}
          aria-current={current ? 'step' : undefined}
          sx={{
            flex: 1,
            height: 36,
            gap: 0.5,
            borderRadius: '18px',
            fontFamily: fonts.body,
            fontSize: 14,
            fontWeight: current ? 600 : 400,
            border: `1px solid ${current ? colors.primaryDark : colors.divider}`,
            bgcolor: current ? colors.successSurface : 'transparent',
            color: current ? colors.primaryDark : done[i] ? colors.text : colors.textSecondary,
          }}
        >
          {done[i] && !current && (
            <CheckRoundedIcon sx={{ fontSize: 16, color: colors.primaryDark }} />
          )}
          {s.label}
        </ButtonBase>
      );
    })}
  </Box>
);

const WordCard: React.FC<{
  word: Word;
  charSet: 'simp' | 'trad';
  showMeaning?: boolean;
  compact?: boolean;
  speak: (t: string) => void;
  loading: boolean;
}> = ({ word, charSet, showMeaning = true, compact, speak, loading }) => (
  <StudyCard
    height={compact ? 150 : 200}
    sx={{ mt: 2, pt: 4 }}
    corner={
      <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
        <PlayButton size={44} loading={loading} onClick={() => speak(word[charSet])} />
      </Box>
    }
  >
    <Box lang="zh" sx={hanziSx(hanziSize(word[charSet], compact ? 'small' : 'medium'))}>
      {word[charSet]}
    </Box>
    <Box lang="zh-Latn" sx={{ fontSize: 20 }}>
      {marks(word.pinyin)}
    </Box>
    {showMeaning && (
      <Box sx={{ fontSize: 16, color: colors.textSecondary }}>
        {meanings(word.meaning).join(' · ')}
      </Box>
    )}
  </StudyCard>
);

// --- Step 1: understand ---

const UnderstandStep: React.FC<{
  word: Word;
  charSet: 'simp' | 'trad';
  speak: (t: string) => void;
  loading: boolean;
}> = ({ word, charSet, speak, loading }) => {
  const chars = useMemo(() => word[charSet].split(''), [word, charSet]);
  const infos = useCharInfos(chars, charSet);
  const [openRow, setOpenRow] = useState<number | null>(null);
  return (
    <>
      <WordCard word={word} charSet={charSet} speak={speak} loading={loading} />
      <Overline sx={{ mt: 3, mb: 1 }}>{protoCopy.characters}</Overline>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {chars.map((char, i) => (
          <CharRow
            key={i}
            char={char}
            info={infos[i]}
            open={openRow === i}
            partsOnly
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

// --- Step 2: say it ---

type Syllable = { text: string; tone: StatusTone };

/** Compare what was heard with the word, syllable by syllable. */
function compareSpeech(heard: string, word: Word): { syllables: Syllable[]; tone: StatusTone } {
  const said = pinyin(heard, { toneType: 'num', type: 'array' });
  const expected = word.pinyin
    .toLowerCase()
    .replace(/u:/g, 'v')
    .split(/\s+/)
    .map((s) => s.replace(/5$/, '0'));
  const strip = (s: string) => s.replace(/[0-5]$/, '');
  const syllables = expected.map((exp, i) => {
    const got = said[i];
    if (!got || strip(got) !== strip(exp)) return { text: got ?? '·', tone: 'error' as const };
    const sameTone = got.slice(-1) === exp.slice(-1) || exp.endsWith('0');
    return { text: got, tone: sameTone ? ('success' as const) : ('warning' as const) };
  });
  const tone: StatusTone = syllables.some((s) => s.tone === 'error')
    ? 'error'
    : syllables.some((s) => s.tone === 'warning')
      ? 'warning'
      : 'success';
  return { syllables, tone };
}

const SayStep: React.FC<{
  word: Word;
  charSet: 'simp' | 'trad';
  speak: (t: string) => void;
  loading: boolean;
  onSaid: () => void;
}> = ({ word, charSet, speak, loading, onSaid }) => {
  const speechAvailable = useSelector((s: RootState) => s.settings.speechAvailable);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<{
    text: string;
    syllables: Syllable[];
    tone: StatusTone;
  } | null>(null);
  const [status, setStatus] = useState('');
  const recognition = useRef<SpeechRecognition | null>(null);

  useEffect(() => () => recognition.current?.abort(), []);

  const listen = useCallback(() => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const r = new window.webkitSpeechRecognition();
    r.lang = 'zh-CN';
    recognition.current = r;
    let got = '';
    r.addEventListener('audiostart', () => {
      setListening(true);
      setStatus(eCopy.listening);
    });
    r.addEventListener('result', (e: SpeechRecognitionEvent) => {
      got = e.results[0][0].transcript;
      const result = compareSpeech(got, word);
      setHeard({ text: got, ...result });
      setStatus(
        result.tone === 'success'
          ? eCopy.wellSaid
          : result.tone === 'warning'
            ? eCopy.checkTones
            : eCopy.tryAgain,
      );
      onSaid();
    });
    r.addEventListener('end', () => {
      setListening(false);
      if (!got) setStatus(eCopy.heardNothing);
    });
    r.start();
  }, [listening, onSaid, word]);

  const tone: StatusTone = heard && !listening ? heard.tone : 'neutral';

  return (
    <>
      <Box sx={{ mt: 3, mb: 1, textAlign: 'center', fontSize: 15, color: colors.textSecondary }}>
        {eCopy.sayPrompt}
      </Box>
      <WordCard word={word} charSet={charSet} compact speak={speak} loading={loading} />
      <Box sx={{ minHeight: 64, mt: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {heard && (
          <>
            <Overline sx={{ textAlign: 'center' }}>{eCopy.heard}</Overline>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.25, fontSize: 22 }}>
              {heard.syllables.map((s, i) => (
                <Box
                  key={i}
                  lang="zh-Latn"
                  sx={{
                    color:
                      s.tone === 'success'
                        ? colors.success
                        : s.tone === 'warning'
                          ? colors.warningText
                          : colors.primaryLight,
                    fontWeight: 600,
                  }}
                >
                  {marks(s.text.replace(/0$/, ''))}
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>
      <StatusLine tone={tone}>{speechAvailable ? status : eCopy.noSpeech}</StatusLine>
      <MicButton
        listening={listening}
        disabled={!speechAvailable}
        onClick={listen}
        sx={{ mt: 2.5 }}
      />
    </>
  );
};

// --- Step 3: write it ---

const WriteStep: React.FC<{ word: Word; charSet: 'simp' | 'trad'; onDone: () => void }> = ({
  word,
  charSet,
  onDone,
}) => {
  const chars = useMemo(() => word[charSet].split(''), [word, charSet]);
  const [at, setAt] = useState(0);
  const finished = at >= chars.length;
  useEffect(() => {
    if (finished) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);
  return (
    <>
      <Box sx={{ mt: 3, mb: 1, textAlign: 'center', fontSize: 15, color: colors.textSecondary }}>
        {eCopy.writePrompt}
        {': '}
        <Box component="span" sx={{ color: colors.primaryLight, fontWeight: 600 }}>
          {meanings(word.meaning)[0]}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', my: 1.5 }}>
        {chars.map((c, i) => (
          <Box
            key={i}
            lang="zh"
            sx={{
              ...hanziSx(28),
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 1,
              color: i < at ? colors.primaryDark : i === at ? colors.text : colors.disabledText,
              bgcolor: i < at ? colors.successSurface : 'transparent',
              border: `1px solid ${i === at ? colors.borderStrong : 'transparent'}`,
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

// --- The variant ---

interface Props {
  words: Word[];
  startTest?: () => void;
}

const VariantE: React.FC<Props> = ({ words, startTest }) => {
  const history = useHistory();
  const charSet = useCharSet();
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  // Which steps of the current word the learner finished, not skipped.
  const [done, setDone] = useState<boolean[]>([false, false, false]);
  const word = words[index];
  const { speak, loading } = useSpeak();
  const lastWord = index === words.length - 1;
  const lastStep = step === STEPS.length - 1;

  useEffect(() => {
    setStep(0);
    setDone([false, false, false]);
    speak(word[charSet]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);

  const mark = useCallback(
    (i: number) => setDone((d) => d.map((v, k) => (k === i ? true : v))),
    [],
  );

  const advance = () => {
    if (!lastStep) setStep(step + 1);
    else if (!lastWord) setIndex(index + 1);
    else startTest?.();
  };

  const onContinue = () => {
    if (step === 0) mark(0);
    advance();
  };

  // The primary button: Continue through the steps, then the next word.
  const primaryLabel = !lastStep ? protoCopy.continue : lastWord ? protoCopy.start : protoCopy.next;
  const current = STEPS[step].key;
  const canContinue = current === 'understand' || done[step];

  return (
    <StudyScreen>
      <StudyTop
        stage={protoCopy.wordOf(index + 1, words.length)}
        done={index * STEPS.length + step}
        total={words.length * STEPS.length}
        position={index * STEPS.length + step + 1}
        onEnd={() => history.push('/')}
      />
      <Box sx={{ mx: -2, px: 2 }}>
        <StepRail at={step} done={done} onPick={setStep} />
      </Box>

      {current === 'understand' && (
        <UnderstandStep word={word} charSet={charSet} speak={speak} loading={loading} />
      )}
      {current === 'say' && (
        <SayStep
          key={index}
          word={word}
          charSet={charSet}
          speak={speak}
          loading={loading}
          onSaid={() => mark(1)}
        />
      )}
      {current === 'write' && (
        <WriteStep key={index} word={word} charSet={charSet} onDone={() => mark(2)} />
      )}

      <Box sx={{ flex: 1, minHeight: 24 }} />
      <ButtonBase
        onClick={() => startTest?.()}
        sx={{
          alignSelf: 'center',
          mb: 1,
          height: 40,
          px: 1.5,
          fontFamily: fonts.body,
          fontSize: 14,
          color: colors.textSecondary,
          textDecoration: 'underline',
          textUnderlineOffset: 3,
        }}
      >
        {eCopy.skipAll}
      </ButtonBase>
      <Box sx={{ display: 'flex', gap: 1.25 }}>
        {!canContinue && (
          <StudyButton onClick={advance} sx={{ flex: '0 0 35%' }}>
            {eCopy.skipStep}
          </StudyButton>
        )}
        <StudyButton variant="primary" disabled={!canContinue} onClick={onContinue}>
          {primaryLabel}
        </StudyButton>
      </Box>
    </StudyScreen>
  );
};

export default VariantE;
