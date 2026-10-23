// A phone that runs the study screen on the landing page,
// built from the session's own parts (StudyTop, StudyCard, StatusLine,
// StudyButton). It plays three questions by itself; a tap hands it to the
// visitor, who then answers them for real: a flashcard, a typed pinyin
// answer, and a character written by hand with Hanzi Writer's quiz.
import React from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';

import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { loadCharData } from '../../../utils/charDataLoader';
import StudyTop from '../../Test/Study/StudyTop';
import {
  CardRule,
  Prompt,
  StatusLine,
  StatusTone,
  StudyButton,
  StudyCard,
  hanziSx,
} from '../../Test/Study/parts';
import { DemoCard, missedDue, phoneCards as cards } from './demoData';
import { useLandingActions } from './layout';
import { StrokeChar, useStrokeData } from './StrokeChar';

// The handwriting card's character.
const writeChar = cards.find((c) => c.kind === 'write')?.answer ?? '';

const promptCategory: Record<DemoCard['kind'], string> = copy.landing.phone.category;

type Phase = 'ask' | 'reveal' | 'graded';

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');
const stripTones = (s: string) =>
  squash(s)
    .normalize('NFD')
    .replace(/[̀-ͯ1-5]/g, '');

/** Grades a typed pinyin answer the way the session does, roughly. */
const gradePinyin = (typed: string): StatusTone => {
  const t = squash(typed);
  if (t === 'dian4nao3' || t === 'diànnǎo') return 'success';
  if (stripTones(t) === 'diannao') return 'warning';
  return 'error';
};

const toneText: Record<StatusTone, string> = {
  success: copy.test.status.correct,
  warning: copy.test.status.tones,
  error: copy.test.status.tryAgain,
  neutral: '',
};

/** The handwriting box: Hanzi Writer's quiz, as in a real session. */
const WritingQuiz: React.FC<{ char: string; size: number; onDone: () => void }> = ({
  char,
  size,
  onDone,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const done = React.useRef(onDone);
  React.useEffect(() => {
    done.current = onDone;
  });
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !window.HanziWriter) return undefined;
    el.innerHTML = '';
    const writer = window.HanziWriter.create(el, char, {
      width: size,
      height: size,
      padding: 16,
      showOutline: false,
      showCharacter: false,
      showHintAfterMisses: 2,
      strokeColor: colors.text,
      drawingColor: colors.text,
      outlineColor: colors.outline,
      charDataLoader: loadCharData,
    });
    writer.quiz({ onComplete: () => setTimeout(() => done.current(), 500) });
    return () => {
      writer.cancelQuiz();
      el.innerHTML = '';
    };
  }, [char, size]);
  return <Box ref={ref} sx={{ width: size, height: size, touchAction: 'none' }} />;
};

const PracticeGrid: React.FC<{ size: number; children: React.ReactNode }> = ({
  size,
  children,
}) => (
  <Box
    sx={{
      position: 'relative',
      width: size,
      height: size,
      mx: 'auto',
      bgcolor: colors.card,
      border: `1px solid ${colors.divider}`,
      borderRadius: 1,
      backgroundImage: `linear-gradient(${colors.gridLine}, ${colors.gridLine}), linear-gradient(90deg, ${colors.gridLine}, ${colors.gridLine})`,
      backgroundSize: '100% 1px, 1px 100%',
      backgroundPosition: 'center, center',
      backgroundRepeat: 'no-repeat',
    }}
  >
    {children}
  </Box>
);

const HeroPhone: React.FC<{ width: number }> = ({ width }) => {
  const { signUp } = useLandingActions();
  const [auto, setAuto] = React.useState(true);
  const [index, setIndex] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>('ask');
  const [typed, setTyped] = React.useState('');
  const [tone, setTone] = React.useState<StatusTone>('neutral');
  const [grade, setGrade] = React.useState<'pass' | 'lapse' | 'fail' | null>(null);
  const [draw, setDraw] = React.useState(0);
  const [answered, setAnswered] = React.useState(0);
  const [finished, setFinished] = React.useState(false);

  const card = cards[index];
  const [goodStrokes] = useStrokeData([writeChar]);
  const screenW = width - 20;
  const height = Math.round(width * (width > 300 ? 1.85 : 2.05));

  const reset = React.useCallback((i: number) => {
    setIndex(i);
    setPhase('ask');
    setTyped('');
    setTone('neutral');
    setGrade(null);
    setDraw(0);
  }, []);

  const next = React.useCallback(() => {
    if (!auto) {
      setAnswered((n) => n + 1);
      if (index === cards.length - 1) {
        setFinished(true);
        return;
      }
    }
    reset((index + 1) % cards.length);
  }, [auto, index, reset]);

  // The script the phone plays by itself.
  React.useEffect(() => {
    if (!auto) return undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    if (card.kind === 'flash') {
      at(1300, () => setPhase('reveal'));
      at(2600, () => setGrade('pass'));
      at(3100, () => {
        setTone('success');
        setPhase('graded');
      });
      at(4900, next);
    } else if (card.kind === 'type') {
      card.demo
        .split('')
        .forEach((_, i) => at(900 + i * 130, () => setTyped(card.demo.slice(0, i + 1))));
      const typedAt = 900 + card.demo.length * 130;
      at(typedAt + 500, () => {
        setTone('success');
        setPhase('graded');
      });
      at(typedAt + 2400, next);
    } else {
      const start = 900;
      const steps = 40;
      for (let i = 1; i <= steps; i++) at(start + i * 50, () => setDraw(i / steps));
      at(start + steps * 50 + 300, () => {
        setTone('success');
        setPhase('graded');
      });
      at(start + steps * 50 + 2200, next);
    }
    return () => timers.forEach(clearTimeout);
  }, [auto, card, next]);

  const takeOver = () => {
    if (!auto) return;
    setAuto(false);
    setAnswered(0);
    setFinished(false);
    reset(0);
  };

  // The X hands the phone back: the script plays again from the first card.
  const resumeAuto = () => {
    setAuto(true);
    setFinished(false);
    reset(0);
  };

  const checkTyped = () => {
    const g = gradePinyin(typed);
    setTone(g);
    if (g !== 'error') setPhase('graded');
  };

  // As in a session: the answer shows, and the word counts as not known. On
  // the handwriting card the strokes play, so the visitor sees how it is
  // written.
  const giveUpTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  React.useEffect(() => {
    const timers = giveUpTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
    };
  }, [index]);
  const giveUp = () => {
    setGrade('fail');
    setTone('error');
    setPhase('graded');
    if (card.kind !== 'write') return;
    setDraw(0);
    const steps = 40;
    for (let i = 1; i <= steps; i++)
      giveUpTimers.current.push(setTimeout(() => setDraw(i / steps), i * 40));
  };

  const gradeFlash = (g: 'pass' | 'lapse' | 'fail') => {
    setGrade(g);
    setTone(g === 'pass' ? 'success' : g === 'lapse' ? 'warning' : 'error');
    setPhase('graded');
  };

  const writer = 150;

  const screen = finished ? (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        textAlign: 'center',
      }}
    >
      <Box sx={{ ...hanziSx(64), color: colors.primaryDark }}>{copy.shell.loadingMark}</Box>
      <Box sx={{ fontSize: 22, fontWeight: 700 }}>{copy.test.status.finished}</Box>
      <Box sx={{ fontSize: 15, color: colors.textSecondary }}>
        {copy.landing.phone.done(answered)}
      </Box>
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
        <StudyButton variant="primary" onClick={signUp}>
          {copy.landing.startLearning}
        </StudyButton>
        <StudyButton
          onClick={() => {
            setFinished(false);
            setAnswered(0);
            reset(0);
          }}
        >
          {copy.landing.phone.again}
        </StudyButton>
      </Box>
    </Box>
  ) : (
    <>
      {/* No way out while the phone plays itself: the X shows once the
          visitor takes over, and hands the phone back. */}
      <Box
        sx={{
          [`& [aria-label="${copy.study.endSession}"]`]: {
            visibility: auto ? 'hidden' : 'visible',
          },
        }}
      >
        <StudyTop
          stage={copy.study.stageTest}
          done={index + (phase === 'graded' ? 1 : 0)}
          total={cards.length}
          position={index + 1}
          onEnd={resumeAuto}
        />
      </Box>
      <Prompt sx={{ mt: 2, mb: 1.25 }}>
        {copy.test.promptBefore}
        <em>{promptCategory[card.kind]}</em>
        {copy.test.promptFor}
      </Prompt>
      <StudyCard height={card.kind === 'write' ? 120 : 190}>
        {card.kind === 'write' ? (
          <Box sx={{ fontSize: 30, fontStyle: 'italic' }}>{card.q}</Box>
        ) : (
          <Box sx={hanziSx(card.q.length <= 2 ? 72 : 56)}>{card.q}</Box>
        )}
        {phase !== 'ask' && card.kind === 'flash' && (
          <>
            <CardRule />
            <Box sx={{ fontSize: 20 }}>{card.answer}</Box>
            <Box sx={{ fontSize: 15, color: colors.primaryDark }}>{card.pinyin}</Box>
          </>
        )}
        {phase === 'graded' && card.kind === 'type' && (
          <>
            <CardRule />
            <Box sx={{ fontSize: 24, color: colors.primaryDark }}>{card.answer}</Box>
          </>
        )}
      </StudyCard>

      {card.kind === 'write' && (
        <Box sx={{ mt: 1.5 }}>
          <PracticeGrid size={writer}>
            {auto || phase === 'graded' ? (
              <StrokeChar
                char={writeChar}
                data={goodStrokes}
                progress={auto || grade === 'fail' ? draw : 1}
                id="phone-good"
                size={writer}
                grid={false}
                outlineColor={null}
              />
            ) : (
              <WritingQuiz
                char={writeChar}
                size={writer}
                onDone={() => {
                  setTone('success');
                  setPhase('graded');
                }}
              />
            )}
          </PracticeGrid>
        </Box>
      )}

      <StatusLine
        tone={tone}
        icon={tone === 'success' ? 'check' : tone === 'error' ? 'retry' : 'dot'}
      >
        {phase === 'graded' || tone === 'error'
          ? grade === 'fail'
            ? copy.test.status.notKnown
            : grade === 'lapse'
              ? copy.test.status.nearly
              : toneText[tone]
          : ''}
      </StatusLine>
      <Box
        sx={{
          height: 20,
          textAlign: 'center',
          fontSize: 13,
          color: colors.textSecondary,
          opacity: phase === 'graded' ? 1 : 0,
          transition: 'opacity 300ms',
        }}
      >
        {copy.landing.phone.next(tone === 'success' ? card.due : missedDue)}
      </Box>

      <Box sx={{ flex: 1 }} />

      {/* The controls at the foot, as in a session. */}
      {card.kind === 'flash' && phase === 'ask' && (
        <StudyButton variant="primary" onClick={() => !auto && setPhase('reveal')}>
          {copy.test.showAnswer}
        </StudyButton>
      )}
      {card.kind === 'flash' && phase === 'reveal' && (
        <Box>
          <Box sx={{ textAlign: 'center', fontSize: 14, color: colors.textSecondary, mb: 1 }}>
            {copy.test.didYouKnow}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <StudyButton pressed={grade === 'fail'} onClick={() => !auto && gradeFlash('fail')}>
              {copy.test.gradeFail}
            </StudyButton>
            <StudyButton pressed={grade === 'lapse'} onClick={() => !auto && gradeFlash('lapse')}>
              {copy.test.gradeLapse}
            </StudyButton>
            <StudyButton pressed={grade === 'pass'} onClick={() => !auto && gradeFlash('pass')}>
              {copy.test.gradePass}
            </StudyButton>
          </Box>
        </Box>
      )}
      {card.kind === 'type' && phase !== 'graded' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box
            component="input"
            value={typed}
            readOnly={auto}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setTyped(e.target.value);
              setTone('neutral');
            }}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && checkTyped()}
            placeholder={copy.test.placeholderPinyin}
            aria-label={copy.test.answerInput}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            sx={{
              height: 48,
              boxSizing: 'border-box',
              px: 1.5,
              fontSize: 17,
              fontFamily: fonts.body,
              color: colors.text,
              bgcolor: colors.card,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: 1,
              outline: 'none',
              '&:focus': { borderColor: colors.primaryDark },
            }}
          />
          <StudyButton onClick={() => !auto && giveUp()}>{copy.test.iDontKnow}</StudyButton>
          <StudyButton variant="primary" disabled={!typed} onClick={() => !auto && checkTyped()}>
            {copy.test.check}
          </StudyButton>
        </Box>
      )}
      {card.kind === 'write' && phase !== 'graded' && !auto && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ textAlign: 'center', fontSize: 14, color: colors.textSecondary }}>
            {copy.landing.phone.draw}
          </Box>
          <StudyButton onClick={giveUp}>{copy.test.iDontKnow}</StudyButton>
        </Box>
      )}
      {phase === 'graded' && !auto && (
        <StudyButton variant="primary" onClick={next}>
          {copy.test.continue}
        </StudyButton>
      )}
    </>
  );

  return (
    <Box sx={{ position: 'relative', flexShrink: 0 }}>
      <Box
        onPointerDown={takeOver}
        sx={{
          position: 'relative',
          width,
          height,
          boxSizing: 'border-box',
          p: '10px',
          borderRadius: '44px',
          bgcolor: '#1d1a17',
          boxShadow: '0 40px 80px -30px rgba(43, 38, 34, 0.55), 0 0 0 1px rgba(0,0,0,0.4)',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: screenW,
            height: height - 20,
            borderRadius: '34px',
            overflow: 'hidden',
            bgcolor: colors.paper,
            color: colors.text,
            fontFamily: fonts.body,
            display: 'flex',
            flexDirection: 'column',
            px: 2,
            pt: '34px',
            pb: 2.5,
            boxSizing: 'border-box',
            textAlign: 'left',
          }}
        >
          {/* The camera notch. */}
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 86,
              height: 24,
              borderRadius: 12,
              bgcolor: '#1d1a17',
            }}
          />
          {screen}
        </Box>
      </Box>
      <ButtonBase
        onClick={takeOver}
        sx={{
          position: 'absolute',
          left: '50%',
          bottom: -18,
          transform: 'translateX(-50%)',
          px: 2,
          height: 36,
          borderRadius: 18,
          bgcolor: colors.primaryLight,
          color: colors.white,
          fontFamily: fonts.body,
          fontSize: 14,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          boxShadow: '0 8px 20px -8px rgba(184, 50, 63, 0.6)',
          opacity: auto ? 1 : 0,
          pointerEvents: auto ? 'auto' : 'none',
          transition: 'opacity 300ms',
          '@keyframes nudge': {
            '0%, 100%': { transform: 'translateX(-50%) translateY(0)' },
            '50%': { transform: 'translateX(-50%) translateY(-4px)' },
          },
          animation: 'nudge 2.4s ease-in-out infinite',
        }}
      >
        {copy.landing.phone.takeOver}
      </ButtonBase>
    </Box>
  );
};

export default HeroPhone;
