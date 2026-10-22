// PROTOTYPE (#402) B, "Five ways": a pinned product demo. One word, 学习, is
// asked in each of the five directions as the visitor scrolls, and each
// direction fills its own level bar and gets its own next due date. The page
// sells the thing that makes HanLearn different, by showing it. Throwaway.
import React from 'react';
import Box from '@mui/material/Box';

import { colors, fonts, shadows } from '../../../theme';
import {
  Ctas,
  FullBleed,
  LandingFooter,
  LandingGlobals,
  StrokeChar,
  easeOut,
  landingCopy,
  span,
  useGutter,
  useSectionProgress,
  useStrokeData,
} from './landingShared';

export const name = 'Five ways';

type Face = 'char' | 'pinyin' | 'meaning';

const WORD = { char: '学习', pinyin: 'xuéxí', meaning: 'to study' };

const steps: { code: string; label: string; q: Face; a: Face; due: string; level: number }[] = [
  { code: 'MC', label: 'Read the characters', q: 'char', a: 'meaning', due: 'in 4 days', level: 2 },
  {
    code: 'MP',
    label: 'Understand the sound',
    q: 'pinyin',
    a: 'meaning',
    due: 'in 6 days',
    level: 2,
  },
  { code: 'PM', label: 'Say it', q: 'meaning', a: 'pinyin', due: 'tomorrow', level: 1 },
  { code: 'PC', label: 'Read it aloud', q: 'char', a: 'pinyin', due: 'in 3 days', level: 2 },
  { code: 'CM', label: 'Write it by hand', q: 'meaning', a: 'char', due: 'in 2 days', level: 2 },
];

const faceLabel: Record<Face, string> = {
  char: 'Characters',
  pinyin: 'Pinyin',
  meaning: 'Meaning',
};

const START = 0.1;
const END = 0.88;
const STEP = (END - START) / steps.length;

const FaceText: React.FC<{ face: Face; big?: boolean }> = ({ face, big }) => {
  if (face === 'char')
    return (
      <Box
        sx={{
          fontFamily: fonts.hanzi,
          fontSize: big ? { xs: 84, sm: 120 } : { xs: 56, sm: 72 },
          lineHeight: 1,
        }}
      >
        {WORD.char}
      </Box>
    );
  if (face === 'pinyin')
    return (
      <Box
        sx={{ fontSize: big ? { xs: 40, sm: 52 } : { xs: 30, sm: 36 }, color: colors.primaryDark }}
      >
        {WORD.pinyin}
      </Box>
    );
  return (
    <Box sx={{ fontSize: big ? { xs: 34, sm: 44 } : { xs: 26, sm: 32 }, fontStyle: 'italic' }}>
      {WORD.meaning}
    </Box>
  );
};

const LevelBar: React.FC<{ level: number; active: boolean }> = ({ level, active }) => (
  <Box sx={{ display: 'flex', gap: '3px' }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Box
        key={n}
        sx={{
          width: { xs: 14, sm: 18 },
          height: 6,
          borderRadius: 3,
          bgcolor:
            n <= level ? (active ? colors.primaryLight : colors.primaryDark) : colors.divider,
          transition: 'background-color 300ms',
        }}
      />
    ))}
  </Box>
);

const LandingVariantB: React.FC = () => {
  const { phone, topBar } = useGutter();
  const { ref, progress: p } = useSectionProgress(topBar);
  const strokes = useStrokeData(WORD.char.split(''));

  const raw = (p - START) / STEP;
  const index = Math.min(steps.length - 1, Math.max(0, Math.floor(raw)));
  const local = Math.min(1, Math.max(0, raw - index));
  const step = steps[index];
  const started = p >= START;
  const answerIn = started ? span(local, 0.35, 0.7) : 0;
  const graded = started && local > 0.75;
  const introOut = span(p, 0.02, START);
  const outroIn = easeOut(span(p, END, END + 0.08));

  const levelOf = (i: number) => {
    if (!started || i > index) return 0;
    if (i < index || p >= END) return steps[i].level;
    return graded ? steps[i].level : 0;
  };

  const card = (
    <Box
      sx={{
        position: 'relative',
        width: { xs: 'min(100%, 340px)', sm: 420 },
        height: { xs: 300, sm: 400 },
        bgcolor: colors.card,
        borderRadius: 2,
        boxShadow: shadows.card,
        border: `1px solid ${colors.divider}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        p: 3,
        color: colors.text,
        '@keyframes dealIn': {
          from: { opacity: 0, transform: 'translateY(18px) rotate(-1.5deg)' },
          to: { opacity: 1, transform: 'none' },
        },
      }}
    >
      {!started ? (
        <>
          <FaceText face="char" big />
          <Box sx={{ color: colors.primaryDark, fontSize: 22 }}>{WORD.pinyin}</Box>
        </>
      ) : (
        <Box
          key={index}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2.5,
            width: '100%',
            animation: 'dealIn 380ms ease-out',
          }}
        >
          <Box
            sx={{
              fontSize: 12,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: colors.textSecondary,
            }}
          >
            {faceLabel[step.q]} → {faceLabel[step.a]}
          </Box>
          <FaceText face={step.q} />
          <Box sx={{ width: '70%', height: '1px', bgcolor: colors.divider }} />
          <Box
            sx={{
              minHeight: { xs: 76, sm: 96 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {step.a === 'char' ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                {strokes.map((d, i) => (
                  <StrokeChar
                    key={i}
                    char={WORD.char[i]}
                    data={d}
                    id={`five-${i}`}
                    size={phone ? 72 : 92}
                    progress={span(answerIn, i / 2, (i + 1) / 2)}
                  />
                ))}
              </Box>
            ) : (
              <Box sx={{ opacity: answerIn, transform: `translateY(${(1 - answerIn) * 10}px)` }}>
                <FaceText face={step.a} />
              </Box>
            )}
          </Box>
        </Box>
      )}
      {/* The grade stamp. */}
      <Box
        sx={{
          position: 'absolute',
          top: 14,
          right: 14,
          px: 1.25,
          py: 0.5,
          borderRadius: 1,
          border: `2px solid ${colors.primaryDark}`,
          color: colors.primaryDark,
          fontSize: 13,
          fontWeight: 700,
          opacity: graded ? 1 : 0,
          transform: graded ? 'rotate(-6deg) scale(1)' : 'rotate(-6deg) scale(1.4)',
          transition: 'opacity 200ms, transform 200ms ease-out',
        }}
      >
        ✓ next {step.due}
      </Box>
    </Box>
  );

  const rail = (
    <Box sx={{ width: { xs: 'min(100%, 340px)', sm: 340 }, textAlign: 'left' }}>
      {steps.map((s, i) => {
        const active = started && i === index && p < END;
        return (
          <Box
            key={s.code}
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              alignItems: 'center',
              gap: 1,
              py: { xs: 0.75, sm: 1.5 },
              borderBottom: `1px solid ${colors.divider}`,
              opacity: !started || i <= index || p >= END ? 1 : 0.4,
              transition: 'opacity 300ms',
            }}
          >
            <Box>
              <Box
                sx={{
                  fontSize: { xs: 15, sm: 18 },
                  fontWeight: active ? 700 : 500,
                  color: active ? colors.text : colors.textSecondary,
                }}
              >
                {s.label}
              </Box>
              {!phone && (
                <Box sx={{ fontSize: 13, color: colors.textSecondary }}>
                  {faceLabel[s.q]} → {faceLabel[s.a]}
                </Box>
              )}
            </Box>
            <LevelBar level={levelOf(i)} active={active} />
          </Box>
        );
      })}
    </Box>
  );

  return (
    <>
      <LandingGlobals />
      <FullBleed cancelTop bg={colors.paper}>
        <Box ref={ref} sx={{ height: phone ? '620vh' : '560vh' }}>
          <Box
            sx={{
              position: 'sticky',
              top: topBar,
              height: `calc(100svh - ${topBar}px)`,
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row-reverse' },
              alignItems: 'center',
              justifyContent: 'center',
              gap: { xs: 2.5, md: 10 },
              px: 2,
              overflow: 'hidden',
            }}
          >
            {card}
            <Box sx={{ position: 'relative', width: { xs: 'min(100%, 340px)', md: 440 } }}>
              {/* Intro headline; gives way to the rail once the demo starts. */}
              <Box
                sx={{
                  position: started ? 'absolute' : 'relative',
                  inset: 0,
                  opacity: 1 - introOut,
                  transform: `translateY(${-introOut * 24}px)`,
                  pointerEvents: introOut > 0.5 ? 'none' : 'auto',
                  textAlign: { xs: 'center', md: 'left' },
                }}
              >
                <Box
                  component="h1"
                  sx={{
                    m: 0,
                    fontSize: { xs: 30, sm: 52 },
                    lineHeight: 1.1,
                    fontWeight: 700,
                    color: colors.text,
                  }}
                >
                  {landingCopy.directionsHeadline}
                </Box>
                <Box
                  sx={{ mt: 2, mb: 3, fontSize: { xs: 16, sm: 19 }, color: colors.textSecondary }}
                >
                  {landingCopy.directionsSub}
                </Box>
                <Ctas align={phone ? 'center' : 'flex-start'} />
              </Box>
              {started && (
                <Box sx={{ opacity: introOut }}>
                  {rail}
                  <Box
                    sx={{
                      mt: 3,
                      opacity: outroIn,
                      transform: `translateY(${(1 - outroIn) * 16}px)`,
                      pointerEvents: outroIn > 0.5 ? 'auto' : 'none',
                    }}
                  >
                    <Ctas align={phone ? 'center' : 'flex-start'} />
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </FullBleed>

      {/* A plain, quiet run of features after the demo. */}
      <Box
        sx={{
          maxWidth: 1000,
          mx: 'auto',
          py: { xs: 6, sm: 10 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          columnGap: 6,
          rowGap: { xs: 4, sm: 6 },
        }}
      >
        {landingCopy.features.map((f) => (
          <Box key={f.glyph} sx={{ display: 'flex', gap: 2 }}>
            <Box
              sx={{
                fontFamily: fonts.hanzi,
                fontSize: 40,
                lineHeight: 1,
                color: colors.primaryLight,
              }}
            >
              {f.glyph}
            </Box>
            <Box>
              <Box sx={{ fontSize: 19, fontWeight: 700, color: colors.text }}>{f.title}</Box>
              <Box sx={{ mt: 0.5, fontSize: 16, color: colors.textSecondary }}>{f.body}</Box>
            </Box>
          </Box>
        ))}
      </Box>
      <LandingFooter />
    </>
  );
};

export default LandingVariantB;
