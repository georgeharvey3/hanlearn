// PROTOTYPE (#402): three ways to bring colour to the first screen, behind
// the brushed 学. `?state=sun|wash|blossom` picks one. Each takes `t`, the
// progress of the brush, from 0 to 1, so it grows with the character.
// Throwaway.
import React from 'react';
import Box from '@mui/material/Box';

import mountains from '../../../assets/images/homepage/mountains.jpg';
import { colors } from '../../../theme';
import { easeOut, span } from './landingShared';

// --- 1. The sun -------------------------------------------------------------

// The red sun of the finale's painting, in the painting's own pixels. Its
// lower half fades into the mist, so it seems to rise through it.
const SUN = { x: 2340, y: 383, r: 152 };
// The sun fills this share of the crop; the rest is the fade of the mask.
const SUN_FILL = 0.88;

/**
 * The painting's sun, set behind the character. A colour matrix keeps only
 * the red pigment: alpha follows how much redder than green a pixel is, so
 * the beige paper and the grey mountain drop out, and the sun's lower half
 * fades away into nothing, as it fades into the mist in the painting.
 */
export const SunBackdrop: React.FC<{ t: number }> = ({ t }) => {
  const rise = easeOut(span(t, 0, 0.75));
  const half = SUN.r / SUN_FILL;
  return (
    <Box
      aria-hidden
      sx={{ position: 'absolute', inset: '-6% -6% 6% -6%', zIndex: 0 }}
      style={{ opacity: rise, transform: `translateY(${(1 - rise) * 14}%)` }}
    >
      <svg
        viewBox={`${SUN.x - half} ${SUN.y - half} ${half * 2} ${half * 2}`}
        width="100%"
        height="100%"
      >
        <defs>
          <filter id="sun-pigment" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  3.2 -3.2 0 0 -0.12"
            />
          </filter>
          <radialGradient
            id="sun-fade"
            cx={SUN.x}
            cy={SUN.y}
            r={half}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset={SUN_FILL} stopColor="white" />
            <stop offset="1" stopColor="black" />
          </radialGradient>
          <mask
            id="sun-mask"
            maskUnits="userSpaceOnUse"
            x={SUN.x - half}
            y={SUN.y - half}
            width={half * 2}
            height={half * 2}
          >
            <rect
              x={SUN.x - half}
              y={SUN.y - half}
              width={half * 2}
              height={half * 2}
              fill="url(#sun-fade)"
            />
          </mask>
        </defs>
        <g mask="url(#sun-mask)">
          <image
            href={mountains}
            x="0"
            y="0"
            width="3000"
            height="2000"
            filter="url(#sun-pigment)"
          />
        </g>
      </svg>
    </Box>
  );
};

// --- 2. The wash ------------------------------------------------------------

/**
 * Two pools of watercolour, seal red and jade green, that spread behind the
 * character as it is brushed. The same noise-pushed edge as the finale's ink.
 */
export const WashBackdrop: React.FC<{ t: number }> = ({ t }) => {
  const red = easeOut(span(t, 0, 0.7));
  const green = easeOut(span(t, 0.25, 0.9));
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: '-28%',
        zIndex: 0,
        mixBlendMode: 'multiply',
        pointerEvents: 'none',
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="wash" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.035"
              numOctaves="4"
              seed="3"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="16"
              xChannelSelector="R"
              yChannelSelector="G"
              result="ragged"
            />
            <feGaussianBlur in="ragged" stdDeviation="0.9" />
          </filter>
          {/* Watercolour dries darker at its rim. */}
          <radialGradient id="wash-red">
            <stop offset="0.55" stopColor={colors.primaryLight} stopOpacity="0.2" />
            <stop offset="0.95" stopColor={colors.primaryLight} stopOpacity="0.38" />
            <stop offset="1" stopColor={colors.primaryLight} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="wash-green">
            <stop offset="0.5" stopColor={colors.primaryDark} stopOpacity="0.12" />
            <stop offset="0.95" stopColor={colors.primaryDark} stopOpacity="0.26" />
            <stop offset="1" stopColor={colors.primaryDark} stopOpacity="0" />
          </radialGradient>
        </defs>
        <g filter="url(#wash)">
          <circle cx="57" cy="44" r={30 * red} fill="url(#wash-red)" />
          <circle cx="36" cy="64" r={17 * green} fill="url(#wash-green)" />
        </g>
      </svg>
    </Box>
  );
};

// --- 3. The blossom ---------------------------------------------------------

// A stand-in, drawn here in SVG, for a plum-blossom painting in the same ink
// style as the finale. A real image would replace it.
const branches = [
  { d: 'M 640 70 C 560 90 500 120 430 170', w: 20, at: 0 },
  { d: 'M 430 170 C 360 220 300 250 220 290', w: 13, at: 0.25 },
  { d: 'M 220 290 C 180 310 150 340 120 380', w: 7, at: 0.5 },
  { d: 'M 470 145 C 470 100 490 60 520 30', w: 6, at: 0.2 },
  { d: 'M 330 232 C 310 270 300 310 310 350', w: 5, at: 0.4 },
  { d: 'M 250 275 C 240 240 250 210 270 185', w: 4, at: 0.55 },
];

const blossoms = [
  { x: 520, y: 34, r: 15, at: 0.45 },
  { x: 455, y: 160, r: 18, at: 0.5 },
  { x: 375, y: 205, r: 14, at: 0.58 },
  { x: 312, y: 350, r: 16, at: 0.66 },
  { x: 268, y: 186, r: 13, at: 0.72 },
  { x: 205, y: 300, r: 15, at: 0.78 },
  { x: 125, y: 377, r: 12, at: 0.86 },
];

const buds = [
  { x: 500, y: 74, at: 0.5 },
  { x: 404, y: 186, at: 0.6 },
  { x: 160, y: 335, at: 0.82 },
  { x: 305, y: 296, at: 0.7 },
];

const Flower: React.FC<{ x: number; y: number; r: number; k: number }> = ({ x, y, r, k }) => (
  <g
    transform={`translate(${x} ${y}) scale(${k}) rotate(${(x * 7) % 72})`}
    opacity={Math.min(1, k * 1.4)}
  >
    {[0, 72, 144, 216, 288].map((a) => (
      <circle
        key={a}
        cx={Math.cos((a * Math.PI) / 180) * r * 0.62}
        cy={Math.sin((a * Math.PI) / 180) * r * 0.62}
        r={r * 0.55}
        fill={colors.primaryLight}
        opacity={0.82}
      />
    ))}
    <circle r={r * 0.28} fill="#f1d6a0" />
  </g>
);

/** A plum branch that reaches in from the edge and flowers as 学 is brushed. */
export const BlossomBackdrop: React.FC<{ t: number; mirror: boolean }> = ({ t, mirror }) => (
  <Box
    aria-hidden
    sx={{
      position: 'absolute',
      top: { xs: 0, md: '2%' },
      [mirror ? 'left' : 'right']: 0,
      width: { xs: '78vw', md: 'min(46vw, 640px)' },
      aspectRatio: '1',
      zIndex: 0,
      pointerEvents: 'none',
      transform: mirror ? 'scaleX(-1)' : undefined,
    }}
  >
    <svg viewBox="0 0 640 480" width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <filter id="branch-ink" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05"
            numOctaves="2"
            seed="11"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="7"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter id="petal-wash" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.08"
            numOctaves="2"
            seed="5"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="5"
            xChannelSelector="R"
            yChannelSelector="G"
            result="ragged"
          />
          <feGaussianBlur in="ragged" stdDeviation="0.6" />
        </filter>
      </defs>
      <g filter="url(#branch-ink)" stroke={colors.text} fill="none" strokeLinecap="round">
        {branches.map((b) => {
          const k = span(t, b.at * 0.6, b.at * 0.6 + 0.3);
          return (
            <path
              key={b.d}
              d={b.d}
              strokeWidth={b.w}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - k}
              opacity={0.88}
            />
          );
        })}
      </g>
      <g filter="url(#petal-wash)">
        {buds.map((b) => (
          <circle
            key={`${b.x}-${b.y}`}
            cx={b.x}
            cy={b.y}
            r={6 * easeOut(span(t, b.at, b.at + 0.12))}
            fill={colors.primaryLight}
          />
        ))}
        {blossoms.map((b) => (
          <Flower
            key={`${b.x}-${b.y}`}
            x={b.x}
            y={b.y}
            r={b.r}
            k={easeOut(span(t, b.at, b.at + 0.14))}
          />
        ))}
      </g>
    </svg>
  </Box>
);
