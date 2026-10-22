// PROTOTYPE (#402): three ways to dress the first screen's 学 in Chinese
// calligraphy, picked by `?state=trace|scroll|seals`. Throwaway.
//
// - trace: red tracing practice (描红). The character is printed in red on a
//   red practice grid, the brush traces over it in black, and a teacher's
//   cinnabar circle (朱批) marks it as well written.
// - scroll: a hanging scroll (立轴) of aged paper in silk brocade, which
//   unrolls before the brush writes.
// - seals: an inscription (题款) and the seals of later owners (鉴藏印),
//   stamped one by one after the character is written.
import React from 'react';
import Box from '@mui/material/Box';

import { fonts } from '../../../theme';
import { easeOut, span } from './landingShared';

export type HeroTreatment = '' | 'trace' | 'scroll' | 'seals';

/** Cinnabar: the red of a teacher's brush and of seal paste. */
export const CINNABAR = '#c8382c';

// --- Tracing practice -----------------------------------------------------

/**
 * The teacher's red circle: one loose brush loop round the character, a
 * little open where the brush lifted, drawn in once the tracing is done.
 */
export const TeacherCircle: React.FC<{ k: number }> = ({ k }) => (
  <Box aria-hidden sx={{ position: 'absolute', inset: '-9%', zIndex: 2, pointerEvents: 'none' }}>
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <filter id="brush-dry" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed="4"
            result="grain"
          />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.75"
            result="holes"
          />
          <feComposite in="SourceGraphic" in2="holes" operator="in" result="dry" />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.06"
            numOctaves="2"
            seed="9"
            result="wobble"
          />
          <feDisplacementMap
            in="dry"
            in2="wobble"
            scale="1.6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <path
        d="M 63 9 C 86 13 97 36 93 58 C 89 82 66 95 45 93 C 22 91 6 72 7 49 C 8 27 25 10 48 8 C 55 7.5 61 9 66 11.5"
        fill="none"
        stroke={CINNABAR}
        strokeWidth={2.6}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - k}
        filter="url(#brush-dry)"
        opacity={0.92}
      />
    </svg>
  </Box>
);

// --- Hanging scroll -------------------------------------------------------

// A gold lattice woven into indigo silk.
const BROCADE = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><path d="M11 1 L21 11 L11 21 L1 11 Z" fill="none" stroke="#c9a85f" stroke-opacity="0.32" stroke-width="1"/><circle cx="11" cy="11" r="1.6" fill="#c9a85f" fill-opacity="0.4"/></svg>',
)}")`;

const wood = 'linear-gradient(180deg, #6b4128 0%, #3a2114 55%, #24140c 100%)';

/**
 * Mounts its child, the paper, as a hanging scroll: indigo brocade, two
 * hanging ribbons (惊燕) on the top margin, a hanging rod above and a roller
 * below. `unroll` from 0 to 1 lets the scroll down from the rod.
 */
export const HangingScroll: React.FC<{
  unroll: number;
  size: string;
  children: React.ReactNode;
}> = ({ unroll, size, children }) => {
  const u = easeOut(unroll);
  const s = (k: number) => `calc(${size} * ${k})`;
  return (
    <Box
      sx={{
        position: 'relative',
        width: 'fit-content',
        filter: 'drop-shadow(0 18px 24px rgba(60, 40, 20, 0.28))',
      }}
    >
      {/* The hanging rod and its cord. */}
      <Box sx={{ position: 'relative', height: s(0.07), mx: s(-0.04) }}>
        <Box
          component="svg"
          viewBox="0 0 100 30"
          preserveAspectRatio="none"
          sx={{
            position: 'absolute',
            left: '30%',
            width: '40%',
            bottom: '60%',
            height: s(0.2),
            overflow: 'visible',
          }}
        >
          <path
            d="M 0 30 L 50 0 L 100 30"
            fill="none"
            stroke="#7a5a3a"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </Box>
        <Box sx={{ position: 'absolute', inset: 0, borderRadius: '3px', background: wood }} />
      </Box>

      <Box sx={{ position: 'relative' }}>
        <Box sx={{ clipPath: `inset(0 0 ${(1 - u) * 100}% 0)` }}>
          <Box
            sx={{
              position: 'relative',
              bgcolor: '#22375a',
              backgroundImage: BROCADE,
              pt: s(0.5),
              pb: s(0.26),
              px: s(0.17),
            }}
          >
            {/* The two hanging ribbons on the top margin. */}
            {[0.36, 0.64].map((x) => (
              <Box
                key={x}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: `${x * 100}%`,
                  width: s(0.06),
                  height: s(0.5),
                  transform: 'translateX(-50%)',
                  bgcolor: '#d9c7a0',
                  borderLeft: '1px solid #b39a6a',
                  borderRight: '1px solid #b39a6a',
                }}
              />
            ))}
            {/* A thin band of pale silk round the paper. */}
            <Box sx={{ p: s(0.03), bgcolor: '#d9c7a0' }}>
              <Box
                sx={{
                  bgcolor: '#efe2c3',
                  backgroundImage:
                    'radial-gradient(circle at 20% 30%, rgba(150, 110, 50, 0.10), transparent 40%), radial-gradient(circle at 75% 70%, rgba(150, 110, 50, 0.12), transparent 45%)',
                  boxShadow: 'inset 0 0 40px rgba(130, 90, 40, 0.22)',
                  pt: s(0.12),
                  px: s(0.12),
                  pb: s(0.32),
                }}
              >
                {children}
              </Box>
            </Box>
          </Box>
        </Box>
        {/* The roller rides the bottom edge as the scroll lets down. */}
        <Box
          sx={{
            position: 'absolute',
            left: s(-0.08),
            right: s(-0.08),
            height: s(0.09),
            top: `${u * 100}%`,
            transform: 'translateY(-50%)',
            borderRadius: '3px',
            background: wood,
          }}
        >
          {[0, 1].map((side) => (
            <Box
              key={side}
              sx={{
                position: 'absolute',
                top: '-30%',
                bottom: '-30%',
                [side ? 'right' : 'left']: s(-0.04),
                width: s(0.07),
                borderRadius: '4px',
                background: 'linear-gradient(90deg, #e8d7b0, #b89a62)',
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

// --- Inscription and seals ------------------------------------------------

// 丙午 is the year 2026 in the sixty-year cycle. "Written at HanLearn in the
// autumn of 丙午".
const INSCRIPTION = '丙午秋日书于汉学';

type SealShape = 'square' | 'round' | 'oval' | 'gourd';

// The seals of "later owners": phrases on learning from the Analects (学而时习,
// 温故知新) and two short mottos. 朱文 is red characters on paper; 白文 is
// paper-coloured characters cut out of red.
const seals: {
  text: string;
  shape: SealShape;
  relief: boolean;
  size: number;
  x: string;
  y: string;
  at: number;
}[] = [
  { text: '学而时习', shape: 'square', relief: false, size: 0.17, x: '-1%', y: '64%', at: 0.1 },
  { text: '温故知新', shape: 'oval', relief: true, size: 0.15, x: '84%', y: '0%', at: 0.3 },
  { text: '日新', shape: 'round', relief: true, size: 0.13, x: '84%', y: '80%', at: 0.5 },
  { text: '乐', shape: 'gourd', relief: false, size: 0.1, x: '2%', y: '-4%', at: 0.66 },
];

/** A seal impression, with the patchy ink of a real stamp. */
const SealMark: React.FC<{ text: string; shape: SealShape; relief: boolean; id: string }> = ({
  text,
  shape,
  relief,
  id,
}) => {
  const cols =
    text.length === 4
      ? [text.slice(2), text.slice(0, 2)]
      : text.length === 2
        ? [text[1], text[0]]
        : [text];
  const outline =
    shape === 'round' ? (
      <circle cx="50" cy="50" r="46" />
    ) : shape === 'oval' ? (
      <ellipse cx="50" cy="50" rx="36" ry="47" />
    ) : shape === 'gourd' ? (
      <path d="M 50 4 C 64 4 70 16 66 28 C 63 36 58 38 58 42 C 58 46 84 52 84 74 C 84 90 68 97 50 97 C 32 97 16 90 16 74 C 16 52 42 46 42 42 C 42 38 37 36 34 28 C 30 16 36 4 50 4 Z" />
    ) : (
      <rect x="4" y="4" width="92" height="92" rx="3" />
    );
  const vertical = cols.length > 1 || text.length === 2;
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        {/* Seal paste never prints evenly: knock small holes in it. */}
        <filter id={`${id}-ink`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.22"
            numOctaves="2"
            seed={id.length * 7}
            result="grain"
          />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.8 2.3"
            result="holes"
          />
          <feComposite in="SourceGraphic" in2="holes" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${id}-ink)`}>
        {relief ? (
          <g fill="none" stroke={CINNABAR} strokeWidth="5">
            {outline}
          </g>
        ) : (
          <g fill={CINNABAR}>{outline}</g>
        )}
        <g
          fill={relief ? CINNABAR : '#f6efe2'}
          fontFamily={fonts.hanzi}
          textAnchor="middle"
          dominantBaseline="central"
          fontWeight={700}
        >
          {vertical && cols.length === 2 ? (
            cols.map((col, ci) =>
              col.split('').map((ch, ri) => (
                <text
                  key={`${ci}${ri}`}
                  x={ci === 0 ? 30 : 70}
                  y={shape === 'oval' ? 31 + ri * 38 : 30 + ri * 40}
                  fontSize={shape === 'oval' ? 30 : 36}
                >
                  {ch}
                </text>
              )),
            )
          ) : text.length === 2 ? (
            text.split('').map((ch, i) => (
              <text key={i} x="50" y={31 + i * 38} fontSize="34">
                {ch}
              </text>
            ))
          ) : (
            <text x="50" y={shape === 'gourd' ? 70 : 50} fontSize={shape === 'gourd' ? 34 : 56}>
              {text}
            </text>
          )}
        </g>
      </g>
    </svg>
  );
};

/** The inscription column, then the seals stamped one after another. */
export const InscriptionAndSeals: React.FC<{ k: number; size: string }> = ({ k, size }) => {
  const write = span(k, 0, 0.35);
  const shown = Math.round(write * INSCRIPTION.length);
  return (
    <>
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: '8%',
          left: '3%',
          writingMode: 'vertical-rl',
          fontFamily: fonts.hanzi,
          fontSize: `calc(${size} * 0.06)`,
          lineHeight: 1,
          letterSpacing: '0.12em',
          color: '#3a322b',
          zIndex: 2,
        }}
      >
        {INSCRIPTION.split('').map((ch, i) => (
          <Box
            key={i}
            component="span"
            sx={{ opacity: i < shown ? 0.88 : 0, transition: 'opacity 200ms' }}
          >
            {ch}
          </Box>
        ))}
      </Box>
      {seals.map((seal, i) => {
        const stamp = span(k, 0.3 + seal.at * 0.7, 0.3 + seal.at * 0.7 + 0.1);
        return (
          <Box
            key={seal.text}
            aria-hidden
            sx={{
              position: 'absolute',
              left: seal.x,
              top: seal.y,
              width: `calc(${size} * ${seal.size})`,
              height: `calc(${size} * ${seal.size})`,
              zIndex: 2,
              opacity: stamp > 0 ? 0.9 : 0,
              transform: `scale(${1.35 - 0.35 * easeOut(stamp)}) rotate(${[-3, 2, -1, 3][i]}deg)`,
              mixBlendMode: 'multiply',
            }}
          >
            <SealMark text={seal.text} shape={seal.shape} relief={seal.relief} id={`seal-${i}`} />
          </Box>
        );
      })}
    </>
  );
};
