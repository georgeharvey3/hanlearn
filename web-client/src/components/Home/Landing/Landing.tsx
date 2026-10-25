// The page a visitor sees before an account exists: a phone that plays a
// session, the five ways a word is tested, and the features, all on paper.
// Then the finale: the ink painting of the old
// banner, shown once, uncovered and full-bleed. It bleeds out from the red sun
// like ink dropped in water, mist gathers at its centre, and the HanLearn
// wordmark and a last call to sign up appear in the mist.
import React from 'react';
import Box from '@mui/material/Box';

import mountains from '../../../assets/images/homepage/mountains.jpg';
import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { LogoMark, Wordmark } from '../../Logo/Logo';
import Features from './Features';
import FiveWays from './FiveWays';
import { Ctas, FullBleed, LandingGlobals } from './layout';
import { easeInOut, easeOut, span, useGutter, useSectionProgress, useStageScale } from './motion';
import ProductHero from './ProductHero';

// The painting's own pixel size, used as the SVG's coordinate space.
const IW = 3000;
const IH = 2000;
// Where the red sun sits, which the ink bleeds out from.
const SUN = { x: 0.78 * IW, y: 0.16 * IH };
// The radius that covers the far corner from the sun, plus room for the
// ragged edge.
const FULL_RADIUS = Math.hypot(SUN.x, IH - SUN.y) + 500;

// The ink's ragged edge: a disc whose radius wanders with the angle, and
// whose bumps drift as it grows, so it spreads like ink in wet paper. This is
// a computed path, not an SVG turbulence filter: iOS Safari gives up on a
// filter that large and draws nothing, which blanked the painting on phones.
const INK_POINTS = 240;
const INK_WAVES = [
  { k: 3, amp: 90, phase: 0.4, drift: 0.0011 },
  { k: 5, amp: 60, phase: 2.1, drift: -0.0017 },
  { k: 9, amp: 36, phase: 4.0, drift: 0.0023 },
  { k: 16, amp: 20, phase: 1.3, drift: -0.0031 },
  { k: 27, amp: 11, phase: 5.2, drift: 0.0041 },
];
const inkPath = (r: number): string => {
  if (r <= 0) return '';
  // Small discs get small bumps, so the first drop is round.
  const rough = Math.min(1, r / 400);
  const points: string[] = [];
  for (let i = 0; i < INK_POINTS; i += 1) {
    const a = (i / INK_POINTS) * 2 * Math.PI;
    const bump = INK_WAVES.reduce(
      (sum, w) => sum + w.amp * Math.sin(w.k * a + w.phase + w.drift * r),
      0,
    );
    const ri = Math.max(0, r + rough * bump);
    points.push(
      `${(SUN.x + ri * Math.cos(a)).toFixed(1)},${(SUN.y + ri * Math.sin(a)).toFixed(1)}`,
    );
  }
  return `M${points.join('L')}Z`;
};

const PaintingFinale: React.FC = () => {
  const { topBar } = useGutter();
  const scale = useStageScale();
  const { ref, progress: p } = useSectionProgress(topBar);
  const [aspect, setAspect] = React.useState(window.innerWidth / (window.innerHeight - topBar));
  React.useEffect(() => {
    const onResize = () => setAspect(window.innerWidth / (window.innerHeight - topBar));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [topBar]);

  const reveal = easeInOut(span(p, 0.02, 0.42));
  const mistIn = easeOut(span(p, 0.4, 0.58));
  const markIn = easeOut(span(p, 0.45, 0.62));
  const ctaIn = easeOut(span(p, 0.56, 0.72));
  // The view drifts back from a little close to the whole frame.
  const zoom = 0.86 + 0.14 * span(p, 0, 1);

  // Cover the stage, then frame it: on a phone the crop sits right of centre,
  // so the sun and the boat both stay in view.
  const coverW = Math.min(IW, IH * aspect);
  const vbW = coverW * zoom;
  const vbH = (coverW / aspect) * zoom;
  const focusX = aspect < 1 ? 0.7 : 0.5;
  const vbX = Math.min(IW - vbW, Math.max(0, focusX * IW - vbW / 2));
  const vbY = Math.min(IH - vbH, Math.max(0, 0.5 * IH - vbH / 2));

  return (
    <Box ref={ref} sx={{ height: '320vh', position: 'relative', bgcolor: colors.paper }}>
      <Box
        sx={{
          position: 'sticky',
          top: topBar,
          // The painting fills the large viewport, so it reaches the bottom
          // edge when a phone browser hides its toolbar on scroll. With the
          // small viewport, a paper-coloured bar showed in the toolbar's place.
          height: `calc(100lvh - ${topBar}px)`,
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid slice"
          width="100%"
          height="100%"
          style={{ display: 'block' }}
          aria-hidden
        >
          <defs>
            <clipPath id="ink-clip" clipPathUnits="userSpaceOnUse">
              <path d={inkPath(FULL_RADIUS * reveal)} />
            </clipPath>
          </defs>
          <image href={mountains} x="0" y="0" width={IW} height={IH} clipPath="url(#ink-clip)" />
        </svg>

        {/* The overlay keeps to the small viewport, so the wordmark and the
            buttons stay clear of the toolbar while it shows. */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: `calc(100svh - ${topBar}px)`,
          }}
        >
          {/* Mist that gathers at the centre, so the wordmark reads without a
            panel over the painting. */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse 62% 34% at 50% 50%, ${colors.paper} 0%, rgba(250, 248, 245, 0.85) 40%, rgba(250, 248, 245, 0) 100%)`,
            }}
            style={{ opacity: mistIn }}
          />

          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              px: 2,
              textAlign: 'center',
            }}
          >
            <Box style={{ zoom: scale }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: { xs: 2, sm: 3 },
                  fontSize: { xs: 63, sm: 125 },
                }}
                style={{ opacity: markIn, transform: `translateY(${(1 - markIn) * 20}px)` }}
              >
                <Box sx={{ width: { xs: 88, sm: 140 }, height: { xs: 88, sm: 140 } }}>
                  <LogoMark size="100%" />
                </Box>
                <Wordmark text={copy.shell.brand} />
              </Box>
              <Box
                sx={{ mt: { xs: 2, sm: 3 } }}
                style={{
                  opacity: ctaIn,
                  transform: `translateY(${(1 - ctaIn) * 16}px)`,
                  pointerEvents: ctaIn > 0.5 ? 'auto' : 'none',
                }}
              >
                <Box component="h2" sx={{ m: 0, mb: { xs: 2.5, sm: 3 }, color: colors.text }}>
                  <Box
                    component="span"
                    lang="zh"
                    sx={{
                      display: 'block',
                      fontFamily: fonts.hanzi,
                      fontSize: { xs: 30, sm: 42 },
                      fontWeight: 400,
                      letterSpacing: '0.12em',
                    }}
                  >
                    {copy.landing.proverb}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      display: 'block',
                      mt: 0.5,
                      fontSize: { xs: 17, sm: 20 },
                      fontStyle: 'italic',
                      fontWeight: 400,
                      color: colors.textSecondary,
                    }}
                  >
                    {copy.landing.proverbGloss}
                  </Box>
                </Box>
                <Ctas />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const Landing: React.FC = () => {
  const { gutter } = useGutter();
  return (
    <>
      <LandingGlobals />
      <ProductHero />
      <FullBleed bg={colors.paper}>
        <FiveWays />
      </FullBleed>
      <FullBleed bg={colors.paper}>
        <Features />
      </FullBleed>
      {/* Cancel the page's bottom gutter, so the painting meets the bottom edge. */}
      <FullBleed sx={{ mb: `-${gutter}px` }}>
        <PaintingFinale />
      </FullBleed>
    </>
  );
};

export default Landing;
