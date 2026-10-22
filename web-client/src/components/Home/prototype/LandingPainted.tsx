// PROTOTYPE (#402) "Painted": the chosen mix of the first round. The
// five-ways demo (B) comes first, then today's chengyu written stroke by
// stroke (A), then the four features. Behind both pinned sections the ink
// painting of the old banner stays put while the scroll pans the view across
// it, like a handscroll unrolled one view at a time. Throwaway.
import React from 'react';
import Box from '@mui/material/Box';

import mountains from '../../../assets/images/homepage/mountains.jpg';
import { getDailyChengyu, chengyus } from '../../../data/chengyus';
import { colors, fonts, shadows } from '../../../theme';
import {
  Ctas,
  FullBleed,
  LandingFooter,
  LandingGlobals,
  Seal,
  StrokeChar,
  easeOut,
  landingCopy,
  span,
  useGutter,
  useSectionProgress,
  useStrokeData,
} from './landingShared';

export const name = 'Painted';

const IMAGE_RATIO = 3000 / 2000;

// A rice-paper sheet laid on the painting: enough paper to read on, thin
// enough that the ink shows through.
const sheet = {
  bgcolor: 'rgba(250, 248, 245, 0.82)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  border: `1px solid rgba(214, 200, 180, 0.6)`,
  borderRadius: 2,
} as const;

// --- The painting ---------------------------------------------------------

// The camera moves one way only: it starts at the top of the painting, on
// the peaks and the sun, and sinks at a steady pace to the water and the boat
// as the whole journey scrolls. The zoom and the sideways framing stay fixed,
// so nothing jumps where one section hands over to the next.
const ZOOM = 1.3;
// The share of the sideways slack to the left of the view. On a phone this
// frames the sun at the top and the boat at the bottom.
const FRAME_X = 0.8;
const MIST = 0.18;

const cameraAt = (p: number) => ({ x: FRAME_X, y: p, zoom: ZOOM, mist: MIST });

const Painting: React.FC<{ progress: number; topBar: number }> = ({ progress, topBar }) => {
  const [size, setSize] = React.useState({ w: window.innerWidth, h: window.innerHeight - topBar });
  React.useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight - topBar });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [topBar]);

  const cam = cameraAt(progress);
  const imgH = Math.max(size.h, size.w / IMAGE_RATIO) * cam.zoom;
  const imgW = imgH * IMAGE_RATIO;
  const left = -(imgW - size.w) * cam.x;
  const top = -(imgH - size.h) * cam.y;

  return (
    <Box
      aria-hidden
      sx={{
        position: 'sticky',
        top: topBar,
        height: `calc(100svh - ${topBar}px)`,
        // Pull what follows back up, so the sections scroll over the painting.
        mb: `calc(-100svh + ${topBar}px)`,
        overflow: 'hidden',
        zIndex: 0,
        bgcolor: colors.primary,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${mountains})`,
          backgroundRepeat: 'no-repeat',
        }}
        style={{ backgroundSize: `${imgW}px ${imgH}px`, backgroundPosition: `${left}px ${top}px` }}
      />
      <Box
        sx={{ position: 'absolute', inset: 0, bgcolor: colors.paper }}
        style={{ opacity: cam.mist }}
      />
    </Box>
  );
};

// --- Five ways --------------------------------------------------------------

type Face = 'char' | 'pinyin' | 'meaning';

const WORD = { char: '学习', pinyin: 'xuéxí', meaning: 'to study' };

const steps: { label: string; q: Face; a: Face; due: string; level: number }[] = [
  { label: 'Read the characters', q: 'char', a: 'meaning', due: 'in 4 days', level: 2 },
  { label: 'Understand the sound', q: 'pinyin', a: 'meaning', due: 'in 6 days', level: 2 },
  { label: 'Say it', q: 'meaning', a: 'pinyin', due: 'tomorrow', level: 1 },
  { label: 'Read it aloud', q: 'char', a: 'pinyin', due: 'in 3 days', level: 2 },
  { label: 'Write it by hand', q: 'meaning', a: 'char', due: 'in 2 days', level: 2 },
];

const faceLabel: Record<Face, string> = {
  char: 'Characters',
  pinyin: 'Pinyin',
  meaning: 'Meaning',
};

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
            n <= level ? (active ? colors.primaryLight : colors.primaryDark) : colors.borderStrong,
          transition: 'background-color 300ms',
        }}
      />
    ))}
  </Box>
);

const FiveWays: React.FC = () => {
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
        height: { xs: 290, sm: 400 },
        flexShrink: 0,
        bgcolor: colors.card,
        borderRadius: 2,
        boxShadow: shadows.dialog,
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
    <Box sx={{ textAlign: 'left' }}>
      {steps.map((s, i) => {
        const active = started && i === index && p < END;
        return (
          <Box
            key={s.label}
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              alignItems: 'center',
              gap: 1,
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
    <Box ref={ref} sx={{ height: phone ? '620vh' : '560vh', position: 'relative', zIndex: 1 }}>
      <Box
        sx={{
          position: 'sticky',
          top: topBar,
          height: `calc(100svh - ${topBar}px)`,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row-reverse' },
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 2, md: 10 },
          px: 2,
        }}
      >
        {card}
        <Box
          sx={{
            ...sheet,
            position: 'relative',
            width: { xs: 'min(100%, 340px)', md: 440 },
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
              component="h1"
              sx={{
                m: 0,
                fontSize: { xs: 28, sm: 48 },
                lineHeight: 1.1,
                fontWeight: 700,
                color: colors.text,
              }}
            >
              {landingCopy.directionsHeadline}
            </Box>
            <Box
              sx={{ mt: 1.5, mb: 2.5, fontSize: { xs: 15, sm: 18 }, color: colors.textSecondary }}
            >
              {landingCopy.directionsSub}
            </Box>
            <Ctas align={phone ? 'center' : 'flex-start'} />
          </Box>
          {started && <Box sx={{ opacity: introOut }}>{rail}</Box>}
        </Box>
      </Box>
    </Box>
  );
};

// --- Today's chengyu ------------------------------------------------------

const DRAW_END = 0.62;

const ChengyuBrush: React.FC = () => {
  const { phone, topBar } = useGutter();
  const { ref, progress: p } = useSectionProgress(topBar);
  const daily = React.useMemo(() => getDailyChengyu(), []);
  const chars = daily.chengyu.split('');
  const meaning = chengyus.find((c) => c.characters === daily.chengyu)?.meaning ?? '';
  const data = useStrokeData(chars);

  const charProgress = (i: number) =>
    span(p, (i * DRAW_END) / chars.length, ((i + 1) * DRAW_END) / chars.length);
  const size = phone ? 76 : 140;
  const meaningIn = easeOut(span(p, 0.64, 0.74));
  const sealIn = span(p, 0.74, 0.8);
  const ctaIn = easeOut(span(p, 0.8, 0.92));

  return (
    <Box ref={ref} sx={{ height: '360vh', position: 'relative', zIndex: 1 }}>
      <Box
        sx={{
          position: 'sticky',
          top: topBar,
          height: `calc(100svh - ${topBar}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
        }}
      >
        <Box
          sx={{
            ...sheet,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: { xs: 2, sm: 3 },
            px: { xs: 2, sm: 6 },
            py: { xs: 3, sm: 5 },
            maxWidth: 720,
            width: { xs: '100%', sm: 'auto' },
            boxSizing: 'border-box',
          }}
        >
          <Box
            sx={{
              fontSize: { xs: 13, sm: 14 },
              letterSpacing: 2,
              color: colors.textSecondary,
              textTransform: 'uppercase',
            }}
          >
            {landingCopy.todaysChengyu}
          </Box>

          <Box sx={{ position: 'relative', display: 'flex', gap: { xs: 1, sm: 2 } }}>
            {chars.map((c, i) => {
              const cp = charProgress(i);
              return (
                <Box key={i} sx={{ textAlign: 'center' }}>
                  <Box sx={{ bgcolor: colors.paper }}>
                    <StrokeChar
                      char={c}
                      data={data[i]}
                      progress={cp}
                      id={`brush-${i}`}
                      size={size}
                    />
                  </Box>
                  <Box
                    sx={{
                      mt: 1,
                      fontSize: { xs: 15, sm: 20 },
                      color: colors.primaryDark,
                      opacity: span(cp, 0.85, 1),
                      transform: `translateY(${(1 - span(cp, 0.85, 1)) * 8}px)`,
                    }}
                  >
                    {daily.charPinyins[i]?.pinyin}
                  </Box>
                </Box>
              );
            })}
            <Seal
              size={phone ? 34 : 52}
              sx={{
                position: 'absolute',
                right: phone ? -14 : -36,
                bottom: phone ? 18 : 30,
                opacity: sealIn,
                transform: `scale(${1.6 - 0.6 * easeOut(sealIn)}) rotate(-4deg)`,
              }}
            />
          </Box>

          <Box
            sx={{
              fontSize: { xs: 18, sm: 22 },
              fontStyle: 'italic',
              color: colors.text,
              textAlign: 'center',
              maxWidth: 520,
              minHeight: '1.5em',
              opacity: meaningIn,
              transform: `translateY(${(1 - meaningIn) * 12}px)`,
            }}
          >
            {meaning}
          </Box>

          <Box
            sx={{
              textAlign: 'center',
              opacity: ctaIn,
              transform: `translateY(${(1 - ctaIn) * 24}px)`,
              pointerEvents: ctaIn > 0.5 ? 'auto' : 'none',
              maxWidth: 560,
              // The sheet grows to take the call to action, rather than
              // holding an empty space for it while the strokes draw.
              maxHeight: ctaIn * 360,
              overflow: 'hidden',
              mt: ctaIn < 0.01 ? { xs: -2, sm: -3 } : 0,
            }}
          >
            <Box
              component="h2"
              sx={{
                m: 0,
                fontSize: { xs: 26, sm: 38 },
                lineHeight: 1.15,
                fontWeight: 700,
                color: colors.text,
              }}
            >
              {landingCopy.brushHeadline}
            </Box>
            <Box sx={{ mt: 1.5, mb: 3, fontSize: { xs: 15, sm: 17 }, color: colors.textSecondary }}>
              {landingCopy.brushSub}
            </Box>
            <Ctas />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

// --- The page ---------------------------------------------------------------

const LandingPainted: React.FC = () => {
  const { topBar } = useGutter();
  // The camera follows the whole journey, so it pans on without a break
  // where one pinned section hands over to the next.
  const { ref, progress } = useSectionProgress(topBar);

  return (
    <>
      <LandingGlobals />
      <FullBleed cancelTop>
        <Box ref={ref} sx={{ position: 'relative' }}>
          <Painting progress={progress} topBar={topBar} />
          <FiveWays />
          <ChengyuBrush />
        </Box>
      </FullBleed>

      {/* The four features, on plain paper: entries in a copybook. */}
      <FullBleed bg={colors.paper} sx={{ zIndex: 1 }}>
        <Box sx={{ maxWidth: 880, mx: 'auto', px: 2, py: { xs: 6, sm: 10 } }}>
          {landingCopy.features.map((f, i) => (
            <Box
              key={f.glyph}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '72px 1fr', sm: '140px 1fr' },
                alignItems: 'center',
                gap: { xs: 2, sm: 4 },
                py: { xs: 3, sm: 4 },
                borderTop: i ? `1px solid ${colors.divider}` : 'none',
              }}
            >
              <Box
                sx={{
                  fontFamily: fonts.hanzi,
                  fontSize: { xs: 64, sm: 120 },
                  lineHeight: 1,
                  color: colors.text,
                }}
              >
                {f.glyph}
              </Box>
              <Box>
                <Box sx={{ fontSize: { xs: 20, sm: 26 }, fontWeight: 700, color: colors.text }}>
                  {f.title}
                </Box>
                <Box sx={{ mt: 0.5, fontSize: { xs: 15, sm: 17 }, color: colors.textSecondary }}>
                  {f.body}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </FullBleed>

      <FullBleed bg={colors.primaryDark}>
        <Box sx={{ py: { xs: 8, sm: 12 }, px: 2, textAlign: 'center', color: colors.white }}>
          <Box component="h2" sx={{ m: 0, mb: 3, fontSize: { xs: 26, sm: 38 }, fontWeight: 700 }}>
            {landingCopy.finalHeadline}
          </Box>
          <Ctas inverse />
        </Box>
      </FullBleed>
      <LandingFooter />
    </>
  );
};

export default LandingPainted;
