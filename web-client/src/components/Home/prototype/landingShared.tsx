// PROTOTYPE (#402): shared bits for the landing page variants. Throwaway;
// lives on the prototype/landing-402 branch only.
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import GlobalStyles from '@mui/material/GlobalStyles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import * as actions from '../../../store/actions/index';
import { AppDispatch } from '../../../types/actions';
import { TOP_BAR_HEIGHT } from '../../Navigation/Toolbar/Toolbar';
import { colors, fonts } from '../../../theme';
import { loadCharData } from '../../../utils/charDataLoader';

// Placeholder copy for every variant. The winner's strings move to copy.ts.
export const landingCopy = {
  startFree: 'Start free',
  trySession: 'Try a session',
  scroll: 'Scroll',
  todaysChengyu: '今日成语 · Today’s chengyu',
  brushHeadline: 'Chinese, one stroke at a time.',
  brushSub: 'Add the words you meet. HanLearn asks each one again just before you forget it.',
  directionsHeadline: 'Know a word from every side.',
  directionsSub: 'Every word is tested five ways, and each way keeps its own schedule.',
  wordmarkTagline: 'Vocabulary that stays.',
  curveHeadline: 'Every word fades. HanLearn catches it first.',
  curveSub: 'Each review comes just before you would forget, so the gaps grow from days to months.',
  finalHeadline: 'Your first ten words take two minutes.',
  footer: 'Free and open source.',
  features: [
    {
      glyph: '查',
      title: 'A 124,000-word dictionary',
      body: 'Search in hanzi, pinyin or English and add a word in one tap.',
    },
    {
      glyph: '听',
      title: 'Listen and speak',
      body: 'Native audio for every word, and speech checks for your tones.',
    },
    {
      glyph: '写',
      title: 'Write by hand',
      body: 'Draw each character stroke by stroke, not just pick it from a list.',
    },
    {
      glyph: '句',
      title: 'Sentences',
      body: 'Read and write new sentences with the words you know.',
    },
  ],
};

/** Gutter of Layout's <main>, which a full-bleed section cancels. */
export const useGutter = () => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  return {
    phone,
    gutter: phone ? 16 : 32,
    topBar: phone ? TOP_BAR_HEIGHT.phone : TOP_BAR_HEIGHT.desktop,
  };
};

export const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Progress of `p` through the window [a, b], clamped to 0..1. */
export const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Scroll progress of a tall section through the viewport: 0 when its top
 * reaches `offset`, 1 when its bottom reaches the bottom of the viewport.
 */
export const useSectionProgress = (offset = 0) => {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(prefersReducedMotion() ? 1 : 0);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const distance = rect.height - (window.innerHeight - offset);
      setProgress(distance > 0 ? clamp01((offset - rect.top) / distance) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [offset]);

  return { ref, progress };
};

/** window.scrollY, throttled to one update a frame. */
export const useScrollY = () => {
  const [y, setY] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setY(window.scrollY);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return y;
};

/**
 * Breaks out of Layout's padded, max-width <main> to the full viewport width.
 * `cancelTop` pulls the first section up to meet the top bar.
 */
export const FullBleed: React.FC<{
  children: React.ReactNode;
  cancelTop?: boolean;
  bg?: string;
  sx?: object;
}> = ({ children, cancelTop, bg, sx }) => {
  const { gutter } = useGutter();
  return (
    <Box
      sx={{
        width: '100vw',
        ml: 'calc(50% - 50vw)',
        mt: cancelTop ? `-${gutter}px` : 0,
        bgcolor: bg,
        position: 'relative',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

/** Keeps a 100vw section from adding a sideways scroll on desktop. */
export const LandingGlobals: React.FC<{ extra?: object }> = ({ extra }) => (
  <GlobalStyles styles={{ html: { overflowX: 'clip' }, body: { overflowX: 'clip' }, ...extra }} />
);

export const useLandingActions = () => {
  const dispatch = useDispatch<AppDispatch>();
  const history = useHistory();
  return {
    signUp: () => dispatch(actions.openAuthModal('register')),
    tryOut: () => history.push('/tryout'),
  };
};

export const Ctas: React.FC<{ align?: 'center' | 'flex-start'; inverse?: boolean }> = ({
  align = 'center',
  inverse,
}) => {
  const { signUp, tryOut } = useLandingActions();
  const base = {
    height: 48,
    px: 3,
    borderRadius: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: 600,
  };
  return (
    <Box sx={{ display: 'flex', gap: 1.5, justifyContent: align, flexWrap: 'wrap' }}>
      <ButtonBase
        onClick={signUp}
        sx={{
          ...base,
          bgcolor: inverse ? colors.paper : colors.primaryDark,
          color: inverse ? colors.primaryDark : colors.white,
          '&:hover': { bgcolor: inverse ? colors.white : colors.primaryDarkHover },
        }}
      >
        {landingCopy.startFree}
      </ButtonBase>
      <ButtonBase
        onClick={tryOut}
        sx={{
          ...base,
          border: `1px solid ${inverse ? 'rgba(255,255,255,0.5)' : colors.borderStrong}`,
          color: inverse ? colors.white : colors.text,
          '&:hover': { borderColor: inverse ? colors.white : colors.textSecondary },
        }}
      >
        {landingCopy.trySession}
      </ButtonBase>
    </Box>
  );
};

export const LandingFooter: React.FC = () => (
  <Box
    component="footer"
    sx={{
      py: 4,
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 14,
      borderTop: `1px solid ${colors.divider}`,
    }}
  >
    <Box component="span" sx={{ fontFamily: fonts.brand, fontSize: 22, color: colors.text, mr: 1 }}>
      HanLearn
    </Box>
    {landingCopy.footer}{' '}
    <Box
      component="a"
      href="https://github.com/georgeharvey3/hanlearn"
      target="_blank"
      rel="noopener noreferrer"
      sx={{ color: 'inherit' }}
    >
      GitHub
    </Box>
  </Box>
);

/** The seal stamp: two characters in a red square. */
export const Seal: React.FC<{ size?: number; sx?: object }> = ({ size = 56, sx }) => (
  <Box
    aria-hidden
    sx={{
      width: size,
      height: size,
      bgcolor: colors.primaryLight,
      color: colors.paper,
      borderRadius: '6px',
      display: 'grid',
      gridTemplateColumns: '1fr',
      placeItems: 'center',
      fontFamily: fonts.hanzi,
      fontSize: size * 0.4,
      lineHeight: 1,
      writingMode: 'vertical-rl',
      letterSpacing: 2,
      ...sx,
    }}
  >
    汉学
  </Box>
);

// --- Stroke data ----------------------------------------------------------

export interface CharStrokes {
  strokes: string[];
  medians: [number, number][][];
}

/** Loads Hanzi Writer's stroke data for each character, in order. */
export const useStrokeData = (chars: string[]) => {
  const [data, setData] = useState<(CharStrokes | null)[]>(() => chars.map(() => null));
  const key = chars.join('');
  useEffect(() => {
    let live = true;
    chars.forEach((c, i) =>
      loadCharData(
        c,
        (d) => {
          if (!live) return;
          setData((prev) => prev.map((x, j) => (j === i ? (d as CharStrokes) : x)));
        },
        () => undefined,
      ),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return data;
};

const medianLength = (pts: [number, number][]) =>
  pts.reduce(
    (sum, p, i) => (i ? sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0),
    0,
  );

/**
 * One character, drawn stroke by stroke as `progress` goes 0 to 1: each
 * stroke's outline clips a thick line along its median, and the line's dash
 * grows. The same trick Hanzi Writer animates with, driven by scroll here.
 */
export const StrokeChar: React.FC<{
  char: string;
  data: CharStrokes | null;
  progress: number;
  id: string;
  size: number;
  ink?: string;
  grid?: boolean;
}> = ({ char, data, progress, id, size, ink = colors.text, grid = true }) => {
  const lengths = React.useMemo(() => data?.medians.map(medianLength) ?? [], [data]);
  const total = lengths.reduce((a, b) => a + b, 0);
  const drawn = progress * total;
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg viewBox="0 0 1024 1024" width={size} height={size} aria-label={char} role="img">
        {grid && (
          <g stroke={colors.gridLine} strokeWidth={4} strokeDasharray="16 14" fill="none">
            <rect
              x={2}
              y={2}
              width={1020}
              height={1020}
              strokeDasharray="none"
              stroke={colors.outline}
              strokeWidth={6}
            />
            <line x1={0} y1={512} x2={1024} y2={512} />
            <line x1={512} y1={0} x2={512} y2={1024} />
            <line x1={0} y1={0} x2={1024} y2={1024} opacity={0.5} />
            <line x1={1024} y1={0} x2={0} y2={1024} opacity={0.5} />
          </g>
        )}
        {data ? (
          <g transform="translate(0, 900) scale(1, -1)">
            <defs>
              {data.strokes.map((s, i) => (
                <clipPath key={i} id={`${id}-c${i}`}>
                  <path d={s} />
                </clipPath>
              ))}
            </defs>
            {data.strokes.map((s, i) => (
              <path key={`o${i}`} d={s} fill={colors.outline} />
            ))}
            {data.medians.map((m, i) => {
              const len = lengths[i];
              const show = Math.min(len, Math.max(0, drawn - starts[i]));
              return (
                <polyline
                  key={`m${i}`}
                  clipPath={`url(#${id}-c${i})`}
                  points={m.map((p) => p.join(',')).join(' ')}
                  fill="none"
                  stroke={ink}
                  strokeWidth={200}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={`${len + 1} ${len + 400}`}
                  strokeDashoffset={len + 1 - show}
                  opacity={show > 0 ? 1 : 0}
                />
              );
            })}
          </g>
        ) : (
          <text
            x={512}
            y={800}
            textAnchor="middle"
            fontSize={820}
            fontFamily={fonts.hanzi}
            fill={progress > 0.5 ? ink : colors.outline}
          >
            {char}
          </text>
        )}
      </svg>
    </Box>
  );
};
