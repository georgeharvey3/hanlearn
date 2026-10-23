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
          height: `calc(100svh - ${topBar}px)`,
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
            {/* A ragged edge: push the disc's edge about with noise, so it
                spreads like ink in wet paper. */}
            <filter id="ink-bleed" x="-50%" y="-50%" width="200%" height="200%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.006"
                numOctaves="3"
                seed="7"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="420"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
            <mask id="ink-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={IW} height={IH}>
              <rect x="0" y="0" width={IW} height={IH} fill="black" />
              <circle
                cx={SUN.x}
                cy={SUN.y}
                r={FULL_RADIUS * reveal}
                fill="white"
                filter="url(#ink-bleed)"
              />
            </mask>
          </defs>
          <image href={mountains} x="0" y="0" width={IW} height={IH} mask="url(#ink-mask)" />
        </svg>

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

        {/* The footer sits in the painting, over the water, so the finale is
            the last screen of the page. */}
        <Box
          component="footer"
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 'calc(12px + env(safe-area-inset-bottom))',
            textAlign: 'center',
            fontSize: 13,
            color: colors.textSecondary,
          }}
          style={{ opacity: ctaIn }}
        >
          {copy.landing.footer}{' '}
          <Box
            component="a"
            href="https://github.com/georgeharvey3/hanlearn"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'inherit' }}
          >
            {copy.landing.github}
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
