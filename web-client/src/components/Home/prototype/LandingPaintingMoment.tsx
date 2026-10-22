// PROTOTYPE (#402) W, "Painting moment": the same opening and demo as R, then
// the ink painting of the old banner shown once, uncovered and full-bleed. It
// bleeds out from the red sun like ink dropped in water, holds while the view
// drifts back a little, and scrolls away. Then the chengyu on paper and the
// features. Throwaway.
import React from 'react';
import Box from '@mui/material/Box';

import mountains from '../../../assets/images/homepage/mountains.jpg';
import { colors } from '../../../theme';
import {
  FullBleed,
  LandingFooter,
  LandingGlobals,
  easeInOut,
  span,
  useGutter,
  useSectionProgress,
} from './landingShared';
import { BrushHero, ChengyuBrush, Features, FiveWays } from './landingSections';

export const name = 'Painting moment';

// The painting's own pixel size, used as the SVG's coordinate space.
const IW = 3000;
const IH = 2000;
// Where the red sun sits, which the ink bleeds out from.
const SUN = { x: 0.78 * IW, y: 0.16 * IH };
// The radius that covers the far corner from the sun, plus room for the
// ragged edge.
const FULL_RADIUS = Math.hypot(SUN.x, IH - SUN.y) + 500;

const PaintingMoment: React.FC = () => {
  const { topBar } = useGutter();
  const { ref, progress: p } = useSectionProgress(topBar);
  const [aspect, setAspect] = React.useState(window.innerWidth / (window.innerHeight - topBar));
  React.useEffect(() => {
    const onResize = () => setAspect(window.innerWidth / (window.innerHeight - topBar));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [topBar]);

  const reveal = easeInOut(span(p, 0.05, 0.5));
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
    <Box ref={ref} sx={{ height: '300vh', position: 'relative', bgcolor: colors.paper }}>
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
            {/* A soft, ragged edge: blur the disc, then push its edge about
                with noise, so it spreads like ink in wet paper. */}
            <filter id="ink-bleed" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="40" />
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
      </Box>
    </Box>
  );
};

const LandingPaintingMoment: React.FC = () => (
  <>
    <LandingGlobals />
    <BrushHero />
    <FullBleed bg={colors.paper}>
      <FiveWays />
    </FullBleed>
    <FullBleed>
      <PaintingMoment />
    </FullBleed>
    <FullBleed bg={colors.paper}>
      <ChengyuBrush />
    </FullBleed>
    <Features />
    <LandingFooter />
  </>
);

export default LandingPaintingMoment;
