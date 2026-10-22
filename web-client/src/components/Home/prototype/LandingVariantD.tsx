// PROTOTYPE (#402) D, "Memory curve": a scroll-drawn chart tells the
// spaced-repetition story. First the plain forgetting curve falls away; then
// the HanLearn line draws, each review a jump back to the top, each gap longer
// than the last. The curves use the FSRS forgetting curve that the scheduler
// uses, with made-up stabilities. Throwaway.
import React from 'react';
import Box from '@mui/material/Box';

import { colors, fonts } from '../../../theme';
import {
  Ctas,
  FullBleed,
  LandingFooter,
  LandingGlobals,
  easeOut,
  landingCopy,
  span,
  useGutter,
  useSectionProgress,
} from './landingShared';

export const name = 'Memory curve';

// FSRS: R(t) = (1 + F t / S)^C, with R(S) = 0.9.
const F = 19 / 81;
const C = -0.5;
const recall = (t: number, s: number) => (1 + (F * t) / s) ** C;

const DAYS = 90;
const W = 1000;
const H = 520;
const PAD = { l: 56, r: 24, t: 24, b: 48 };
const x = (d: number) => PAD.l + (d / DAYS) * (W - PAD.l - PAD.r);
const y = (r: number) => PAD.t + (1 - r) * (H - PAD.t - PAD.b);

// Without review: one exposure on day 0, stability of one day.
const plainPoints = Array.from({ length: 181 }, (_, i) => {
  const d = (i / 180) * DAYS;
  return [x(d), y(recall(d, 1))];
});

// With review: each review lands when recall reaches 0.9, and grows the
// stability.
const stabilities = [1, 3, 8, 20, 50];
const reviews: number[] = [];
const reviewAt: number[] = [];
const spacedPoints: number[][] = [];
{
  let start = 0;
  stabilities.forEach((s) => {
    const until = Math.min(DAYS, start + s);
    for (let d = start; d <= until + 1e-6; d += Math.max(0.05, s / 60))
      spacedPoints.push([x(d), y(recall(d - start, s))]);
    spacedPoints.push([x(until), y(recall(until - start, s))]);
    if (until < DAYS) {
      reviews.push(until);
      spacedPoints.push([x(until), y(1)]);
      reviewAt.push(spacedPoints.length - 1);
    }
    start = until;
  });
  // The last stability runs to the edge of the chart.
  const s = 120;
  for (let d = start; d <= DAYS; d += 0.5) spacedPoints.push([x(d), y(recall(d - start, s))]);
}

// Length along the line up to each point, so a review's dot pops as the
// drawn line reaches it.
const lengthTo: number[] = spacedPoints.map(() => 0);
spacedPoints.forEach((pt, i) => {
  if (i)
    lengthTo[i] =
      lengthTo[i - 1] + Math.hypot(pt[0] - spacedPoints[i - 1][0], pt[1] - spacedPoints[i - 1][1]);
});

const toPath = (pts: number[][]) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
const plainPath = toPath(plainPoints);
const spacedPath = toPath(spacedPoints);

const captions = [
  { at: 0, title: 'You learn a new word.', body: 'By next week, most of it is gone.' },
  {
    at: 0.3,
    title: 'HanLearn asks again just in time.',
    body: 'Each review lands as your recall dips to 90%.',
  },
  {
    at: 0.62,
    title: 'And each gap grows.',
    body: `${reviews.map((d) => `day ${Math.round(d)}`).join(', ')}.`,
  },
  { at: 0.84, title: 'Five reviews. Three months. Still yours.', body: '' },
];

const LandingVariantD: React.FC = () => {
  const { phone, topBar } = useGutter();
  const { ref, progress: p } = useSectionProgress(topBar);
  const plainRef = React.useRef<SVGPathElement>(null);
  const spacedRef = React.useRef<SVGPathElement>(null);
  const [lens, setLens] = React.useState({ plain: 1, spaced: 1 });

  React.useLayoutEffect(() => {
    setLens({
      plain: plainRef.current?.getTotalLength() ?? 1,
      spaced: spacedRef.current?.getTotalLength() ?? 1,
    });
  }, []);

  const plainDraw = easeOut(span(p, 0.04, 0.26));
  const spacedDraw = span(p, 0.32, 0.82);
  const drawnLength = lengthTo[lengthTo.length - 1] * spacedDraw;
  const caption = [...captions].reverse().find((c) => p >= c.at) ?? captions[0];
  const ctaIn = easeOut(span(p, 0.88, 0.97));

  return (
    <>
      <LandingGlobals />
      {/* An unpinned hero: the headline, the actions, then the story below. */}
      <Box
        sx={{
          maxWidth: 820,
          mx: 'auto',
          textAlign: { xs: 'left', sm: 'center' },
          pt: { xs: 6, sm: 12 },
          pb: { xs: 4, sm: 6 },
        }}
      >
        <Box
          component="h1"
          sx={{
            m: 0,
            fontSize: { xs: 36, sm: 64 },
            lineHeight: 1.05,
            fontWeight: 700,
            color: colors.text,
            letterSpacing: '-0.02em',
          }}
        >
          {landingCopy.curveHeadline}
        </Box>
        <Box
          sx={{
            mt: 2.5,
            mb: 4,
            fontSize: { xs: 17, sm: 20 },
            color: colors.textSecondary,
            maxWidth: 600,
            mx: { sm: 'auto' },
          }}
        >
          {landingCopy.curveSub}
        </Box>
        <Ctas align={phone ? 'flex-start' : 'center'} />
      </Box>

      <FullBleed>
        <Box ref={ref} sx={{ height: '420vh' }}>
          <Box
            sx={{
              position: 'sticky',
              top: topBar,
              height: `calc(100svh - ${topBar}px)`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              px: 2,
              gap: { xs: 2, sm: 3 },
            }}
          >
            <Box
              key={caption.title}
              sx={{
                textAlign: 'center',
                minHeight: { xs: 84, sm: 96 },
                '@keyframes capIn': {
                  from: { opacity: 0, transform: 'translateY(10px)' },
                  to: { opacity: 1, transform: 'none' },
                },
                animation: 'capIn 400ms ease-out',
              }}
            >
              <Box sx={{ fontSize: { xs: 22, sm: 32 }, fontWeight: 700, color: colors.text }}>
                {caption.title}
              </Box>
              <Box sx={{ mt: 0.5, fontSize: { xs: 15, sm: 18 }, color: colors.textSecondary }}>
                {caption.body}
              </Box>
            </Box>

            <Box sx={{ width: `min(100%, 1000px, calc((100svh - ${topBar + 300}px) * ${W / H}))` }}>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                style={{ display: 'block', overflow: 'visible' }}
                aria-hidden
              >
                {/* Axes and the 90% target line. */}
                {[0, 0.5, 0.9, 1].map((r) => (
                  <g key={r}>
                    <line
                      x1={PAD.l}
                      x2={W - PAD.r}
                      y1={y(r)}
                      y2={y(r)}
                      stroke={r === 0.9 ? colors.primaryDark : colors.divider}
                      strokeDasharray={r === 0.9 ? '6 6' : undefined}
                      strokeWidth={r === 0.9 ? 1.5 : 1}
                      opacity={r === 0.9 ? span(p, 0.28, 0.34) : 1}
                    />
                    <text
                      x={PAD.l - 10}
                      y={y(r) + 5}
                      textAnchor="end"
                      fontSize={phone ? 26 : 16}
                      fill={colors.textSecondary}
                      fontFamily={fonts.body}
                    >
                      {Math.round(r * 100)}%
                    </text>
                  </g>
                ))}
                {[0, 30, 60, 90].map((d) => (
                  <text
                    key={d}
                    x={x(d)}
                    y={H - 14}
                    textAnchor="middle"
                    fontSize={phone ? 26 : 16}
                    fill={colors.textSecondary}
                    fontFamily={fonts.body}
                  >
                    {d === 0 ? 'Day 0' : `${d}`}
                  </text>
                ))}

                <path
                  ref={plainRef}
                  d={plainPath}
                  fill="none"
                  stroke={colors.textSecondary}
                  strokeWidth={phone ? 5 : 3}
                  strokeDasharray={lens.plain}
                  strokeDashoffset={lens.plain * (1 - plainDraw)}
                  opacity={1 - 0.55 * span(p, 0.3, 0.4)}
                />
                <path
                  ref={spacedRef}
                  d={spacedPath}
                  fill="none"
                  stroke={colors.primaryDark}
                  strokeWidth={phone ? 7 : 4}
                  strokeLinejoin="round"
                  strokeDasharray={lens.spaced}
                  strokeDashoffset={lens.spaced * (1 - spacedDraw)}
                />
                {reviews.map((d, i) => {
                  const on = drawnLength >= lengthTo[reviewAt[i]];
                  return (
                    <g
                      key={d}
                      transform={`translate(${x(d)}, ${y(1)})`}
                      style={{ transition: 'opacity 250ms', opacity: on ? 1 : 0 }}
                    >
                      <circle
                        r={phone ? 12 : 8}
                        fill={colors.primaryLight}
                        style={{
                          transform: on ? 'scale(1)' : 'scale(0)',
                          transition: 'transform 300ms cubic-bezier(.3,1.6,.5,1)',
                        }}
                      />
                      <text
                        y={phone ? -24 : -16}
                        textAnchor="middle"
                        fontSize={phone ? 24 : 15}
                        fontWeight={700}
                        fill={colors.text}
                        fontFamily={fonts.body}
                      >
                        {i + 1}
                      </text>
                    </g>
                  );
                })}
                <text
                  x={x(DAYS) - 4}
                  y={y(recall(DAYS, 1)) - 14}
                  textAnchor="end"
                  fontSize={phone ? 24 : 15}
                  fill={colors.textSecondary}
                  fontFamily={fonts.body}
                  opacity={plainDraw}
                >
                  without review
                </text>
              </svg>
            </Box>

            <Box
              sx={{
                opacity: ctaIn,
                transform: `translateY(${(1 - ctaIn) * 16}px)`,
                pointerEvents: ctaIn > 0.5 ? 'auto' : 'none',
              }}
            >
              <Ctas />
            </Box>
          </Box>
        </Box>
      </FullBleed>

      {/* Features as a ledger: hanzi, title, body in three columns. */}
      <Box sx={{ maxWidth: 1000, mx: 'auto', py: { xs: 6, sm: 10 } }}>
        {landingCopy.features.map((f) => (
          <Box
            key={f.glyph}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '48px 1fr', sm: '72px 300px 1fr' },
              alignItems: 'baseline',
              columnGap: 3,
              py: 2.5,
              borderTop: `1px solid ${colors.divider}`,
            }}
          >
            <Box
              sx={{
                fontFamily: fonts.hanzi,
                fontSize: { xs: 36, sm: 48 },
                color: colors.primaryDark,
                gridRow: { xs: 'span 2', sm: 'auto' },
              }}
            >
              {f.glyph}
            </Box>
            <Box sx={{ fontSize: { xs: 18, sm: 20 }, fontWeight: 700, color: colors.text }}>
              {f.title}
            </Box>
            <Box sx={{ fontSize: 16, color: colors.textSecondary }}>{f.body}</Box>
          </Box>
        ))}
      </Box>

      <FullBleed bg={colors.text}>
        <Box sx={{ py: { xs: 8, sm: 12 }, px: 2, textAlign: 'center', color: colors.paper }}>
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

export default LandingVariantD;
