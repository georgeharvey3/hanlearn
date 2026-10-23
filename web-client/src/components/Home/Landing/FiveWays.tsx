// The five directions, one word asked in each, as a card that the scroll
// deals: the question, then the answer comes in, then the next direction.
import React from 'react';
import Box from '@mui/material/Box';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';

import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { fiveWaysWord as WORD } from './demoData';
import { CELADON } from './layout';
import { span, useGutter, useSectionProgress, useStageScale } from './motion';
import { StrokeChar, useStrokeData } from './StrokeChar';

type Face = keyof typeof copy.landing.fiveWays.faces;

// The directions in the order the steps in the copy name them.
const directions: { q: Face; a: Face }[] = [
  { q: 'char', a: 'meaning' },
  { q: 'pinyin', a: 'meaning' },
  { q: 'meaning', a: 'pinyin' },
  { q: 'char', a: 'pinyin' },
  { q: 'meaning', a: 'char' },
];
const steps = directions.map((d, i) => ({ ...d, label: copy.landing.fiveWays.steps[i] }));
const faceLabel = copy.landing.fiveWays.faces;

/** A direction, "Characters → Meaning", with an icon for the arrow. */
const Direction: React.FC<{ q: Face; a: Face }> = ({ q, a }) => (
  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
    {faceLabel[q]}
    <ArrowForwardRounded aria-hidden sx={{ fontSize: '1.15em', mx: '0.4em', opacity: 0.7 }} />
    {faceLabel[a]}
  </Box>
);

const START = 0.1;
const END = 0.92;
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
        sx={{
          fontSize: big ? { xs: 40, sm: 52 } : { xs: 30, sm: 36 },
          color: colors.primaryDark,
        }}
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

const FiveWays: React.FC = () => {
  const { phone, topBar } = useGutter();
  const scale = useStageScale();
  const { ref, progress: p } = useSectionProgress(topBar);
  const strokes = useStrokeData(WORD.char.split(''));

  const raw = (p - START) / STEP;
  const index = Math.min(steps.length - 1, Math.max(0, Math.floor(raw)));
  const local = Math.min(1, Math.max(0, raw - index));
  const step = steps[index];
  const started = p >= START;
  const answerIn = started ? span(local, 0.35, 0.7) : 0;
  const introOut = span(p, 0.02, START);

  const card = (
    <Box
      sx={{
        position: 'relative',
        width: { xs: 'min(100%, 340px)', sm: 420 },
        height: { xs: 290, sm: 400 },
        flexShrink: 0,
        bgcolor: colors.card,
        borderRadius: 2,
        boxShadow: '0 28px 56px -32px rgba(26, 92, 64, 0.45)',
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
              color: colors.primaryDark,
            }}
          >
            <Direction q={step.q} a={step.a} />
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
    </Box>
  );

  const rail = (
    <Box sx={{ textAlign: 'left' }}>
      {steps.map((s, i) => {
        const active = started && i === index && p < END;
        return (
          <Box
            key={s.label}
            sx={{
              py: { xs: 0.6, sm: 1.25 },
              borderBottom: i < steps.length - 1 ? `1px solid ${colors.divider}` : 'none',
              opacity: i <= index || p >= END ? 1 : 0.45,
              transition: 'opacity 300ms',
            }}
          >
            <Box>
              <Box
                sx={{
                  fontSize: { xs: 15, sm: 18 },
                  fontWeight: active ? 700 : 500,
                  color: active ? colors.primaryDark : colors.textSecondary,
                }}
              >
                {s.label}
              </Box>
              {!phone && (
                <Box sx={{ fontSize: 13, color: colors.textSecondary }}>
                  <Direction q={s.q} a={s.a} />
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );

  return (
    <Box
      ref={ref}
      sx={{ height: phone ? '620vh' : '560vh', position: 'relative', bgcolor: CELADON }}
    >
      <Box
        sx={{
          position: 'sticky',
          top: topBar,
          height: `calc(100svh - ${topBar}px)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row-reverse' },
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 2, md: 10 },
            // Full width on a phone, so the card's percentage width has a
            // fixed base and does not shrink to each question's content.
            width: { xs: '100%', md: 'auto' },
          }}
          style={{ zoom: scale }}
        >
          {card}
          <Box
            sx={{
              position: 'relative',
              width: { xs: 'min(100%, 340px)', md: 440 },
              // The intro and the step list take turns here; one height for
              // both keeps the card from moving when they swap.
              minHeight: { xs: 196, md: 0 },
              p: { xs: 2, sm: 3 },
              boxSizing: 'border-box',
            }}
          >
            <Box
              sx={{
                position: started ? 'absolute' : 'relative',
                inset: started ? { xs: 16, sm: 24 } : undefined,
                opacity: 1 - introOut,
                transform: `translateY(${-introOut * 24}px)`,
                pointerEvents: introOut > 0.5 ? 'none' : 'auto',
                textAlign: { xs: 'center', md: 'left' },
              }}
            >
              <Box
                component="h2"
                sx={{
                  m: 0,
                  fontSize: { xs: 28, sm: 48 },
                  lineHeight: 1.1,
                  fontWeight: 700,
                  color: colors.text,
                }}
              >
                {copy.landing.fiveWays.headline}
              </Box>
              <Box
                sx={{ mt: 1.5, mb: 2.5, fontSize: { xs: 15, sm: 18 }, color: colors.textSecondary }}
              >
                {copy.landing.fiveWays.sub}
              </Box>
            </Box>
            {started && <Box sx={{ opacity: introOut }}>{rail}</Box>}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default FiveWays;
